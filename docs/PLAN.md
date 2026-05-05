# ShiancoChat Implementation Roadmap

> **Status:** Phases 1, 6, and 7 are complete. Phase 8 is the current focus. Phases 2–4 remain as future work.

## Product Roadmap

| Phase | Theme | Status |
|-------|-------|--------|
| 1 | Stabilize Current App | ✅ Complete |
| 2 | Model Policy Layer | Pending |
| 3 | Knowledge Spaces | Pending |
| 4 | Workflow Outputs | Pending |
| 5 | Tool Governance | Partially implemented (see below) |
| 6 | Evaluation And Operations | Partially implemented |
| 7 | Testing & Documentation Consolidation | ✅ Complete |
| 8 | Production Hardening | 🔄 In Progress |

### Phase 1: Stabilize Current App ✅
- Lock down authentication and ownership boundaries for chat, documents, and admin actions.
- Keep model loading, message sending, streaming, file upload, and login flows reliable.
- Add regression tests around the highest-risk backend routes (77 backend + 21 frontend tests).
- Keep one frontend package manager and prevent generated build output from entering source control.
- Maintain CI for backend tests, frontend tests, and frontend builds.

### Phase 2: Model Policy Layer
- Replace the raw model selector with task-oriented policies: fast, balanced, deep, and local/private.
- Keep an advanced model override in settings for power users.
- Add provider health checks and latency/error visibility.

### Phase 3: Knowledge Spaces
- Promote uploaded documents into persistent knowledge spaces scoped by user, department, or project.
- Require citations for source-grounded answers.
- Add indexing status, source previews, and document access controls.

### Phase 4: Workflow Outputs
- Add reusable workflows for summaries, translations, comparisons, reports, and action items.
- Return structured outputs where useful, not just conversational text.
- Add an artifact panel for editable generated documents and tables.

### Phase 5: Tool Governance
- Add a tool registry for web search, file search, internal APIs, and future MCP connectors.
- Give admins control over which roles can use each tool.
- Log tool calls, sources, and exported data for auditability.

### Phase 6: Evaluation And Operations
- Add feedback categories such as wrong source, missing context, unsafe answer, and poor format.
- Track model/provider latency, failures, and user satisfaction.
- Build regression evals for important company workflows.

### Phase 7: Testing & Documentation Consolidation ✅
- Decouple backend tests from live MongoDB using `mongomock-motor`.
- Mock LLM, embeddings, and web search for fast, deterministic CI.
- Add frontend tests for AuthContext, streaming, FileUpload, Sidebar, ChatContext utilities, workflows, and artifacts.
- Resolve Jest ESM issues for `axios`, `jwt-decode`, `eventsource-parser`, and `react-router-dom` v7.
- Consolidate documentation: rewrite `PROJECT_ANALYSIS.md`, merge roadmap docs, create `RAG_AND_SEARCH.md`, update `.env.example` files, remove duplicates.

### Phase 8: Production Hardening 🔄
- Fix critical security gaps: protect unauthenticated endpoints, add security headers, enforce body size limits.
- Fix backend bugs: synchronous HTTP in async path, dead config constants, wrong vector index type, silent search failures.
- Close critical test gaps: admin endpoints, artifact CRUD, streaming logic, web search engines, advanced RAG, rate limiting.
- Add frontend tests for components and actual ChatContext logic.
- Refactor frontend state management (extract from `ChatContext` god object).
- Improve documentation: LICENSE, CONTRIBUTING.md, API docs, troubleshooting guide, deployment guide.
- Add production infrastructure: health checks, dependency scanning, structured logging.

---

## Technical Implementation Plan

The sections below map the product roadmap into concrete technical phases with file changes and code examples.

### Current State Summary
- FastAPI backend with MongoDB (motor), JWT auth (localStorage), SSE streaming with custom XML tags
- React frontend with Context API, no state management library
- RAG: in-memory numpy cosine similarity over MongoDB-fetched chunks
- ~~No tests~~ ✅ 77 backend tests + 21 frontend tests via mongomock-motor
- ~~No logout endpoint~~ ✅ Logout endpoint + token revocation implemented
- ~~Mixed package managers~~ ✅ Yarn only; CI runs backend + frontend tests + build

---

## Phase 1: Foundation (Security + Testing)

**Goal:** Close critical security gaps and establish a test harness before making larger changes.

### 1.1 Add Backend Test Harness

