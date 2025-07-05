from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.responses import StreamingResponse
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, AsyncGenerator
import uuid
from datetime import datetime
from llm_service import llm_service


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
async def create_chat_message(input: MessageCreate) -> StreamingResponse:
    # Retrieve conversation history for context
    conversation_history = []
    if input.conversation_id:
        messages_cursor = db.messages.find({"conversation_id": input.conversation_id}).sort("timestamp", 1)
        async for msg_doc in messages_cursor:
            # Map 'ai' sender to 'assistant' for LM Studio compatibility
            role = 'assistant' if msg_doc["sender"] == 'ai' else msg_doc["sender"]
            conversation_history.append({"role": role, "content": msg_doc["text"]})

    # Add the current user message to the history for LLM context, ensuring 'user' role
    conversation_history.append({"role": "user", "content": input.text})

    # Save user message immediately
    user_message_obj = Message(
        conversation_id=input.conversation_id,
        sender=input.sender,
        text=input.text
    )
    await db.messages.insert_one(user_message_obj.dict())

    async def generate_and_stream_response():
        full_ai_response_content = ""
        try:
            async for chunk in llm_service.generate_response(input.model, conversation_history):
                yield f"data: {chunk}\n\n" # Wrap chunk in SSE format
                full_ai_response_content += chunk
        except Exception as e:
            logger.error(f"Error during streaming LLM response: {e}")
            yield f"data: Error: Could not get response from LLM.\n\n"
            full_ai_response_content = "Error: Could not get response from LLM."
        finally:
            # Save AI response after streaming is complete
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
