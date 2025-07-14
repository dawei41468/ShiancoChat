from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.database import get_db
from backend.models import Message, MessageSavePayload
from datetime import datetime

router = APIRouter()

@router.post("/messages", response_model=Message)
async def save_message(message_data: MessageSavePayload, db=Depends(get_db)):
    """
    Saves a user or assistant message to the database and returns it.
    """
    new_message = Message(
        conversation_id=message_data.conversation_id,
        sender=message_data.sender,
        text=message_data.text,
        timestamp=message_data.timestamp or datetime.utcnow(),
        thinking_duration=message_data.thinking_duration
    )
    
    await db.messages.insert_one(new_message.dict())
    
    # Also update the conversation's last_updated timestamp
    await db.conversations.update_one(
        {"id": new_message.conversation_id},
        {"$set": {"last_updated": new_message.timestamp}}
    )
    
    return new_message