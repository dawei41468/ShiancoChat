from pydantic import BaseModel, Field
from typing import Optional, List
import uuid
from datetime import datetime, timezone
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
   created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
   language: str = "zh"

   @property
   def department_display_name(self) -> str:
       from backend.localization.departments import get_department_name
       return get_department_name(self.department, self.language)

class UserPublic(BaseModel):
   """Public-facing user model without sensitive fields."""
   id: str
   name: str
   email: str
   department: Department
   role: UserRole = UserRole.USER
   created_at: datetime
   language: str = "zh"

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
   token_hash: str
   jti: str
   email: str
   expires_at: datetime
   is_active: bool = True
   created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    sender: str
    text: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    thinking_duration: Optional[float] = None
    citations: Optional[List[dict]] = None
    web_search_state: Optional[str] = None
    rag_state: Optional[str] = None

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_email: str # Link to the user who owns this conversation
    title: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    citations: Optional[List[dict]] = None
    web_search_state: Optional[str] = None
    rag_state: Optional[str] = None

class Artifact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    user_email: str
    source_message_id: Optional[str] = None
    type: str
    title: str
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ArtifactCreate(BaseModel):
    conversation_id: str
    source_message_id: Optional[str] = None
    type: str
    title: str
    content: str

class ArtifactUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class ToolConfig(BaseModel):
    id: str
    label: str
    description: Optional[str] = None
    enabled: bool = True
    allowed_roles: List[UserRole] = Field(default_factory=lambda: [UserRole.USER, UserRole.ADMIN])
    default_enabled: bool = False
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ToolConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    allowed_roles: Optional[List[UserRole]] = None
    default_enabled: Optional[bool] = None

class ToolAuditEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tool_id: str
    user_email: str
    conversation_id: Optional[str] = None
    status: str
    latency_ms: Optional[int] = None
    details: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Payload for INITIATING a stream from the frontend
class StreamRequestPayload(BaseModel):
    conversation_id: str
    text: str
    model: str # Model is required to know which LLM to call
    web_search_enabled: Optional[bool] = False
    rag_enabled: Optional[bool] = False
    knowledge_space_id: Optional[str] = None
class TitleGenerationRequest(BaseModel):
    model: str

class DocumentChunk(BaseModel):
    """Model for storing document chunks and embeddings"""
    document_id: str
    knowledge_space_id: Optional[str] = None
    chunk_index: int
    content: str
    embedding: Optional[List[float]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Document(BaseModel):
    """Model for storing uploaded documents and their extracted text"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    user_email: Optional[str] = None
    knowledge_space_id: Optional[str] = None
    content: str
    content_type: str
    expires_at: datetime
    conversation_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    chunk_count: int = 0

class KnowledgeSpace(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    owner_email: str
    scope: str = "user"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    document_count: int = 0

class KnowledgeSpaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    scope: str = "user"

class KnowledgeSpaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
