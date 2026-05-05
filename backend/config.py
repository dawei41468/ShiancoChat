import logging
from pathlib import Path
from typing import Optional, List, ClassVar
from urllib.parse import urlparse
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
from enum import Enum

logger = logging.getLogger(__name__)

class Environment(str, Enum):
    DEVELOPMENT = "development"
    PRODUCTION = "production"
    TESTING = "testing"

class AppConfig(BaseSettings):
    """Centralized configuration with environment variable support"""
    
    model_config: ClassVar[SettingsConfigDict] = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Core settings
    environment: Environment = Field(default=Environment.DEVELOPMENT)
    port: int = Field(default=8000)
    debug: bool = Field(default=False)
    secret_key: Optional[str] = Field(
        default=None,
        min_length=32,
        description="Required secret key (minimum 32 characters) for cryptographic operations"
    )
    allowed_hosts: List[str] = Field(default=["localhost"])
    cors_origins: List[str] = Field(
        default=["http://localhost:4141", "http://localhost:4100"],
        description="Allowed CORS origins"
    )
    
    # Database settings
    mongo_url: Optional[str] = Field(
        default=None,
        min_length=1,
        description="Required MongoDB connection URL"
    )
    db_name: Optional[str] = Field(
        default=None,
        min_length=1,
        description="Required database name"
    )
    
    # Authentication settings
    access_token_expire_minutes: int = Field(default=30)
    refresh_token_expire_days: int = Field(default=7)
    password_min_length: int = Field(default=12)
    
    # Search settings
    web_search: dict = Field(
        default={
            "default_engine": "duckduckgo",
            "bing_api_key": None,
            "sougou_api_key": None,
            "max_results": 5,
            "domain_filter": None
        },
        description="Web search configuration"
    )
    
    # LLM settings
    llm_base_url: Optional[str] = Field(
        default=None,
        min_length=1,
        description="Base URL for primary LLM API (OpenAI-compatible)"
    )
    llm_base_urls: Optional[List[str]] = Field(
        default=None,
        description="Optional list of LLM base URLs (comma-separated in env) for failover"
    )
    llm_request_timeout_seconds: int = Field(default=60)
    llm_max_retries: int = Field(default=2)
    llm_retry_backoff_seconds: float = Field(default=0.75)
    http_proxy: Optional[str] = Field(default=None)
    https_proxy: Optional[str] = Field(default=None)

    # RAG / Vector Search settings
    embedding_model_name: str = Field(
        default="all-MiniLM-L6-v2",
        description="Name of the sentence-transformers model to use for embeddings"
    )
    embedding_model_path: Optional[str] = Field(
        default=None,
        description="Optional explicit path to embedding model directory"
    )
    vector_search_enabled: bool = Field(
        default=False,
        description="Enable MongoDB Atlas Vector Search (requires Atlas cluster with vector index)"
    )
    vector_search_index: str = Field(
        default="vector_index",
        description="Name of the MongoDB Atlas vector search index"
    )
    rag_similarity_threshold: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity threshold for RAG results"
    )
    rag_top_k: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of top chunks to retrieve for RAG"
    )
    rag_mmr_lambda: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="MMR lambda: 1.0 = pure relevance, 0.0 = pure diversity"
    )
    hybrid_search_enabled: bool = Field(
        default=False,
        description="Enable hybrid search (vector + full-text). Requires text index on document_chunks.content"
    )
    hybrid_search_alpha: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Hybrid search weight: alpha * vector_score + (1-alpha) * text_score"
    )
    
    # Path configurations
    base_dir: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent)
    log_dir: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent / "logs")
    
    @field_validator("password_min_length")
    def validate_password_length(cls, v: int) -> int:
        if v < 8:
            raise ValueError("Password minimum length must be at least 8")
        return v

    def model_post_init(self, __context) -> None:
        """Validate required fields after initialization"""
        if not self.secret_key:
            raise ValueError("secret_key is required")
        if not self.mongo_url:
            raise ValueError("mongo_url is required")
        if not self.db_name:
            raise ValueError("db_name is required")
        # Allow either a single LLM base URL or a list of URLs for failover
        if not (self.llm_base_url or (self.llm_base_urls and len(self.llm_base_urls) > 0)):
            raise ValueError("At least one LLM base URL is required. Set LLM_BASE_URL or LLM_BASE_URLS in .env")

def _mask_url_credentials(url: str) -> str:
    """Mask username/password in a URL for safe logging."""
    if not url:
        return url
    try:
        parsed = urlparse(url)
        if parsed.password:
            netloc = parsed.netloc.replace(f":{parsed.password}@", ":****@")
            return url.replace(parsed.netloc, netloc)
    except Exception:
        pass
    return url


def load_config() -> AppConfig:
    """Initialize and return the application configuration"""
    # Load .env from backend directory explicitly
    env_path = Path(__file__).parent / '.env'
    logger.info(f"Loading environment variables from: {env_path}")
    load_dotenv(env_path)
    
    # Log environment variables
    import os
    for var in [
        'PORT', 'SECRET_KEY', 'MONGO_URL', 'DB_NAME',
        'LLM_BASE_URL', 'LLM_BASE_URLS',
        'LLM_REQUEST_TIMEOUT_SECONDS', 'LLM_MAX_RETRIES', 'LLM_RETRY_BACKOFF_SECONDS',
        'HTTP_PROXY', 'HTTPS_PROXY'
    ]:
        value = os.getenv(var)
        if var == 'SECRET_KEY' and value:
            value = '******'  # Mask secret key
        if var == 'MONGO_URL' and value:
            value = _mask_url_credentials(value)  # Mask credentials in MongoDB URL
        if var in ('HTTP_PROXY', 'HTTPS_PROXY') and value:
            value = 'Set'  # Avoid printing proxy URL or credentials
        logger.info(f"{var}: {value if value else 'Not set'}")
    
    try:
        return AppConfig()  # Will raise validation error if required fields are missing
    except Exception as e:
        raise ValueError(
            "Missing required configuration. Please ensure these environment variables are set:\n"
            "- SECRET_KEY\n"
            "- MONGO_URL\n"
            "- DB_NAME\n"
            "- LLM_BASE_URL"
        ) from e

# Global configuration instance
config = load_config()