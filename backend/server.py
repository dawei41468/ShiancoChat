from dotenv import load_dotenv
import os
import logging
from pathlib import Path

# Load environment variables *before* other imports
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, AsyncGenerator
import uuid
import re
from datetime import datetime
from llm_service import llm_service

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME')

if not mongo_url or not db_name:
    raise ValueError("Missing required environment variables. Please ensure MONGO_URL and DB_NAME are set in your .env file.")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Get port from environment variable, default to 8000 if not set
PORT = int(os.environ.get("PORT", 8000))


# Create the main app without a prefix
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    yield
    # Shutdown logic
    client.close()

# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
# Define Chat Models
class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    sender: str
    text: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class UpdateConversationTitleRequest(BaseModel):
    new_title: str

# Initial root endpoint
class MessageCreate(BaseModel):
    conversation_id: str
    sender: str
    text: str
    model: str # Added to specify which model to use

class ConversationCreate(BaseModel):
    title: str = "New Chat" # Default title for new conversations

# Chat Endpoints
@api_router.post("/chat/message")
async def create_chat_message(input: MessageCreate, request: Request) -> StreamingResponse:
    # Retrieve conversation history for context
    conversation_history = []
    if input.conversation_id:
        messages_cursor = db.messages.find({"conversation_id": input.conversation_id}).sort("timestamp", 1)
        async for msg_doc in messages_cursor:
            # Map 'ai' sender to 'assistant' for LM Studio compatibility
            role = 'assistant' if msg_doc["sender"] in ['ai', 'assistant'] else msg_doc["sender"]
            content = msg_doc["text"]
            # If the message is from the assistant, strip out the <think> tags
            # before adding to the history for the LLM.
            if role == 'assistant':
                content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
            # Only append messages that have content. This prevents sending
            # empty assistant messages if the AI only returned a <think> block.
            if content:
                conversation_history.append({"role": role, "content": content})

    # Add the current user message to the history for LLM context, ensuring 'user' role
    conversation_history.append({"role": "user", "content": input.text})

    # Check if this is the first message in the conversation
    is_first_message = await db.messages.count_documents(
        {"conversation_id": input.conversation_id}
    ) == 0

    # Save user message immediately
    user_message_obj = Message(
        conversation_id=input.conversation_id,
        sender=input.sender,
        text=input.text
    )
    await db.messages.insert_one(user_message_obj.dict())

    # If it's the first message, update the conversation title
    if is_first_message:
        # Truncate the title to avoid excessively long names
        new_title = input.text[:20] + "..." if len(input.text) > 20 else input.text
        await db.conversations.update_one(
            {"id": input.conversation_id},
            {"$set": {"title": new_title, "last_updated": datetime.utcnow()}}
        )
    else:
        # Only update last_updated for subsequent messages
        await db.conversations.update_one(
            {"id": input.conversation_id},
            {"$set": {"last_updated": datetime.utcnow()}}
        )

    async def generate_and_stream_response():
        full_ai_response_content = ""
        try:
            async for chunk in llm_service.generate_response(input.model, conversation_history):
                if await request.is_disconnected():
                    logger.info("Client disconnected, stopping stream.")
                    break
                yield f"data: {chunk}\n\n" # Wrap chunk in SSE format
                full_ai_response_content += chunk
        except Exception as e:
            logger.error(f"Error during streaming LLM response: {e}")
            yield f"data: Error: Could not get response from LLM.\n\n"
            full_ai_response_content = "Error: Could not get response from LLM."
        finally:
            # Save AI response after streaming is complete or aborted, if we have content
            if full_ai_response_content:
                ai_message_obj = Message(
                    conversation_id=input.conversation_id,
                    sender="assistant",
                    text=full_ai_response_content
                )
                await db.messages.insert_one(ai_message_obj.dict())

                # Update conversation last_updated timestamp
                await db.conversations.update_one(
                    {"id": input.conversation_id},
                    {"$set": {"last_updated": datetime.utcnow()}}
                )

    return StreamingResponse(generate_and_stream_response(), media_type="text/event-stream")

@api_router.get("/chat/conversations", response_model=List[Conversation])
async def get_all_conversations():
    conversations = await db.conversations.find().sort("last_updated", -1).to_list(1000)
    return [Conversation(**conv) for conv in conversations]

@api_router.get("/chat/conversations/{conversation_id}/messages", response_model=List[Message])
async def get_conversation_messages(conversation_id: str):
    messages = await db.messages.find({"conversation_id": conversation_id}).sort("timestamp", 1).to_list(1000)
    return [Message(**msg) for msg in messages]

@api_router.post("/chat/new", response_model=Conversation)
async def create_new_conversation(input: ConversationCreate):
    new_conversation = Conversation(title=input.title)
    await db.conversations.insert_one(new_conversation.dict())
    return new_conversation

@api_router.put("/chat/conversations/{conversation_id}")
async def update_conversation_title(conversation_id: str, request: UpdateConversationTitleRequest):
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"title": request.new_title, "last_updated": datetime.utcnow()}}
    )
    return {"message": "Conversation title updated successfully"}

@api_router.delete("/chat/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    # Delete all messages associated with the conversation
    await db.messages.delete_many({"conversation_id": conversation_id})
    # Delete the conversation itself
    await db.conversations.delete_one({"id": conversation_id})
    return {"message": "Conversation deleted successfully"}

# LLM Service endpoint
@api_router.get("/llm/models")
async def get_llm_models():
    models = llm_service.get_available_models()
    return {"models": models}

@api_router.get("/")
async def root():
    return {"message": "Hello World"}

# Include the router in the main app
app.include_router(api_router)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
