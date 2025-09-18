from pathlib import Path
from typing import Optional, List, ClassVar
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
from enum import Enum

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

def load_config() -> AppConfig:
    """Initialize and return the application configuration"""
    # Load .env from backend directory explicitly
    env_path = Path(__file__).parent / '.env'
    print(f"Loading environment variables from: {env_path}")
    load_dotenv(env_path)
    
    # Log environment variables
    import os
    print("Environment variables:")
    for var in [
        'PORT', 'SECRET_KEY', 'MONGO_URL', 'DB_NAME',
        'LLM_BASE_URL', 'LLM_BASE_URLS',
        'LLM_REQUEST_TIMEOUT_SECONDS', 'LLM_MAX_RETRIES', 'LLM_RETRY_BACKOFF_SECONDS',
        'HTTP_PROXY', 'HTTPS_PROXY'
    ]:
        value = os.getenv(var)
        if var == 'SECRET_KEY' and value:
            value = '******'  # Mask secret key
        if var in ('HTTP_PROXY', 'HTTPS_PROXY') and value:
            value = 'Set'  # Avoid printing proxy URL or credentials
        print(f"{var}: {value if value else 'Not set'}")
    
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