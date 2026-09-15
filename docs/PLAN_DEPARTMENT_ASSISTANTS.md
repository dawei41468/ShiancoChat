# Plan: Department Knowledge Spaces + Department Assistants

> **Status:** Draft (2026-09-15)
> **Goal:** Shift ShiancoChat from "generic company chatbot" to "department-scoped
> AI assistants backed by shared company knowledge" — the first concrete step in
> the chat → agent-layer strategy.
> **Estimated effort:** ~2 weeks across 5 phases.

## Why these two together

- Department spaces make knowledge *shared and cumulative* (vs. today's per-user silos).
- Assistants make the app *task-shaped* instead of *technology-shaped*
  ("Sales Quote Drafter" beats "chat with model + space + workflow dropdown").
- Assistants need shared knowledge to be useful; spaces need assistants to be discovered.

---

## Part A: Department Knowledge Spaces

### Data model (`backend/models.py`)

`KnowledgeSpace` gains one field; `scope` semantics are formalized:

| Field | Change |
|---|---|
| `scope` | `"user"` (existing default) \| `"department"` (new) |
| `department` | NEW — `Optional[Department]`, required iff `scope == "department"` |
| `owner_email` | Unchanged — creator/admin contact for the space |

`Document`: `expires_at` becomes `Optional[datetime]`.
- Conversation-ad-hoc uploads keep the 24h TTL.
- Documents uploaded **into a knowledge space** (user or department) get `expires_at = None`.
- The existing TTL index (`documents.expires_at`, `expireAfterSeconds=0`) automatically
  ignores documents where the field is null/missing — no index migration needed.

### Access matrix

| scope | read/use | upload | edit/delete space |
|---|---|---|---|
| `user` | owner, admin | owner | owner, admin |
| `department` | department members, admin | department members | admin only |

### Backend changes

1. **`routers/documents.py::_assert_space_access`** — extend to department scope:
   user passes if `space.owner_email == user.email`, or
   (`space.scope == "department"` and `space.department == user.department`), or `user.role == ADMIN`.
2. **`list_knowledge_spaces`** — return `$or: [owner_email == me, {scope: "department", department: my_dept}]`.
3. **`create_knowledge_space`** — `scope="department"` requires `role == ADMIN` (v1 governance decision;
   members can contribute documents but only admins create/rename/delete shared spaces).
4. **Upload path** — when `knowledge_space_id` is explicitly provided, store `expires_at: None`.
5. **CRITICAL — retrieval filter (`utils/rag.py`)**: today every search path
   (`_vector_search_atlas`, `_text_search`, `_in_memory_search`) filters chunks by
   `user_email == requester`, which would make department documents invisible to everyone
   except the uploader. Change: when a `knowledge_space_id` is supplied, verify space access
   (reuse `_assert_space_access`) and filter chunks by `knowledge_space_id` **without** the
   `user_email` filter. When no space is supplied, keep the current per-user behavior.
6. **CRITICAL — chat endpoint authorization (`routers/openai.py`)**: the chat endpoint
   currently forwards `knowledge_space_id` to retrieval without checking access (the
   per-user chunk filter is the only accidental guard). Once department spaces exist, add an
   explicit space-access check before RAG runs, or department IDs become enumerable.

### Migration

- Existing spaces: `scope` already defaults to `"user"` — no data migration.
- Existing chunks/documents: untouched; department behavior only activates on new spaces.
- New indexes: `knowledge_spaces (scope, department)` — add to `database.py::init_indexes`.

---

## Part B: Department Assistants

### Concept

An assistant = **system prompt + default knowledge space + model policy + output template**,
scoped globally or to a department. This graduates the frontend-only `utils/workflows.js`
prompt prefixes into governed, server-side entities.

### Data model — new `assistants` collection

```
id: str (uuid)
name: str                  # e.g. "Sales Quote Drafter" / "报价助手"
name_zh: str
description / description_zh: str
department: Optional[Department]   # null = global
icon: str                  # lucide icon name
system_prompt: str
default_knowledge_space_id: Optional[str]
model_policy: str          # "fast" | "balanced" | "deep" | "local"  (maps to modelPolicy.js)
output_template: Optional[str]     # reuse the WORKFLOWS instruction shapes
enabled: bool
created_by: str
created_at / updated_at
```

New indexes: `assistants (department, enabled)`.

### Endpoints (new `backend/routers/assistants.py`, mounted at `/api/assistants`)

| Endpoint | Access |
|---|---|
| `GET /api/assistants` | Any authenticated user; returns global + own-department assistants |
| `POST /api/assistants` | Admin |
| `PATCH /api/assistants/{id}` | Admin |
| `DELETE /api/assistants/{id}` | Admin |
| `GET /api/assistants/{id}` | Member of scope |

Follow the existing `routers/tools.py` patterns (rate limits, audit-friendly).

### Chat integration (`routers/openai.py`)

- `StreamRequestPayload` gains `assistant_id: Optional[str]`.
- Server-side assembly order: `assistant.system_prompt` → conversation history →
  `assistant.output_template`-wrapped user text → RAG augmentation using
  `assistant.default_knowledge_space_id` when the request doesn't specify one.
- The frontend's `applyWorkflowInstruction()` prefixing is **removed** once server-side
  templates land (keep the util during transition; deprecate after).
- Record `assistant_id` in `tool_audit_events.details` for the existing admin audit view.

### Seed assistants (bilingual, via `ensure_default_assistants()` on startup, mirroring `ensure_default_tools`)

1. **General Assistant / 通用助手** — global, balanced policy.
2. **Sales Quote Drafter / 报价助手** — Agio 业务, report template, sales space.
3. **SOP Helper / 生产SOP助手** — 生产事业部, summary template, production space.
4. **Bilingual Email Writer / 双语邮件助手** — global, translation template.
5. **Meeting Notes → Action Items / 会议纪要助手** — global, action-items template.

### Frontend changes

- **`ChatContext.js`**: fetch assistants on init; `selectedAssistantId` state;
  selecting an assistant sets model policy + space + workflow in one action.
- **`ChatPage.js` empty state**: assistant cards replace/augment the four hardcoded
  suggested prompts; per-department prompts come from the API.
- **`Sidebar.js`**: knowledge space list gets a "部门空间 / Department" section badge.
- **`SettingsSheet.js`**: space management UI gains scope display; admins get
  create-department-space and assistant-management sections (or a new Admin tab).
- **`ChatInput.js`**: optional `/assistant-name` quick switcher (phase 5 polish).
- **i18n**: add keys to `LanguageContext.js` (EN + ZH).

---

## Phasing

| Phase | Scope | Est. |
|---|---|---|
| 1 | Backend Part A: model fields, access rules, TTL policy, rag.py + openai.py security changes, new index, tests | 3 d |
| 2 | Frontend Part A: space badges/sections, dept-space admin creation, upload-to-space UX | 2 d |
| 3 | Backend Part B: assistants collection + CRUD + seeds + chat integration, tests | 3 d |
| 4 | Frontend Part B: assistant picker, empty-state cards, admin management | 2 d |
| 5 | Polish: slash switcher, audit dashboard enrichment, docs (API.md, RAG_AND_SEARCH.md), i18n sweep | 1–2 d |

## Test plan

- **Backend (pytest + mongomock):** department space access matrix (member/stranger/admin),
  cross-department retrieval isolation, no-TTL persistence for space documents,
  assistant CRUD authorization, chat with `assistant_id` applies prompt + default space.
- **Frontend (RTL):** assistant selection updates context, empty-state renders department
  assistants, space badges render scope correctly.
- **Regression:** existing per-user spaces, ad-hoc upload TTL, and current chat flow unchanged.

## Decisions locked (revisit if disputed)

- Admins create department spaces; all department members can upload to them.
- Space documents never expire; ad-hoc conversation uploads keep 24h TTL.
- Assistants are admin-managed in v1 (no self-serve authoring yet).
- Workflows move server-side; `workflows.js` deprecated after transition.

## Known risks

- **Chunk filter change (A.5)** is the highest-risk edit — it's on the retrieval hot path and
  touches three search implementations. Mitigate with the access-matrix tests landing in the
  same commit.
- Department enum is a closed list; a new brand/department requires a code change
  (`localization/departments.py`). Acceptable at current company size.