**Files to create:**
- `backend/pytest.ini` — pytest configuration with asyncio mode
- `backend/tests/conftest.py` — shared fixtures (test client, mock DB, auth helpers)
- `backend/tests/__init__.py`

**Files to create (test modules):**
- `backend/tests/test_auth.py` — register, login, refresh, logout, me, token validation
- `backend/tests/test_chat.py` — conversation CRUD, message saving
- `backend/tests/test_documents.py` — upload, chunking, embedding, retrieval
- `backend/tests/test_rag.py` — embed_query, search_chunks similarity + MMR

**Approach:**
- Use `httpx.AsyncClient` with `app=server.app` for async endpoint tests
- Use `mongomock` or a test MongoDB container for DB tests
- Mock `SentenceTransformer` for RAG tests (avoid loading model)
- Mock `httpx.AsyncClient.stream` for LLM streaming tests

**Key test cases:**
```python
# test_auth.py
- test_register_success
- test_register_duplicate_email
- test_login_success
- test_login_wrong_password
- test_refresh_valid_token
- test_refresh_invalid_token
- test_logout_revokes_refresh_token
- test_get_current_user_valid_token
- test_get_current_user_expired_token

# test_chat.py
- test_create_conversation
- test_fetch_conversations_for_user
- test_fetch_messages_for_conversation
- test_save_message_updates_conversation_timestamp
- test_delete_conversation_cascades_to_messages

# test_documents.py
- test_upload_pdf_chunks_correctly
- test_upload_file_too_large
- test_compute_embeddings_updates_chunks
- test_get_document_not_owned_returns_404

# test_rag.py
- test_embed_query_returns_vector
- test_search_chunks_filters_by_user
- test_search_chunks_applies_threshold
- test_search_chunks_mmr_diversity
```

### 1.2 Add Logout Endpoint + Token Revocation

**Backend changes:**

`backend/routers/auth.py` — Add logout endpoint:
```python
@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Revoke all refresh tokens for the current user."""
    await UserService.revoke_all_user_refresh_tokens(current_user.email)
    return {"message": "Logged out successfully"}
```

`backend/services/auth/users.py` — Add method:
```python
@staticmethod
async def revoke_all_user_refresh_tokens(email: str) -> None:
    await db.refresh_tokens.update_many(
        {"email": email},
        {"$set": {"is_active": False}}
    )
```

**Frontend changes:**

`frontend/src/services/apiService.js` — Update logout:
```javascript
export const logout = async () => {
  try {
    await apiClient.post('/api/auth/logout');
  } finally {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setAuthHeader(null);
    clearRefreshTimer();
  }
};
```

`frontend/src/AuthContext.js` — Make logout async:
```javascript
const logout = async () => {
  await apiLogout();
  setToken(null);
  setUser(null);
};
```

### 1.3 Add Per-User Rate Limiting

**Backend changes:**

`backend/server.py` — Add user-based key function:
```python
from slowapi.util import get_remote_address

def rate_limit_key(request: Request) -> str:
    """Use user email if authenticated, else fall back to IP."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            token = auth_header[7:]
            payload = jwt.decode(token, config.secret_key, algorithms=[ALGORITHM])
            email = payload.get("sub")
            if email:
                return f"user:{email}"
        except:
            pass
    return get_remote_address(request)

limiter = Limiter(key_func=rate_limit_key)
```

Apply limits to chat and document endpoints:
- `POST /api/auth/register`: 10/minute
- `POST /api/auth/login`: 20/minute
- `POST /api/auth/refresh`: 60/minute
- `POST /api/openai/chat`: 120/hour per user
- `POST /api/documents/upload`: 50/hour per user
- `POST /api/chat/messages`: 300/hour per user
- `GET /api/chat/conversations`: 600/hour per user
- `GET /api/documents/{id}`: 600/hour per user

---

## Phase 2: Streaming Protocol Modernization

**Goal:** Replace custom XML tags with standard SSE events. This is a breaking change that affects both backend and frontend.

### 2.1 Backend: Standard SSE Events

**File:** `backend/routers/openai.py`

Replace XML tag yields with standard SSE format:

```python
# Before:
yield f"data: <websearch>true</websearch>\n\n"

# After:
yield "event: status\ndata: " + json.dumps({"type": "websearch", "state": "started"}) + "\n\n"
```

