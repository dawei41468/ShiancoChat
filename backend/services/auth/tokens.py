from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
from passlib.context import CryptContext
from backend.config import config

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=config.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    if not config.secret_key:
        raise ValueError("Secret key is not configured")
    return jwt.encode(to_encode, str(config.secret_key), algorithm="HS256")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hashed version"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)

def create_refresh_token() -> tuple[str, datetime]:
    """Create refresh token with expiration"""
    expires_at = datetime.now(timezone.utc) + timedelta(days=config.refresh_token_expire_days)
    token = jwt.encode(
        {"exp": expires_at},
        str(config.secret_key),
        algorithm="HS256"
    )
    return token, expires_at

__all__ = [
    'create_access_token',
    'create_refresh_token',
    'verify_password',
    'get_password_hash'
]