import sys
from pathlib import Path
import logging
# Add the project root to the Python path to resolve import issues
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))
logger = logging.getLogger(__name__)

import os
import logging
import re
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException
from starlette.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address

# Load environment variables *before* other imports - quietly without logging
load_dotenv(ROOT_DIR / 'backend' / '.env', verbose=False)

# Set tokenizers parallelism to avoid warnings
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Only log environment variables if we're the main process (not reloader)
if os.environ.get('RUN_MAIN') == 'true' or not os.environ.get('WERKZEUG_RUN_MAIN'):
    from backend.database import close_mongo_connection
else:
    from backend.database import close_mongo_connection
from routers import chat, openai, auth, users, documents
logger.info(f"Imported routers: {[r.__name__ for r in [chat, openai, auth, users, documents]]}")

# Get port from environment variable, default to 4100 if not set
PORT = int(os.environ.get("PORT", 4100))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    yield
    # Shutdown logic
    close_mongo_connection()

# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)
limiter = Limiter(key_func=get_remote_address)

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
app.include_router(openai.router, prefix="/api/openai")
app.include_router(chat.router, prefix="/api/chat")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(users.router, prefix="/api/users")
app.include_router(documents.router)
logger.info("Successfully mounted documents router")

from fastapi.routing import APIRoute

# Debug all registered routes
for route in app.routes:
    if isinstance(route, APIRoute):
        logger.info(f"Route: {route.path} (methods: {route.methods})")
    else:
        logger.info(f"Route: {route.__class__.__name__}")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["http://localhost:4141", "http://localhost:4100"], # Allowed origins
    allow_methods=["*"],
    allow_headers=["*", "Authorization"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT,
        reload=True,
        log_level="info",
        log_config={
            "version": 1,
            "disable_existing_loggers": False,
            "loggers": {
                "uvicorn": {"level": "INFO"},
                "uvicorn.error": {"level": "INFO"},
                "uvicorn.access": {"level": "INFO"},
                "uvicorn.asgi": {"level": "CRITICAL"}
            }
        }
    )
