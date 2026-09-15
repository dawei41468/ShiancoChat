from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import Assistant, AssistantCreate, AssistantUpdate, User, UserRole
from backend.rate_limiter import limiter
from backend.routers.documents import _department_value

router = APIRouter(prefix="/api/assistants", tags=["assistants"])

# Bilingual seed assistants. Templates mirror the workflow output shapes the
# frontend previously applied client-side; they now live server-side so they
# can be governed and department-scoped.
_TEMPLATE_REPORT = """Write a business-ready report.

Use this shape:
# Report
## Executive Summary
...
## Findings
- ...
## Risks
- ...
## Recommendations
- ..."""

_TEMPLATE_SUMMARY = """Format the response as a structured summary.

Use this shape:
# Summary
## Key Points
- ...
## Details
- ...
## Follow-ups
- ..."""

_TEMPLATE_TRANSLATION = """Translate the user's content. Preserve meaning, tone, names, numbers, and formatting.

Use this shape:
# Translation
## Translated Text
...
## Notes
- ..."""

_TEMPLATE_ACTIONS = """Extract or produce action items.

Use this shape:
# Action Items
| Task | Owner | Due Date | Status |
| --- | --- | --- | --- |
| ... | ... | ... | ... |

## Open Questions
- ..."""

DEFAULT_ASSISTANTS = [
    {
        "id": "asst_general",
        "name": "General Assistant",
        "name_zh": "通用助手",
        "description": "Everyday company Q&A and drafting help",
        "description_zh": "日常公司问答与文案起草",
        "department": None,
        "icon": "Sparkles",
        "system_prompt": (
            "You are ShiancoChat's general company assistant. Answer concisely and "
            "professionally. Reply in the language the user uses (Chinese or English)."
        ),
        "model_policy": "balanced",
        "output_template": None,
    },
    {
        "id": "asst_sales_quote",
        "name": "Sales Quote Drafter",
        "name_zh": "报价助手",
        "description": "Draft bilingual sales quotes and customer replies",
        "description_zh": "起草双语销售报价与客户回复",
        "department": "agio_business",
        "icon": "FileText",
        "system_prompt": (
            "You are the Agio sales quotation assistant for an outdoor furniture "
            "manufacturer. Draft professional bilingual quotes and customer replies. "
            "Always confirm product names, quantities, Incoterms, and currency."
        ),
        "model_policy": "balanced",
        "output_template": _TEMPLATE_REPORT,
    },
    {
        "id": "asst_sop_helper",
        "name": "SOP Helper",
        "name_zh": "生产SOP助手",
        "description": "Step-by-step answers from production SOP documents",
        "description_zh": "依据生产SOP文档给出分步骤解答",
        "department": "production_dept",
        "icon": "ClipboardList",
        "system_prompt": (
            "你是生产事业部的SOP助手。根据知识空间中的标准操作流程回答问题，"
            "给出分步骤说明，并标注相关的安全注意事项。默认用中文回答，除非用户使用英文。"
        ),
        "model_policy": "balanced",
        "output_template": _TEMPLATE_SUMMARY,
    },
    {
        "id": "asst_email_writer",
        "name": "Bilingual Email Writer",
        "name_zh": "双语邮件助手",
        "description": "Professional Chinese/English business emails",
        "description_zh": "专业的中英文商务邮件",
        "department": None,
        "icon": "Mail",
        "system_prompt": (
            "You are a bilingual business email writer. Draft professional emails in "
            "Chinese and English. Keep the tone polite, precise, and culturally appropriate."
        ),
        "model_policy": "balanced",
        "output_template": _TEMPLATE_TRANSLATION,
    },
    {
        "id": "asst_meeting_actions",
        "name": "Meeting Notes to Action Items",
        "name_zh": "会议纪要助手",
        "description": "Turn meeting notes into owners, tasks, and due dates",
        "description_zh": "将会议纪要转化为任务、负责人与截止日期",
        "department": None,
        "icon": "ListChecks",
        "system_prompt": (
            "You extract decisions and action items from meeting notes. Produce action "
            "items with owners and due dates. Reply in the language of the input."
        ),
        "model_policy": "fast",
        "output_template": _TEMPLATE_ACTIONS,
    },
]


async def ensure_default_assistants(db):
    """Insert seed assistants if missing (idempotent, mirrors ensure_default_tools)."""
    for seed in DEFAULT_ASSISTANTS:
        existing = await db.assistants.find_one({"id": seed["id"]})
        if existing:
            continue
        now = datetime.now(timezone.utc)
        await db.assistants.insert_one({
            **seed,
            "enabled": True,
            "created_by": "system",
            "created_at": now,
            "updated_at": now,
        })


def assistant_visible_to(assistant: dict, user: User) -> bool:
    """Global assistants are visible to all; department assistants to members and admins."""
    department = assistant.get("department")
    if not department:
        return True
    if user.role == UserRole.ADMIN:
        return True
    return department == _department_value(user)


@router.get("", response_model=List[Assistant])
@limiter.limit("60/minute")
async def list_assistants(
    request: Request,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """List assistants visible to the current user (global + own department).
    Admins see all assistants, including disabled ones."""
    await ensure_default_assistants(db)
    query = {} if current_user.role == UserRole.ADMIN else {"enabled": True}
    assistants = await db.assistants.find(query).sort("created_at", 1).to_list(length=None)
    return [
        Assistant(**assistant)
        for assistant in assistants
        if assistant_visible_to(assistant, current_user)
    ]


@router.get("/{assistant_id}", response_model=Assistant)
@limiter.limit("60/minute")
async def get_assistant(
    request: Request,
    assistant_id: str,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    assistant = await db.assistants.find_one({"id": assistant_id})
    if not assistant or not assistant_visible_to(assistant, current_user):
        raise HTTPException(status_code=404, detail="Assistant not found")
    return Assistant(**assistant)


@router.post("", response_model=Assistant, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_assistant(
    request: Request,
    assistant_data: AssistantCreate,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to manage assistants")

    now = datetime.now(timezone.utc)
    assistant = Assistant(
        **assistant_data.dict(),
        created_by=current_user.email,
        created_at=now,
        updated_at=now,
    )
    await db.assistants.insert_one(assistant.dict())
    return assistant


@router.patch("/{assistant_id}", response_model=Assistant)
@limiter.limit("30/minute")
async def update_assistant(
    request: Request,
    assistant_id: str,
    assistant_update: AssistantUpdate,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to manage assistants")

    existing = await db.assistants.find_one({"id": assistant_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Assistant not found")

    update_data = assistant_update.dict(exclude_unset=True)
    if not update_data:
        return Assistant(**existing)

    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.assistants.update_one({"id": assistant_id}, {"$set": update_data})
    updated = await db.assistants.find_one({"id": assistant_id})
    return Assistant(**updated)


@router.delete("/{assistant_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def delete_assistant(
    request: Request,
    assistant_id: str,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to manage assistants")

    result = await db.assistants.delete_one({"id": assistant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assistant not found")
    return None
