from datetime import timedelta
from typing import Optional
from backend.services.auth.tokens import (
    create_access_token,
    create_refresh_token,
    verify_password
)
from backend.services.auth.users import UserService
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from backend.auth import get_current_user, ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from fastapi import Body
from backend.models import User, UserCreate, Token, UserUpdate, UserPublic
from backend.config import config as settings
from pydantic import BaseModel
from backend.rate_limiter import limiter

class RefreshToken(BaseModel):
    refresh_token: Optional[str] = None

router = APIRouter()

def _set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Set HttpOnly, Secure, SameSite cookies for tokens."""
    secure = settings.environment == "production"
    access_max_age = settings.access_token_expire_minutes * 60
    refresh_max_age = settings.refresh_token_expire_days * 24 * 60 * 60
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="strict",
        max_age=access_max_age,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="strict",
        max_age=refresh_max_age,
        path="/api/auth/refresh",
    )

def _clear_auth_cookies(response: Response):
    """Clear auth cookies."""
    response.delete_cookie(key=ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/api/auth/refresh")

@router.post("/register", response_model=UserPublic)
@limiter.limit("10/minute")
async def register(request: Request, form_data: UserCreate):
    try:
        user = await UserService.register_user(
            name=form_data.name,
            email=form_data.email,
            password=form_data.password,
            department=form_data.department
        )
        # Return public view
        return UserPublic(**user.dict(exclude={"hashed_password"}))
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login_for_access_token(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends()):
    user = await UserService.get_user(form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    refresh_token, expires_at, jti = create_refresh_token(user.email)
    await UserService.store_refresh_token(user.email, refresh_token, expires_at, jti)
    _set_auth_cookies(response, access_token, refresh_token)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token
    }

@router.post("/refresh", response_model=Token)
@limiter.limit("20/minute")
async def refresh_access_token(request: Request, response: Response, refresh: RefreshToken = Body(None)):
    # Prefer body for backward compatibility, fall back to cookie
    refresh_token = refresh.refresh_token if refresh else None
    if refresh_token is None:
        refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = await UserService.validate_refresh_token(refresh_token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": token_data.email}, expires_delta=access_token_expires
    )
    await UserService.revoke_refresh_token(refresh_token)
    new_refresh_token, expires_at, jti = create_refresh_token(token_data.email)
    await UserService.store_refresh_token(token_data.email, new_refresh_token, expires_at, jti)
    _set_auth_cookies(response, access_token, new_refresh_token)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": new_refresh_token,
    }


@router.get("/users/me", response_model=UserPublic)
@limiter.limit("60/minute")
async def read_users_me(request: Request, current_user: User = Depends(get_current_user)):
   return UserPublic(**current_user.dict(exclude={"hashed_password"}))

@router.patch("/users/me", response_model=UserPublic)
@limiter.limit("30/minute")
async def update_user_me(request: Request, user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    # Convert current_user to a dictionary, update fields, then convert back to User model
    user_data = current_user.dict()
    update_data = user_update.dict(exclude_unset=True)

    for field, value in update_data.items():
        user_data[field] = value
    
    updated_user = User(**user_data)
    
    # Update and return updated user
    updated_user = await UserService.update_user(current_user.email, update_data)
    return UserPublic(**updated_user.dict(exclude={"hashed_password"}))

@router.post("/logout")
@limiter.limit("20/minute")
async def logout(request: Request, response: Response, current_user: User = Depends(get_current_user)):
    """Revoke all refresh tokens for the current user."""
    await UserService.revoke_all_user_refresh_tokens(current_user.email)
    _clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_user_me(request: Request, current_user: User = Depends(get_current_user)):
    await UserService.delete_user(current_user.email)
    return {"message": "Account deleted successfully"}
