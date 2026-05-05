from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

from backend.database import get_db
from backend.models import TokenData, User
from backend.config import config
from backend.services.auth.tokens import verify_password, get_password_hash

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

ALGORITHM = "HS256"
ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"


async def get_user(email: str):
    db = await get_db()
    user_doc = await db.users.find_one({"email": email})
    if user_doc:
        return User(**user_doc)
    return None


async def get_current_user(request: Request, token: Optional[str] = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # Try cookie first, then Authorization header
    if token is None:
        token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, config.secret_key, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception

    if token_data.email is None:
        raise credentials_exception

    user = await get_user(email=token_data.email)
    if user is None:
        raise credentials_exception
    return user