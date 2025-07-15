from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase # Import the correct type hint

from backend.database import get_db, delete_user
from backend.models import User, UserRole, UserRoleUpdate # Import UserRoleUpdate
from backend.auth import get_current_user

router = APIRouter(
    tags=["users"],
)

@router.get("", response_model=List[User])
async def get_all_users(db: AsyncIOMotorDatabase = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access user data"
        )
    users_data = await db.users.find().to_list(length=None)
    users = [User(**user_data) for user_data in users_data]
    return users

@router.patch("/{user_id}/role", response_model=User)
async def update_user_role(
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
        return_document=True
    )
    return User(**updated_user_data)

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_endpoint(
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
    
    await delete_user(user_email=user_to_delete["email"])
    return {"message": "User and associated data deleted successfully"}
