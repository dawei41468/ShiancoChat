from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    sender: str
    text: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    thinking_duration: Optional[float] = None

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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