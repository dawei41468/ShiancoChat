from typing import Optional, Tuple
from datetime import datetime
from fastapi import HTTPException, status
from pydantic import EmailStr
from backend.models import User, RefreshToken
from backend.localization.departments import Department
from backend.services.auth.password import PasswordValidator
from backend.services.auth.tokens import get_password_hash
from backend.config import config
from backend.database import db

class UserService:
    @staticmethod
    async def register_user(
        name: str,
        email: EmailStr,
        password: str,
        department: Department
    ) -> User:
        """Handle user registration business logic"""
        if not PasswordValidator.validate_complexity(password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password does not meet complexity requirements"
            )
        # Check for duplicate email
        existing = await db.users.find_one({"email": email})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        hashed_password = get_password_hash(password)
        user = User(
            name=name,
            email=email,
            hashed_password=hashed_password,
            department=department
        )
        await db.users.insert_one(user.dict())
        return user

    @staticmethod
    async def update_user(email: str, update_data: dict) -> User:
        """Update user in database"""
        result = await db.users.update_one(
            {"email": email},
            {"$set": update_data}
        )
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return await UserService.get_user_or_404(email)

    @staticmethod
    async def delete_user(email: str) -> None:
        """Delete user from database"""
        result = await db.users.delete_one({"email": email})
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

    @staticmethod
    async def get_user(email: str) -> Optional[User]:
        """Get user by email if exists"""
        user_data = await db.users.find_one({"email": email})
        return User(**user_data) if user_data else None

    @staticmethod
    async def get_user_or_404(email: str) -> User:
        """Get user by email or raise 404"""
        user = await UserService.get_user(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user

    @staticmethod
    async def store_refresh_token(email: str, token: str, expires_at: datetime) -> None:
        """Store refresh token in database"""
        refresh_token = RefreshToken(
            token=token,
            email=email,
            expires_at=expires_at,
            is_active=True
        )
        await db.refresh_tokens.insert_one(refresh_token.dict())

    @staticmethod
    async def validate_refresh_token(token: str) -> Optional[RefreshToken]:
        """Validate refresh token and return token data if valid"""
        token_data = await db.refresh_tokens.find_one({
            "token": token,
            "is_active": True,
            "expires_at": {"$gt": datetime.utcnow()}
        })
        if not token_data:
            return None
        return RefreshToken(**token_data)

    @staticmethod
    async def revoke_refresh_token(token: str) -> None:
        """Mark refresh token as inactive"""
        await db.refresh_tokens.update_one(
            {"token": token},
            {"$set": {"is_active": False}}
        )