Event types:
| Event | Data | When |
|-------|------|------|
| `status` | `{"type": "websearch", "state": "started"}` | Web search begins |
| `status` | `{"type": "websearch", "state": "results"}` | Web search has results |
| `status` | `{"type": "websearch", "state": "no_results"}` | Web search empty |
| `status` | `{"type": "websearch", "state": "completed"}` | Web search done |
| `status` | `{"type": "rag", "state": "started"}` | RAG begins |
| `status` | `{"type": "rag", "state": "results"}` | RAG has results |
| `status` | `{"type": "rag", "state": "no_results"}` | RAG empty |
| `status` | `{"type": "rag", "state": "completed"}` | RAG done |
| `citations` | `{"items": [...]}` | Citations available |
| `delta` | `{"content": "hello"}` | LLM token (from think or answer) |
| `thinking` | `{"content": "reasoning..."}` | Reasoning tokens |
| `error` | `{"code": "RATE_LIMITED", "message": "..."}` | Error occurred |
| `done` | `{}` | Stream complete |

**Key change:** Instead of `<think>` and `<answer>` tags, the backend should parse the LLM response to separate thinking from answering, then emit `thinking` and `delta` events accordingly.

The LLM prompt should request structured output:
```
Please wrap your reasoning in <think>...</think> tags and your final answer in <answer>...</answer> tags.
```

The backend parses these and emits the appropriate events.

### 2.2 Frontend: New Stream Parser

**File:** `frontend/src/services/streaming.js`

Replace `parseStreamByTags` with an event-based parser:

```javascript
async function* parseSSEEvents(sseReader) {
  while (true) {
    const { value, done } = await sseReader.read();
    if (done) break;

    const { event, data } = value;
    if (event === 'status') {
      const parsed = JSON.parse(data);
      yield { event: `status.${parsed.type}`, data: { state: parsed.state } };
    } else if (event === 'citations') {
      yield { event: 'citations', data: JSON.parse(data) };
    } else if (event === 'delta') {
      yield { event: 'thread.message.delta', data: JSON.parse(data) };
    } else if (event === 'thinking') {
      yield { event: 'thread.run.step.in_progress', data: JSON.parse(data) };
    } else if (event === 'error') {
      yield { event: 'error', data: JSON.parse(data) };
    } else if (event === 'done') {
      yield { event: 'thread.run.completed', data: {} };
    }
  }
}
```

**File:** `frontend/src/ChatContext.js`

Update event handling to match new event structure. The `status.websearch` and `status.rag` events now have `state` instead of `value`.

### 2.3 Add Reconnection Support

**Frontend:** Add retry logic with exponential backoff:

```javascript
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;

export async function* streamResponse(url, requestOptions, retryCount = 0) {
  try {
    // ... existing fetch code ...
  } catch (error) {
    if (retryCount < MAX_RETRIES && error.name !== 'AbortError') {
      await delay(RETRY_DELAY_BASE * (2 ** retryCount));
      yield* streamResponse(url, requestOptions, retryCount + 1);
    } else {
      throw error;
    }
  }
}
```

**Backend:** Add heartbeat to prevent proxy timeouts:

```python
# In generate_stream(), yield heartbeat every 15 seconds
heartbeat_interval = 15
last_heartbeat = time.time()

async for chunk in response.aiter_bytes():
    if time.time() - last_heartbeat > heartbeat_interval:
        yield ":heartbeat\n\n"
        last_heartbeat = time.time()
    yield chunk
```

---

## Phase 3: RAG with MongoDB Atlas Vector Search

**Goal:** Replace in-memory numpy search with MongoDB Atlas Vector Search for scalable ANN search. This keeps the infrastructure simple (single database) and is the natural upgrade path from the current MongoDB setup.

**Why Atlas Vector Search instead of Qdrant:**
- No additional service to deploy and manage
- Same MongoDB connection, same data locality
- Native integration with existing user/conversation filters
- Supports hybrid search (vector + text) in the same query
- Free tier available on MongoDB Atlas

**Note:** For self-hosted MongoDB (no Atlas), we keep the current in-memory search as a fallback. Atlas Vector Search requires MongoDB Atlas M10+ or a local setup with the `$vectorSearch` aggregation stage.

### 3.1 Add Vector Search Service

**New file:** `backend/services/vector_search.py`

