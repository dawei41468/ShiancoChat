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
import uuid
import contextvars
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from backend.rate_limiter import limiter
from backend.config import config

_request_id_var = contextvars.ContextVar('request_id', default=None)

class RequestIdFilter(logging.Filter):
    """Inject request_id into log records."""
    def filter(self, record):
        record.request_id = _request_id_var.get() or '-'
        return True

# Load environment variables *before* other imports - quietly without logging
load_dotenv(ROOT_DIR / 'backend' / '.env', verbose=False)

# Set tokenizers parallelism to avoid warnings
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Only log environment variables if we're the main process (not reloader)
if os.environ.get('RUN_MAIN') == 'true' or not os.environ.get('WERKZEUG_RUN_MAIN'):
    from backend.database import close_mongo_connection, db
else:
    from backend.database import close_mongo_connection, init_client_with_retry
from backend.routers import chat, openai, auth, users, documents, tools
from backend.database import init_indexes, get_db
from backend.auth import get_current_user
from backend.models import User
logger.info(f"Imported routers: {[r.__name__ for r in [chat, openai, auth, users, documents, tools]]}")

# Get port from environment variable, default to 4100 if not set
PORT = int(os.environ.get("PORT", 4100))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic with retry
    await init_client_with_retry()
    await init_indexes()
    yield
    # Shutdown logic
    close_mongo_connection()

# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# --- API Endpoints that are not part of specific routers ---

@api_router.get("/llm/models")
@limiter.limit("30/minute")
async def get_llm_models(request: Request, current_user: User = Depends(get_current_user)):
    return await openai.fetch_models_from_llm()

@api_router.get("/health")
@limiter.limit("60/minute")
async def health_check(request: Request):
    """Health check endpoint that verifies MongoDB connectivity."""
    try:
        db = await get_db()
        await db.client.admin.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={"status": "unhealthy", "database": str(e)}
        )

@api_router.get("/")
@limiter.limit("60/minute")
async def root(request: Request):
    return {"message": "Hello World"}

# --- App Configuration ---

app.include_router(api_router)
app.include_router(openai.router, prefix="/api/openai")
app.include_router(chat.router, prefix="/api/chat")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(users.router, prefix="/api/users")
app.include_router(documents.router)
app.include_router(tools.router)
logger.info("Successfully mounted documents router")

from fastapi.routing import APIRoute

# Debug all registered routes
for route in app.routes:
    if isinstance(route, APIRoute):
        logger.info(f"Route: {route.path} (methods: {route.methods})")
    else:
        logger.info(f"Route: {route.__class__.__name__}")

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Generate and attach a correlation ID to every request."""
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    _request_id_var.set(request_id)
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    """Middleware to enforce a maximum request body size (10MB)."""
    content_length = request.headers.get("content-length")
    if content_length:
        content_length = int(content_length)
        if content_length > 10 * 1024 * 1024:  # 10MB
            return JSONResponse(
                {"detail": "Request entity too large"},
                status_code=413
            )
    return await call_next(request)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "0"
    return response


app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=config.allowed_hosts,
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=config.cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Structured logging with correlation IDs
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - [%(request_id)s] - %(message)s'
))
handler.addFilter(RequestIdFilter())

root_logger = logging.getLogger()
root_logger.handlers = []
root_logger.addHandler(handler)
root_logger.setLevel(logging.INFO)


if __name__ == "__main__":
    # NOTE: This block is for local development only.
    # Production deployments should use the `uvicorn` CLI directly:
    #   uvicorn backend.server:app --host 0.0.0.0 --port 4100 --workers 4
    # Do NOT use reload=True or --reload in production.
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
