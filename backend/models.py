from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime
from enum import Enum
from backend.localization.departments import Department, get_department_name

class UserRole(str, Enum):
    USER = "User"
    ADMIN = "Admin"

class User(BaseModel):
   id: str = Field(default_factory=lambda: str(uuid.uuid4()))
   name: str
   email: str
   hashed_password: str
   department: Department
   role: UserRole = UserRole.USER
   created_at: datetime = Field(default_factory=datetime.utcnow)
   language: str = "zh"

   @property
   def department_display_name(self) -> str:
       from backend.localization.departments import get_department_name
       return get_department_name(self.department, self.language)

class UserCreate(BaseModel):
   name: str
   email: str
   password: str
   department: Department

class UserUpdate(BaseModel):
   name: Optional[str] = None

class UserRoleUpdate(BaseModel):
   role: UserRole

class Token(BaseModel):
   access_token: str
   token_type: str
   refresh_token: Optional[str] = None

class TokenData(BaseModel):
   email: Optional[str] = None

class RefreshToken(BaseModel):
   token: str = Field(default_factory=lambda: str(uuid.uuid4()))
   email: str
   expires_at: datetime
   is_active: bool = True
   created_at: datetime = Field(default_factory=datetime.utcnow)

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    sender: str
    text: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    thinking_duration: Optional[float] = None

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_email: str # Link to the user who owns this conversation
    title: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class UpdateConversationTitleRequest(BaseModel):
    new_title: str

class ConversationCreate(BaseModel):
    title: str = "New Chat"

# Payload for SAVING a message to the DB
class MessageSavePayload(BaseModel):
    conversation_id: str
    sender: str
    text: str
    timestamp: Optional[datetime] = None
    thinking_duration: Optional[float] = None

# Payload for INITIATING a stream from the frontend
class StreamRequestPayload(BaseModel):
    conversation_id: str
    text: str
    model: str # Model is required to know which LLM to call
    web_search_enabled: Optional[bool] = False
class TitleGenerationRequest(BaseModel):
    model: str