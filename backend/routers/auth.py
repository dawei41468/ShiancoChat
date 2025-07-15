from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from backend import auth
from backend.database import db, delete_user

from backend.models import User, UserCreate, Token, UserUpdate

router = APIRouter()


@router.post("/register", response_model=User)
async def register(form_data: UserCreate):
    existing_user = await auth.get_user(form_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    hashed_password = auth.get_password_hash(form_data.password)
    user_data = form_data.dict()
    user_data["hashed_password"] = hashed_password
    del user_data["password"]
    
    new_user = User(**user_data)
    await db.users.insert_one(new_user.dict())
    return new_user


@router.post("/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await auth.get_user(form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(auth.get_current_user)):
   return current_user

@router.patch("/users/me", response_model=User)
async def update_user_me(user_update: UserUpdate, current_user: User = Depends(auth.get_current_user)):
    # Convert current_user to a dictionary, update fields, then convert back to User model
    user_data = current_user.dict()
    update_data = user_update.dict(exclude_unset=True)

    for field, value in update_data.items():
        user_data[field] = value
    
    updated_user = User(**user_data)
    
    # Update the user in the database
    await db.users.update_one(
        {"email": current_user.email},
        {"$set": updated_user.dict(by_alias=True, exclude_unset=True)}
    )
    
    return updated_user

@router.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_me(current_user: User = Depends(auth.get_current_user)):
    await delete_user(current_user.email)
    return {"message": "Account deleted successfully"}