```python
from typing import List, Optional
from backend.database import get_db
import logging

logger = logging.getLogger(__name__)

class VectorSearch:
    """
    Vector search abstraction that uses MongoDB Atlas Vector Search when available,
    falling back to in-memory numpy search for self-hosted MongoDB.
    """

    def __init__(self):
        self.use_atlas = False  # Detected at runtime

    async def _check_atlas_support(self):
        """Check if MongoDB Atlas Vector Search is available."""
        try:
            db = await get_db()
            # Try to list search indexes on document_chunks
            indexes = await db.document_chunks.list_search_indexes().to_list(1)
            self.use_atlas = True
            logger.info("MongoDB Atlas Vector Search detected and enabled")
        except Exception:
            self.use_atlas = False
            logger.info("MongoDB Atlas Vector Search not available, using fallback search")

    async def search(
        self,
        query_embedding: List[float],
        user_email: Optional[str] = None,
        conversation_id: Optional[str] = None,
        top_k: int = 5,
        threshold: float = 0.7
    ) -> List[dict]:
        if not self.use_atlas:
            # Fallback to existing in-memory search
            from backend.utils.rag import search_chunks
            return await search_chunks(user_email, query_embedding, top_k, threshold, conversation_id)

        db = await get_db()

        # Build Atlas Vector Search pipeline
        pipeline = []

        # Vector search stage
        vector_stage = {
            "$vectorSearch": {
                "index": "document_chunks_vector_index",
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": top_k * 10,
                "limit": top_k * 4,
            }
        }
        pipeline.append(vector_stage)

        # Filter by user and conversation
        match_stage = {"$match": {}}
        if user_email:
            match_stage["$match"]["user_email"] = user_email
        if conversation_id:
            match_stage["$match"]["conversation_id"] = conversation_id
        if match_stage["$match"]:
            pipeline.append(match_stage)

        # Score and project
        pipeline.append({
            "$project": {
                "document_id": 1,
                "chunk_index": 1,
                "content": 1,
                "similarity": {"$meta": "vectorSearchScore"},
            }
        })

        # Limit
        pipeline.append({"$limit": top_k * 4})

        results = await db.document_chunks.aggregate(pipeline).to_list(top_k * 4)

        # Apply threshold
        candidates = [r for r in results if r.get("similarity", 0) >= threshold]

        # Apply MMR re-ranking (same logic as before)
        if len(candidates) > top_k:
            # ... existing MMR logic ...
            pass

        return candidates[:top_k]

    async def create_search_index(self):
        """Create the Atlas Vector Search index. Run once during setup."""
        if not self.use_atlas:
            logger.warning("Cannot create search index: Atlas Vector Search not available")
            return

        db = await get_db()
        await db.document_chunks.create_search_index({
            "name": "document_chunks_vector_index",
            "definition": {
                "mappings": {
                    "dynamic": False,
                    "fields": {
                        "embedding": {
                            "type": "knnVector",
                            "dimensions": 1024,  # bge-m3
                            "similarity": "cosine"
                        }
                    }
                }
            }
        })
```

### 3.2 Upgrade Embedding Model to bge-m3

**File:** `backend/routers/documents.py`

Update model path and vector size:

```python
# Before:
model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'all-MiniLM-L6-v2')

# After:
model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'bge-m3')
```

**File:** `backend/utils/rag.py`

Update model path:
```python
model_path = os.path.join(os.path.dirname(__file__), '..', '..', 'models', 'bge-m3')
```

**Download script:** `backend/scripts/download_bge_m3.py`
```python
from sentence_transformers import SentenceTransformer
import os

model_name = "BAAI/bge-m3"
save_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'bge-m3')

model = SentenceTransformer(model_name)
model.save(save_path)
print(f"Model saved to {save_path}")
```

**Note:** bge-m3 produces 1024-dimensional dense vectors. This requires updating the Atlas Vector Search index dimensions (see 3.1) and re-indexing all existing chunks.

### 3.3 Update RAG Search to Use Vector Search Service

**File:** `backend/utils/rag.py`

Replace the top-level search with the VectorSearch abstraction:

```python
from backend.services.vector_search import VectorSearch

vector_search = VectorSearch()

async def search_chunks(user_email, query_embedding, top_k=5, threshold=0.7, conversation_id=None):
    # Initialize Atlas detection on first call
    if not hasattr(vector_search, '_initialized'):
        await vector_search._check_atlas_support()
        vector_search._initialized = True

    return await vector_search.search(
        query_embedding=query_embedding,
        user_email=user_email,
        conversation_id=conversation_id,
        top_k=top_k,
        threshold=threshold
    )
```

