import sys
from pathlib import Path

# Add the project root to the Python path to resolve import issues
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))

import os
import logging
import re
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException
from starlette.middleware.cors import CORSMiddleware

# Load environment variables *before* other imports
load_dotenv(ROOT_DIR / 'backend' / '.env')

from backend.database import db, close_mongo_connection
from backend.models import Conversation, ConversationCreate, Message, UpdateConversationTitleRequest, TitleGenerationRequest
from routers import chat, ollama, openai, auth

# Get port from environment variable, default to 8000 if not set
PORT = int(os.environ.get("PORT", 8000))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    yield
    # Shutdown logic
    close_mongo_connection()

# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# --- Helper Functions ---

async def _generate_title_from_messages(messages: List[Message], model: str):
    """
    Generates a title from the first two messages of a conversation using the specified model.
    """
    if len(messages) < 2:
        return "New Chat"

    # 1. Prepare the context, cleaning assistant messages
    context = []
    for msg in messages[:2]:
        role = msg.sender
        content = msg.text
        if role == "assistant":
            clean_content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)
            content = re.sub(r'<answer>|</answer>', '', clean_content, flags=re.DOTALL).strip()
        context.append({"role": role, "content": content})

    # 2. Dynamically select the title generation function
    if model.startswith("ollama/"):
        title_generator = ollama.generate_title
    else:
        title_generator = openai.generate_title

    # 3. Generate the raw title
    raw_title = await title_generator(context, model)

    # 4. Clean the final title to remove any <think> tags and return
    final_title = re.sub(r'<think>.*?</think>', '', raw_title, flags=re.DOTALL).strip()
    
    return final_title

# --- API Endpoints ---

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

@api_router.post("/chat/conversations/{conversation_id}/generate-title")
async def generate_and_update_title(conversation_id: str, request: TitleGenerationRequest):
    messages_cursor = await db.messages.find({"conversation_id": conversation_id}).sort("timestamp", 1).to_list(2)
    if len(messages_cursor) < 2:
        raise HTTPException(status_code=400, detail="Not enough messages to generate a title.")
    
    message_objects = [Message(**msg) for msg in messages_cursor]
    new_title = await _generate_title_from_messages(message_objects, request.model)
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"title": new_title, "last_updated": datetime.utcnow()}}
    )
    return {"title": new_title}

@api_router.delete("/chat/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    await db.messages.delete_many({"conversation_id": conversation_id})
    await db.conversations.delete_one({"id": conversation_id})
    return {"message": "Conversation deleted successfully"}

@api_router.get("/llm/models")
async def get_llm_models():
    return await openai.get_models()

@api_router.get("/")
async def root():
    return {"message": "Hello World"}

# --- App Configuration ---

app.include_router(api_router)
app.include_router(ollama.router, prefix="/api/ollama")
app.include_router(openai.router, prefix="/api/openai")
app.include_router(chat.router, prefix="/api/chat")
app.include_router(auth.router, prefix="/api/auth")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
