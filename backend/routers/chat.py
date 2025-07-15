from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List
from backend.database import get_db
from backend.models import Message, MessageSavePayload, Conversation, ConversationCreate, UpdateConversationTitleRequest, User, TitleGenerationRequest
from datetime import datetime
from backend import auth # Import auth module for get_current_user

router = APIRouter()

@router.post("/new", response_model=Conversation)
async def create_new_chat(
    conversation_data: ConversationCreate,
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    """
    Creates a new conversation for the current user.
    """
    new_conversation = Conversation(
        title=conversation_data.title,
        user_email=current_user.email, # Assign conversation to the current user
        created_at=datetime.utcnow(),
        last_updated=datetime.utcnow()
    )
    await db.conversations.insert_one(new_conversation.dict())
    return new_conversation

@router.get("/conversations", response_model=List[Conversation])
async def fetch_conversations(
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    """
    Fetches all conversations for the current user.
    """
    conversations = await db.conversations.find({"user_email": current_user.email}).sort("last_updated", -1).to_list(1000)
    return [Conversation(**conv) for conv in conversations]

@router.get("/conversations/{conversation_id}/messages", response_model=List[Message])
async def fetch_messages_for_conversation(
    conversation_id: str,
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    """
    Fetches messages for a specific conversation, ensuring it belongs to the current user.
    """
    conversation = await db.conversations.find_one({"id": conversation_id, "user_email": current_user.email})
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found or not owned by user")
    
    messages = await db.messages.find({"conversation_id": conversation_id}).sort("timestamp", 1).to_list(1000)
    return [Message(**msg) for msg in messages]

@router.post("/messages", response_model=Message)
async def save_message(
    message_data: MessageSavePayload,
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    """
    Saves a user or assistant message to the database and returns it, ensuring conversation ownership.
    """
    # Verify conversation ownership
    conversation = await db.conversations.find_one({"id": message_data.conversation_id, "user_email": current_user.email})
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found or not owned by user")

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

@router.put("/conversations/{conversation_id}", response_model=Conversation)
async def rename_conversation(
    conversation_id: str,
    update_data: UpdateConversationTitleRequest,
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    """
    Renames a conversation, ensuring it belongs to the current user.
    """
    existing_conversation = await db.conversations.find_one({"id": conversation_id, "user_email": current_user.email})
    if not existing_conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found or not owned by user")
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"title": update_data.new_title, "last_updated": datetime.utcnow()}}
    )
    
    updated_conversation = await db.conversations.find_one({"id": conversation_id})
    return Conversation(**updated_conversation)

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    """
    Deletes a conversation and its associated messages, ensuring it belongs to the current user.
    """
    conversation = await db.conversations.find_one({"id": conversation_id, "user_email": current_user.email})
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found or not owned by user")
    
    await db.messages.delete_many({"conversation_id": conversation_id})
    await db.conversations.delete_one({"id": conversation_id})
    return

@router.post("/conversations/{conversation_id}/generate-title")
async def generate_conversation_title(
    conversation_id: str,
    request_data: TitleGenerationRequest,
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    """
    Generates a title for a conversation based on its messages, ensuring it belongs to the current user.
    """
    conversation = await db.conversations.find_one({"id": conversation_id, "user_email": current_user.email})
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found or not owned by user")
    
    # Placeholder for actual title generation logic
    # In a real scenario, this would call an LLM to generate a title
    # For now, we'll just update the title with a generic one
    new_title = f"AI Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"title": new_title, "last_updated": datetime.utcnow()}}
    )
    return {"message": "Title generation initiated", "new_title": new_title}