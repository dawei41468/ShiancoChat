from typing import Optional
from datetime import datetime, timezone
import hashlib
from jose import JWTError, jwt
from fastapi import HTTPException, status
from pydantic import EmailStr
from backend.models import User, RefreshToken
from backend.localization.departments import Department
from backend.services.auth.password import PasswordValidator
from backend.services.auth.tokens import get_password_hash
from backend.config import config
from backend.database import get_db

class UserService:
    @staticmethod
    def _hash_refresh_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    async def register_user(
        name: str,
        email: EmailStr,
        password: str,
        department: Department
    ) -> User:
        """Handle user registration business logic"""
        db = await get_db()
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
        db = await get_db()
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
        """Delete user and associated data from database"""
        db = await get_db()
        user_conversations = db.conversations.find({"user_email": email})
        conversation_ids = [conv["id"] async for conv in user_conversations]

        if conversation_ids:
            await db.messages.delete_many({"conversation_id": {"$in": conversation_ids}})
            await db.conversations.delete_many({"id": {"$in": conversation_ids}})

        user_docs = await db.documents.find({"user_email": email}).to_list(length=None)
        document_ids = [doc["_id"] for doc in user_docs]
        if document_ids:
            await db.document_chunks.delete_many({"document_id": {"$in": document_ids}})
            await db.documents.delete_many({"_id": {"$in": document_ids}})

        await db.refresh_tokens.update_many(
            {"email": email},
            {"$set": {"is_active": False}}
        )

        result = await db.users.delete_one({"email": email})
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

    @staticmethod
    async def get_user(email: str) -> Optional[User]:
        """Get user by email if exists"""
        db = await get_db()
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
    async def store_refresh_token(email: str, token: str, expires_at: datetime, jti: str) -> None:
        """Store refresh token in database"""
        db = await get_db()
        refresh_token = RefreshToken(
            token_hash=UserService._hash_refresh_token(token),
            jti=jti,
            email=email,
            expires_at=expires_at,
            is_active=True
        )
        await db.refresh_tokens.insert_one(refresh_token.dict())

    @staticmethod
    async def validate_refresh_token(token: str) -> Optional[RefreshToken]:
        """Validate refresh token and return token data if valid"""
        db = await get_db()
        try:
            payload = jwt.decode(token, str(config.secret_key), algorithms=["HS256"])
        except JWTError:
            return None

        if payload.get("type") != "refresh":
            return None

        email = payload.get("sub")
        jti = payload.get("jti")
        if not email or not jti:
            return None

        token_data = await db.refresh_tokens.find_one({
            "token_hash": UserService._hash_refresh_token(token),
            "email": email,
            "jti": jti,
            "is_active": True,
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        })
        if not token_data:
            return None
        return RefreshToken(**token_data)

    @staticmethod
    async def revoke_refresh_token(token: str) -> None:
        """Mark refresh token as inactive"""
        db = await get_db()
        await db.refresh_tokens.update_one(
            {"token_hash": UserService._hash_refresh_token(token)},
            {"$set": {"is_active": False}}
        )

    @staticmethod
    async def revoke_all_user_refresh_tokens(email: str) -> None:
        """Mark all refresh tokens for a user as inactive"""
        db = await get_db()
        await db.refresh_tokens.update_many(
            {"email": email},
            {"$set": {"is_active": False}}
        )