### 3.4 MongoDB Setup Note

**No Docker required.** The app continues to connect to MongoDB via the existing `MONGO_URL` environment variable.

- **Development:** Use a local MongoDB installation or MongoDB Atlas free tier
- **Production:** Use MongoDB Atlas with Vector Search enabled (M10+ cluster) for ANN search
- The code auto-detects Atlas Vector Search availability and falls back to in-memory numpy search if not available

### 3.5 Add Atlas Detection to Config

**File:** `backend/config.py`

```python
use_atlas_vector_search: bool = Field(default=False, description="Enable MongoDB Atlas Vector Search (auto-detected)")
```

### 3.6 Data Migration for bge-m3

**Script:** `backend/scripts/migrate_to_bge_m3.py`

```python
"""
One-time migration script to re-compute all embeddings with bge-m3.
Run after deploying the new model.
"""
import asyncio
from backend.database import get_db
from backend.routers.documents import embedding_model
from pymongo import UpdateOne

async def migrate():
    db = await get_db()
    chunks_cursor = db.document_chunks.find({"embedding": {"$ne": None}})

    batch = []
    operations = []

    async for chunk in chunks_cursor:
        batch.append(chunk)
        if len(batch) >= 100:
            texts = [c["content"] for c in batch]
            embeddings = embedding_model.encode(texts, convert_to_tensor=False).tolist()

            for chunk, emb in zip(batch, embeddings):
                operations.append(UpdateOne(
                    {"_id": chunk["_id"]},
                    {"$set": {"embedding": emb}}
                ))

            if operations:
                await db.document_chunks.bulk_write(operations)
                print(f"Migrated {len(operations)} chunks")

            batch = []
            operations = []

    # Final batch
    if batch:
        texts = [c["content"] for c in batch]
        embeddings = embedding_model.encode(texts, convert_to_tensor=False).tolist()
        for chunk, emb in zip(batch, embeddings):
            operations.append(UpdateOne(
                {"_id": chunk["_id"]},
                {"$set": {"embedding": emb}}
            ))
        if operations:
            await db.document_chunks.bulk_write(operations)
            print(f"Migrated {len(operations)} chunks")

    print("Migration complete")

if __name__ == "__main__":
    asyncio.run(migrate())
```

---

## Phase 4: Observability + Polish

### 4.1 Structured Logging

**New file:** `backend/services/logging.py`

```python
import structlog
import logging
import sys

def configure_logging():
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
```

Replace `logging.getLogger(__name__)` with `structlog.get_logger()` across the backend.

### 4.2 Request Correlation IDs

**New file:** `backend/middleware/correlation.py`

```python
import uuid
from starlette.middleware.base import BaseHTTPMiddleware

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        return response
```

Add to `server.py`:
```python
from backend.middleware.correlation import CorrelationIdMiddleware
app.add_middleware(CorrelationIdMiddleware)
```

### 4.3 Prometheus Metrics

**New file:** `backend/middleware/metrics.py`

```python
from prometheus_client import Counter, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware
import time

REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"])
REQUEST_DURATION = Histogram("http_request_duration_seconds", "HTTP request duration", ["method", "endpoint"])
LLM_TOKENS = Counter("llm_tokens_total", "Total LLM tokens generated", ["model"])
RAG_QUERIES = Counter("rag_queries_total", "Total RAG queries", ["has_results"])

class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.time()
        response = await call_next(request)
        duration = time.time() - start

        REQUEST_COUNT.labels(method=request.method, endpoint=request.url.path, status=response.status_code).inc()
        REQUEST_DURATION.labels(method=request.method, endpoint=request.url.path).observe(duration)
        return response
```

