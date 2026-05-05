from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import ToolAuditEvent, ToolConfig, ToolConfigUpdate, User, UserRole
from backend.rate_limiter import limiter

router = APIRouter(prefix="/api/tools", tags=["tools"])

DEFAULT_TOOLS = [
    {
        "id": "web_search",
        "label": "Web Search",
        "description": "Searches external web sources for current information.",
        "enabled": True,
        "allowed_roles": [UserRole.USER, UserRole.ADMIN],
        "default_enabled": False,
    },
    {
        "id": "file_search",
        "label": "File Search",
        "description": "Retrieves source chunks from knowledge spaces and uploaded documents.",
        "enabled": True,
        "allowed_roles": [UserRole.USER, UserRole.ADMIN],
        "default_enabled": True,
    },
]


async def ensure_default_tools(db):
    for tool in DEFAULT_TOOLS:
        existing = await db.tool_configs.find_one({"id": tool["id"]})
        if not existing:
            now = datetime.now(timezone.utc)
            await db.tool_configs.insert_one({
                **tool,
                "updated_at": now,
            })


async def get_tool_config(db, tool_id: str) -> dict:
    await ensure_default_tools(db)
    tool = await db.tool_configs.find_one({"id": tool_id})
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    return tool


def user_can_use_tool(tool: dict, current_user: User) -> bool:
    allowed_roles = tool.get("allowed_roles") or []
    return bool(tool.get("enabled")) and current_user.role in allowed_roles


async def assert_tool_allowed(db, tool_id: str, current_user: User) -> dict:
    tool = await get_tool_config(db, tool_id)
    if not user_can_use_tool(tool, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{tool.get('label', tool_id)} is disabled for your role",
        )
    return tool


async def record_tool_audit(
    db,
    *,
    tool_id: str,
    current_user: User,
    conversation_id: str | None,
    status: str,
    latency_ms: int | None = None,
    details: dict | None = None,
):
    event = ToolAuditEvent(
        tool_id=tool_id,
        user_email=current_user.email,
        conversation_id=conversation_id,
        status=status,
        latency_ms=latency_ms,
        details=details,
    )
    await db.tool_audit_events.insert_one(event.dict())
    return event


@router.get("", response_model=List[ToolConfig])
@limiter.limit("60/minute")
async def list_tools(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    await ensure_default_tools(db)
    tools = await db.tool_configs.find().sort("label", 1).skip(skip).limit(limit).to_list(length=None)
    if current_user.role != UserRole.ADMIN:
        tools = [tool for tool in tools if user_can_use_tool(tool, current_user)]
    return [ToolConfig(**tool) for tool in tools]


@router.patch("/{tool_id}", response_model=ToolConfig)
@limiter.limit("30/minute")
async def update_tool(
    request: Request,
    tool_id: str,
    tool_update: ToolConfigUpdate,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update tools")

    await get_tool_config(db, tool_id)
    update_data = {}
    if tool_update.enabled is not None:
        update_data["enabled"] = tool_update.enabled
    if tool_update.allowed_roles is not None:
        update_data["allowed_roles"] = tool_update.allowed_roles
    if tool_update.default_enabled is not None:
        update_data["default_enabled"] = tool_update.default_enabled

    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.tool_configs.update_one({"id": tool_id}, {"$set": update_data})

    updated = await db.tool_configs.find_one({"id": tool_id})
    return ToolConfig(**updated)


@router.get("/audit", response_model=List[ToolAuditEvent])
@limiter.limit("60/minute")
async def list_tool_audit_events(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view tool audit events")

    events = await db.tool_audit_events.find().sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)
    return [ToolAuditEvent(**event) for event in events]
