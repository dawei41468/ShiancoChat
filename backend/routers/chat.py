from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List
from backend.database import get_db
from backend.models import Artifact, ArtifactCreate, ArtifactUpdate, Message, MessageSavePayload, Conversation, ConversationCreate, UpdateConversationTitleRequest, User, TitleGenerationRequest
from datetime import datetime, timezone
from backend import auth # Import auth module for get_current_user
from backend.rate_limiter import limiter
from backend.routers import openai as openai_router

router = APIRouter()

@router.post("/new", response_model=Conversation)
@limiter.limit("30/minute")
async def create_new_chat(
    request: Request,
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
        created_at=datetime.now(timezone.utc),
        last_updated=datetime.now(timezone.utc)
    )
    await db.conversations.insert_one(new_conversation.dict())
    return new_conversation

@router.get("/conversations", response_model=List[Conversation])
@limiter.limit("60/minute")
async def fetch_conversations(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    """
    Fetches all conversations for the current user with pagination.
    """
    conversations = await db.conversations.find({"user_email": current_user.email}).sort("last_updated", -1).skip(skip).limit(limit).to_list(length=None)
    return [Conversation(**conv) for conv in conversations]

@router.get("/conversations/{conversation_id}/messages", response_model=List[Message])
@limiter.limit("120/minute")
async def fetch_messages_for_conversation(
    request: Request,
    conversation_id: str,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    """
    Fetches messages for a specific conversation with pagination.
    """
    conversation = await db.conversations.find_one({"id": conversation_id, "user_email": current_user.email})
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found or not owned by user")

    messages = await db.messages.find({"conversation_id": conversation_id}).sort("timestamp", 1).skip(skip).limit(limit).to_list(length=None)
    return [Message(**msg) for msg in messages]

@router.get("/conversations/{conversation_id}/artifacts", response_model=List[Artifact])
@limiter.limit("120/minute")
async def fetch_artifacts_for_conversation(
    request: Request,
    conversation_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    conversation = await db.conversations.find_one({"id": conversation_id, "user_email": current_user.email})
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found or not owned by user")

    artifacts = await db.artifacts.find({
        "conversation_id": conversation_id,
        "user_email": current_user.email,
    }).sort("updated_at", -1).skip(skip).limit(limit).to_list(length=None)
    return [Artifact(**artifact) for artifact in artifacts]

@router.post("/artifacts", response_model=Artifact)
@limiter.limit("120/minute")
async def create_artifact(
    request: Request,
    artifact_data: ArtifactCreate,
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    conversation = await db.conversations.find_one({
        "id": artifact_data.conversation_id,
        "user_email": current_user.email,
    })
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found or not owned by user")

    if artifact_data.source_message_id:
        message = await db.messages.find_one({
            "id": artifact_data.source_message_id,
            "conversation_id": artifact_data.conversation_id,
        })
        if not message:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source message not found")

        existing = await db.artifacts.find_one({
            "conversation_id": artifact_data.conversation_id,
            "user_email": current_user.email,
            "source_message_id": artifact_data.source_message_id,
        })
        if existing:
            return Artifact(**existing)

    now = datetime.now(timezone.utc)
    artifact = Artifact(
        conversation_id=artifact_data.conversation_id,
        user_email=current_user.email,
        source_message_id=artifact_data.source_message_id,
        type=artifact_data.type,
        title=artifact_data.title,
        content=artifact_data.content,
        created_at=now,
        updated_at=now,
    )
    await db.artifacts.insert_one(artifact.dict())
    return artifact

@router.patch("/artifacts/{artifact_id}", response_model=Artifact)
@limiter.limit("120/minute")
async def update_artifact(
    request: Request,
    artifact_id: str,
    artifact_data: ArtifactUpdate,
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    existing = await db.artifacts.find_one({"id": artifact_id, "user_email": current_user.email})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")

    update_data = {}
    if artifact_data.title is not None:
        title = artifact_data.title.strip()
        if not title:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Artifact title is required")
        update_data["title"] = title
    if artifact_data.content is not None:
        update_data["content"] = artifact_data.content

    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.artifacts.update_one(
            {"id": artifact_id, "user_email": current_user.email},
            {"$set": update_data}
        )

    updated = await db.artifacts.find_one({"id": artifact_id, "user_email": current_user.email})
    return Artifact(**updated)

@router.delete("/artifacts/{artifact_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/minute")
async def delete_artifact(
    request: Request,
    artifact_id: str,
    current_user: User = Depends(auth.get_current_user),
    db=Depends(get_db)
):
    result = await db.artifacts.delete_one({"id": artifact_id, "user_email": current_user.email})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
    return

@router.post("/messages", response_model=Message)
@limiter.limit("120/minute")
async def save_message(
    request: Request,
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
        timestamp=message_data.timestamp or datetime.now(timezone.utc),
        thinking_duration=message_data.thinking_duration,
        citations=message_data.citations,
        web_search_state=message_data.web_search_state,
        rag_state=message_data.rag_state,
    )
    
    await db.messages.insert_one(new_message.dict())
    
    # Also update the conversation's last_updated timestamp
    await db.conversations.update_one(
        {"id": new_message.conversation_id},
        {"$set": {"last_updated": new_message.timestamp}}
    )
    
    return new_message

@router.put("/conversations/{conversation_id}", response_model=Conversation)
@limiter.limit("30/minute")
async def rename_conversation(
    request: Request,
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
        {"$set": {"title": update_data.new_title, "last_updated": datetime.now(timezone.utc)}}
    )
    
    updated_conversation = await db.conversations.find_one({"id": conversation_id})
    return Conversation(**updated_conversation)

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def delete_conversation(
    request: Request,
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
    await db.artifacts.delete_many({"conversation_id": conversation_id, "user_email": current_user.email})
    await db.conversations.delete_one({"id": conversation_id})
    return

@router.post("/conversations/{conversation_id}/generate-title")
@limiter.limit("30/minute")
async def generate_conversation_title(
    request: Request,
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
    
    # Fetch the first user message to generate a title
    first_user_message = await db.messages.find_one(
        {"conversation_id": conversation_id, "sender": "user"},
        sort=[("timestamp", 1)]
    )
    
    if first_user_message:
        message_text = first_user_message.get("text", "")
        messages = [{"role": "user", "content": message_text}]
        try:
            new_title = await openai_router.generate_title(messages, request_data.model)
        except Exception as e:
            logger.error(f"LLM title generation failed: {e}")
            words = message_text.split()
            summary = " ".join(words[:5])
            new_title = summary if len(words) <= 5 else f"{summary}..."
    else:
        new_title = f"AI Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}"

    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"title": new_title, "last_updated": datetime.now(timezone.utc)}}
    )
    return {"message": "Title generation initiated", "new_title": new_title}
