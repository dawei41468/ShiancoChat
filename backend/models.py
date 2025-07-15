from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from enum import Enum

class Department(str, Enum):
   SENIOR_MANAGEMENT = "高层管理"
   GENERAL_OFFICE = "总经办"
   XISHAN_HOME = "锡山家居"
   KAKA_TIME = "咖咖时光"
   AGIO_BUSINESS = "Agio 业务"
   AGIO_RD = "Agio 研发"
   PRODUCTION_DEPT = "生产事业部"

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

class UserCreate(BaseModel):
   name: str
   email: str
   password: str
   department: Department

class UserUpdate(BaseModel):
   name: Optional[str] = None

class Token(BaseModel):
   access_token: str
   token_type: str

class TokenData(BaseModel):
   email: Optional[str] = None

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
class TitleGenerationRequest(BaseModel):
    model: str