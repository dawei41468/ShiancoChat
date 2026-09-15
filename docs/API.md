# ShiancoChat API Reference

Base URL: `http://localhost:4100/api`

All authenticated endpoints require an `Authorization: Bearer <token>` header.

---

## Authentication

### POST `/auth/register`
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "User Name"
}
```

**Response:** `UserPublic`
```json
{
  "id": "...",
  "email": "user@example.com",
  "name": "User Name",
  "role": "user",
  "created_at": "2026-01-01T00:00:00Z"
}
```

### POST `/auth/login`
Authenticate and receive tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:** `Token`
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "token_type": "bearer",
  "user": { "id": "...", "email": "...", "name": "...", "role": "user" }
}
```

### POST `/auth/refresh`
Refresh the access token using a refresh token.

**Request:**
```json
{ "refresh_token": "<jwt>" }
```

**Response:** `Token` (same shape as login)

### GET `/auth/users/me`
Get the current authenticated user. **Requires auth.**

**Response:** `UserPublic`

### PATCH `/auth/users/me`
Update the current user's profile. **Requires auth.**

**Request:**
```json
{ "name": "New Name", "password": "newPassword123" }
```

### POST `/auth/logout`
Invalidate the current session. **Requires auth.**

### DELETE `/auth/users/me`
Delete the current user's account. **Requires auth.**

---

## Chat

### POST `/chat/new`
Create a new conversation. **Requires auth.**

**Request:**
```json
{ "title": "New Chat" }
```

**Response:** `Conversation`
```json
{
  "id": "...",
  "title": "New Chat",
  "user_id": "...",
  "created_at": "...",
  "updated_at": "..."
}
```

### GET `/chat/conversations`
List all conversations for the current user. **Requires auth.**

**Response:** `List[Conversation]`

### GET `/chat/conversations/{conversation_id}/messages`
Get messages for a conversation. **Requires auth + ownership.**

**Response:** `List[Message]`
```json
[
  {
    "id": "...",
    "conversation_id": "...",
    "sender": "user",
    "text": "Hello",
    "created_at": "..."
  }
]
```

### GET `/chat/conversations/{conversation_id}/artifacts`
Get artifacts for a conversation. **Requires auth + ownership.**

**Response:** `List[Artifact]`

### POST `/chat/artifacts`
Create an artifact in a conversation. **Requires auth + ownership.**

**Request:**
```json
{
  "conversation_id": "...",
  "title": "Artifact Title",
  "content": "Artifact content...",
  "type": "text"
}
```

### PATCH `/chat/artifacts/{artifact_id}`
Update an artifact. **Requires auth + ownership.**

**Request:**
```json
{ "title": "Updated Title", "content": "Updated content..." }
```

### DELETE `/chat/artifacts/{artifact_id}`
Delete an artifact. **Requires auth + ownership.**

### POST `/chat/messages`
Send a message in a conversation. **Requires auth + ownership.**

**Request:**
```json
{
  "conversation_id": "...",
  "text": "Hello AI",
  "sender": "user"
}
```

### PUT `/chat/conversations/{conversation_id}`
Rename a conversation. **Requires auth + ownership.**

**Request:**
```json
{ "new_title": "Updated Title" }
```

### DELETE `/chat/conversations/{conversation_id}`
Delete a conversation. **Requires auth + ownership.**

### POST `/chat/conversations/{conversation_id}/generate-title`
Auto-generate a title for a conversation using the LLM. **Requires auth + ownership.**

**Request:**
```json
{ "model": "deepseek/deepseek-r1-0528-qwen3-8b" }
```

**Response:**
```json
{ "title": "Generated Title", "conversation_id": "..." }
```

---

## LLM

### POST `/llm/chat`
Stream a chat completion. **Requires auth.**

**Request:**
```json
{
  "conversation_id": "...",
  "messages": [{"role": "user", "content": "Hello"}],
  "model": "deepseek/deepseek-r1-0528-qwen3-8b",
  "isWebSearchEnabled": false,
  "isRagEnabled": true,
  "workflow_id": "default",
  "assistant_id": null,
  "knowledge_space_id": null
}
```

`assistant_id` (optional): applies the assistant's system prompt, output template,
and default knowledge space server-side. Only assistants visible to the caller
(global or own-department) are accepted; anything else returns `404`.

`knowledge_space_id` (optional): scopes RAG retrieval to a knowledge space. The
caller must have access to the space (owner, department member for
department-scoped spaces, or admin); anything else returns `404`. Retrieval in a
department-scoped space searches chunks from all members of that department.

**Response:** SSE stream of completion chunks.

### GET `/llm/models`
List available LLM models. **Requires auth.**

