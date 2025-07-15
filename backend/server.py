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

from backend.database import close_mongo_connection
from routers import chat, ollama, openai, auth, users

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

# --- API Endpoints that are not part of specific routers ---

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
app.include_router(users.router, prefix="/api/users")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["http://localhost:4141"], # Specific origin for frontend
    allow_methods=["*"],
    allow_headers=["*", "Authorization"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
