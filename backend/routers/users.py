from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase # Import the correct type hint

from backend.database import get_db
from backend.models import User, UserRole, UserRoleUpdate, UserPublic # Import UserRoleUpdate
from backend.auth import get_current_user
from backend.rate_limiter import limiter
from backend.services.auth.users import UserService
from pymongo import ReturnDocument

router = APIRouter(
    tags=["users"],
)

@router.get("", response_model=List[UserPublic])
@limiter.limit("30/minute")
async def get_all_users(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access user data"
        )
    users_data = await db.users.find().skip(skip).limit(limit).to_list(length=None)
    users = [UserPublic(**User(**user_data).dict(exclude={"hashed_password"})) for user_data in users_data]
    return users

@router.patch("/{user_id}/role", response_model=UserPublic)
@limiter.limit("30/minute")
async def update_user_role(
    request: Request,
    user_id: str,
    role_update: UserRoleUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to change user roles"
        )
    
    # Ensure an admin cannot change their own role or demote themselves
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins cannot change their own role"
        )

    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    updated_user_data = await db.users.find_one_and_update(
        {"id": user_id},
        {"$set": {"role": role_update.role}},
        return_document=ReturnDocument.AFTER
    )
    return UserPublic(**User(**updated_user_data).dict(exclude={"hashed_password"}))

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def delete_user_endpoint(
    request: Request,
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete users"
        )
    
    # Prevent admin from deleting their own account
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins cannot delete their own account"
        )

    # Find the user to get their email for the delete_user function
    user_to_delete = await db.users.find_one({"id": user_id})
    if not user_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    await UserService.delete_user(user_to_delete["email"])
    return {"message": "User and associated data deleted successfully"}