**Response:**
```json
{ "models": ["model-a", "model-b"] }
```

### GET `/llm/config`
Get current LLM configuration.

**Response:**
```json
{ "base_url": "...", "model": "..." }
```

### GET `/llm/rag/config`
Get RAG configuration.

**Response:**
```json
{ "enabled": true, "top_k": 5 }
```

---

## Documents & Knowledge Spaces

### GET `/documents/spaces`
List knowledge spaces visible to the caller: own spaces plus department-scoped
spaces for the caller's department. **Requires auth.**

**Response:** `List[KnowledgeSpace]` — each space has `scope` (`"user"` |
`"department"`) and `department` (set only when `scope == "department"`).

### POST `/documents/spaces`
Create a knowledge space. **Requires auth.**

**Request:**
```json
{ "name": "My Space", "description": "...", "scope": "user", "department": null }
```

`scope: "department"` requires **admin** and a valid `department` value.
Department spaces are readable/writable by all members of that department;
only admins can rename or delete them.

### GET `/documents/spaces/{space_id}`
Get a knowledge space with its documents. **Requires auth + space access.**
(Access denials return `404` to avoid leaking space existence.)

### PATCH `/documents/spaces/{space_id}`
Update a knowledge space. **Requires auth + ownership** (admin-only for department spaces).

### DELETE `/documents/spaces/{space_id}`
Delete a knowledge space and its documents. **Requires auth + ownership** (admin-only for department spaces).

### GET `/documents/spaces/{space_id}/documents`
List documents in a knowledge space. **Requires auth + space access.**

### POST `/documents`
Create a document from text. **Requires auth.**

**Request:**
```json
{
  "title": "Doc Title",
  "content": "Document content...",
  "knowledge_space_id": "..."
}
```

### POST `/documents/upload`
Upload a file (PDF, DOCX, TXT) for RAG indexing. **Requires auth.**

**Request:** `multipart/form-data` with `file` and optional `knowledge_space_id`.

**TTL:** uploads attached to a knowledge space persist indefinitely
(`expires_at: null`); ad-hoc conversation uploads expire after 24 hours.

**Response:** `DocumentResponse`

### GET `/documents/{document_id}`
Get a document by ID. **Requires auth + ownership.**

### DELETE `/documents/{document_id}`
Delete a document. **Requires auth + ownership.**

### POST `/documents/cleanup`
Remove expired temporary documents. **Requires auth.**

---

## Assistants

An assistant is a governed, server-side persona: system prompt + default
knowledge space + model policy + output template, scoped globally or to a
department. Seed assistants are created idempotently on first list.

### GET `/assistants`
List assistants visible to the caller (global + own department).
**Requires auth.** Admins additionally see disabled assistants.

**Response:** `List[Assistant]`

### GET `/assistants/{assistant_id}`
Get one assistant. **Requires auth + visibility** (404 otherwise).

### POST `/assistants`
Create an assistant. **Requires admin.**

**Request:**
```json
{
  "name": "Sales Quote Drafter",
  "name_zh": "报价助手",
  "description": "Drafts customer quotes",
  "description_zh": "起草客户报价",
  "department": "agio_business",
  "icon": "FileText",
  "system_prompt": "You are...",
  "default_knowledge_space_id": null,
  "model_policy": "balanced",
  "output_template": null,
  "enabled": true
}
```

`department: null` makes the assistant global. `model_policy` is one of
`fast | balanced | deep | local` (mapped to concrete models client-side).

### PATCH `/assistants/{assistant_id}`
Update an assistant (partial). **Requires admin.**

### DELETE `/assistants/{assistant_id}`
Delete an assistant. **Requires admin.**

---

## Tool Configuration

### GET `/tools`
List all tool configurations. **Requires auth.**

**Response:** `List[ToolConfig]`

### PATCH `/tools/{tool_id}`
Update a tool's configuration. **Requires admin.**

**Request:**
```json
{
  "enabled": true,
  "default_enabled": true,
  "allowed_roles": ["user", "admin"]
}
```

### GET `/tools/audit`
Get tool audit log. **Requires admin.**

**Response:** `List[ToolAuditEvent]`

---

## Admin Users

### GET `/users`
List all users. **Requires admin.**

**Response:** `List[UserPublic]`

### PATCH `/users/{user_id}/role`
Update a user's role. **Requires admin.**

**Request:**
```json
{ "role": "admin" }
```

### DELETE `/users/{user_id}`
Delete a user. **Requires admin.** Cannot delete your own account.

---

## Health

### GET `/health`
Health check endpoint. Returns database connectivity status.

**Response:**
```json
{ "status": "healthy", "database": "connected" }
```

Or `503 Service Unavailable` if the database is unreachable.