Add endpoint:
```python
@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

### 4.4 Frontend: React Query for Server State

**Install:** `npm install @tanstack/react-query`

**New file:** `frontend/src/hooks/useConversations.js`

```javascript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchConversations, createNewChat, deleteConversation } from '@/services/apiService';

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createNewChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });
}
```

Gradually migrate `ChatContext` to use React Query for server state while keeping local UI state in Context.

---

## Implementation Order

| Order | Task | Phase | Est. Effort | Risk |
|-------|------|-------|-------------|------|
| 1 | Backend test harness + auth tests | 1.1 | 4h | Low |
| 2 | Logout endpoint + token revocation | 1.2 | 1h | Low |
| 3 | Per-user rate limiting | 1.3 | 1h | Low |
| 4 | Chat, document, RAG tests | 1.1 | 4h | Low |
| 5 | Backend: standard SSE events | 2.1 | 3h | Medium |
| 6 | Frontend: new stream parser | 2.2 | 2h | Medium |
| 7 | Heartbeat + reconnection | 2.3 | 2h | Low |
| 8 | Vector search service (Atlas + fallback) | 3.1 | 3h | Medium |
| 9 | Upgrade to bge-m3 embedding model | 3.2 | 2h | Medium |
| 10 | Update RAG search to use VectorSearch | 3.3 | 2h | Medium |
| 11 | bge-m3 embedding migration script | 3.4 | 1h | Low |
| 12 | Structured logging | 4.1 | 2h | Low |
| 13 | Correlation IDs | 4.2 | 1h | Low |
| 14 | Prometheus metrics | 4.3 | 2h | Low |
| 15 | React Query migration | 4.4 | 4h | Medium |

**Total estimated effort: ~34 hours**

---

## Deployment Strategy

Each phase can be merged independently:

1. **Phase 1** can be deployed immediately — no breaking changes
2. **Phase 2** requires frontend + backend to deploy together (breaking protocol change)
3. **Phase 3** can be deployed with a data migration script to re-compute embeddings with bge-m3. Atlas Vector Search auto-detects and falls back to in-memory search if not available.
4. **Phase 4** is additive — no breaking changes

### Data Migration for Phase 3

**Script:** `backend/scripts/migrate_to_bge_m3.py`

Run once after deploying bge-m3. Re-computes all existing embeddings with the new model.

---

## Decisions

1. **Vector search:** MongoDB Atlas Vector Search with auto-fallback to in-memory numpy search. No additional infrastructure.
2. **Embedding model:** Upgrade to `bge-m3` (1024d, multilingual, better quality). Requires one-time re-indexing.
3. **Cookie domain:** Use environment-based configuration. Dev: no domain (browser default). Production: set via `COOKIE_DOMAIN` env var. Recommendation: set to your actual domain (e.g., `shiancochat.com`) or leave empty for subdomain flexibility.
4. **Server state:** React Query (TanStack Query) for caching, background refetching, and deduping.

---

## Phase 8: Production Hardening

**Goal:** Address all findings from the comprehensive audit (`docs/AUDIT_FINDINGS.md`) to reach production readiness.

### 8.1 Security & Infrastructure

| Task | File(s) | Effort | Risk |
|------|---------|--------|------|
| Add `get_current_user` to `/api/openai/models` | `backend/routers/openai.py` | 15 min | Low |
| Add `/health` endpoint with DB check | `backend/server.py` | 30 min | Low |
| Add security headers middleware | `backend/server.py` | 30 min | Low |
| Add request body size limit (10MB) | `backend/server.py` | 15 min | Low |
| Restrict CORS in production | `backend/server.py`, `backend/config.py` | 15 min | Low |
| Fix sync `httpx.get` → `AsyncClient` | `backend/routers/openai.py` | 15 min | Low |
| Remove dead `ACCESS_TOKEN_EXPIRE_MINUTES` constant | `backend/auth.py` | 5 min | Low |
| Mask `MONGO_URL` credentials in logs | `backend/config.py` | 15 min | Low |
| Add `pip-audit` + `npm audit` to CI | `.github/workflows/ci.yml` | 30 min | Low |
| Add Dependabot config | `.github/dependabot.yml` | 15 min | Low |

### 8.2 Backend Bug Fixes

| Task | File(s) | Effort | Risk |
|------|---------|--------|------|
| Remove `2dsphere` vector index | `backend/database.py` | 15 min | Low |
| Fix `generate_title` to use LLM or remove `model` param | `backend/routers/chat.py` | 30 min | Low |
| Add retry + `failed` status for embedding task | `backend/routers/documents.py` | 1h | Medium |
| Fix silent web search failures | `backend/utils/web_search/main.py` | 30 min | Low |
| Add pagination to list endpoints | `backend/routers/*.py` | 1h | Low |
| Remove duplicate config import | `backend/routers/openai.py` | 5 min | Low |
| Add rate limits to direct endpoints | `backend/server.py` | 15 min | Low |

### 8.3 Backend Tests

| Task | File(s) | Effort | Risk |
|------|---------|--------|------|
| Test admin user management (`users.py`) | `backend/tests/test_users.py` | 1h | Low |
| Test artifact CRUD | `backend/tests/test_chat.py` or new file | 1h | Low |
| Test streaming logic with mocked SSE | `backend/tests/test_openai.py` | 2h | Medium |
| Test web search engines (mocked) | `backend/tests/test_web_search.py` | 1h | Low |
| Test advanced RAG (hybrid, MMR) | `backend/tests/test_rag.py` | 1.5h | Medium |
| Test rate limiter | `backend/tests/test_rate_limiter.py` | 45 min | Low |
| Test database index init | `backend/tests/test_database.py` | 30 min | Low |

### 8.4 Frontend Improvements

| Task | File(s) | Effort | Risk |
|------|---------|--------|------|
| Refactor `ChatContext` into smaller contexts / Zustand | `frontend/src/` | 4h | Medium |
| Add ErrorBoundary per route / feature | `frontend/src/App.js`, `frontend/src/components/` | 1h | Low |
| Add global loading state during init | `frontend/src/ChatContext.js` | 30 min | Low |
| Replace `window.prompt`/`confirm` with custom modals | `frontend/src/components/`, `frontend/src/pages/` | 1.5h | Low |
| Fix hardcoded pixel positioning in ChatInput | `frontend/src/components/ChatInput.js` | 30 min | Low |
| Add ArtifactPanel fallback for mobile | `frontend/src/components/ArtifactPanel.js` | 30 min | Low |
| Add retry logic for non-auth API errors | `frontend/src/services/apiService.js` | 30 min | Low |

### 8.5 Frontend Tests

| Task | File(s) | Effort | Risk |
|------|---------|--------|------|
| Test actual `ChatContext` logic | `frontend/src/ChatContext.test.js` | 2h | Medium |
| Test `apiService.js` HTTP calls | `frontend/src/services/apiService.test.js` | 1h | Low |
| Test `ChatPage` component | `frontend/src/pages/ChatPage.test.js` | 1.5h | Medium |
| Test `LoginPage` / `RegisterPage` | `frontend/src/pages/LoginPage.test.js`, `RegisterPage.test.js` | 1h | Low |
| Test `MessageBubble` / `AIResponseBlock` | `frontend/src/components/MessageBubble.test.js`, `AIResponseBlock.test.js` | 1h | Low |

### 8.6 Documentation

| Task | File(s) | Effort | Risk |
|------|---------|--------|------|
| Add LICENSE | `LICENSE` | 15 min | Low |
| Write CONTRIBUTING.md | `CONTRIBUTING.md` | 30 min | Low |
| Document missing env vars | `backend/.env.example` | 15 min | Low |
| Add API docs for frontend devs | `docs/API.md` or static OpenAPI export | 1h | Low |
| Add frontend README | `frontend/README.md` | 30 min | Low |
| Add troubleshooting guide | `docs/TROUBLESHOOTING.md` | 30 min | Low |
| Add deployment guide | `docs/DEPLOYMENT.md` | 1h | Low |
| Add CHANGELOG | `CHANGELOG.md` | 15 min | Low |

**Total estimated effort: ~25 hours**

### Implementation Order

1. **Security & Infrastructure** (8.1) — can be deployed immediately, no breaking changes
2. **Backend Bug Fixes** (8.2) — deploy with 8.1
3. **Backend Tests** (8.3) — additive, increases confidence
4. **Frontend Tests** (8.5) — additive
5. **Frontend Improvements** (8.4) — some are breaking (state refactor); deploy separately
6. **Documentation** (8.6) — can be merged continuously

### Definition of Done for Phase 8

- [ ] All 🔴 Critical audit findings resolved
- [ ] All `/api/*` endpoints require authentication (except `/api/auth/*` and `/health`)
- [ ] CI includes `pip-audit` and `npm audit`
- [ ] Backend test coverage for admin, artifacts, streaming, web search, advanced RAG, rate limiting
- [ ] Frontend tests for ChatContext, apiService, and at least 3 major components
- [ ] LICENSE and CONTRIBUTING.md present
- [ ] `.env.example` documents all search engines and `LLM_BASE_URLS`
- [ ] No dead references or doc-to-code discrepancies
