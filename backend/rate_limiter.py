from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request
from jose import jwt, JWTError
from backend.config import config

def get_rate_limit_key(request: Request) -> str:
    """Extract user email from JWT for per-user rate limiting, fallback to IP."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = jwt.decode(token, config.secret_key, algorithms=["HS256"])
            email = payload.get("sub")
            if email:
                return email
        except JWTError:
            pass
    return get_remote_address(request)

limiter = Limiter(key_func=get_rate_limit_key)
