from datetime import timedelta
from backend.services.auth.tokens import (
    create_access_token,
    create_refresh_token,
    verify_password
)
from backend.services.auth.users import UserService
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from backend.auth import get_current_user
from fastapi import Body
from backend.models import User, UserCreate, Token, UserUpdate
from backend.config import config as settings
from pydantic import BaseModel

class RefreshToken(BaseModel):
    refresh_token: str

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

@router.post("/register", response_model=User)
@limiter.limit("5/minute")
async def register(request: Request, form_data: UserCreate):
    try:
        return await UserService.register_user(
            name=form_data.name,
            email=form_data.email,
            password=form_data.password,
            department=form_data.department
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
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
    refresh_token, expires_at = create_refresh_token()
    await UserService.store_refresh_token(user.email, refresh_token, expires_at)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token
    }

@router.post("/refresh", response_model=Token)
@limiter.limit("5/minute")
async def refresh_access_token(request: Request, refresh: RefreshToken = Body(...)):
    token_data = await UserService.validate_refresh_token(refresh.refresh_token)
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
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
   return current_user

@router.patch("/users/me", response_model=User)
async def update_user_me(user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    # Convert current_user to a dictionary, update fields, then convert back to User model
    user_data = current_user.dict()
    update_data = user_update.dict(exclude_unset=True)

    for field, value in update_data.items():
        user_data[field] = value
    
    updated_user = User(**user_data)
    
    # Update and return updated user
    updated_user = await UserService.update_user(current_user.email, update_data)
    return updated_user
    
    return updated_user

@router.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_me(current_user: User = Depends(get_current_user)):
    await UserService.delete_user(current_user.email)
    return {"message": "Account deleted successfully"}