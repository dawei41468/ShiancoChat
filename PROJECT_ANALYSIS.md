# ShiancoChat Project Analysis

## Overview

ShiancoChat is a full-stack chat application that serves as a multi-provider LLM gateway. Users can connect to OpenAI-compatible APIs (LM Studio, vLLM), local Ollama instances, or remote providers. The app supports real-time streaming chat, document upload with RAG (Retrieval-Augmented Generation), web search augmentation, conversation management, and admin-level tool governance.

## Architecture

```
┌─────────────────┐      HTTP/SSE       ┌─────────────────┐      TCP       ┌─────────────┐
│   React 19      │ ◄─────────────────► │   FastAPI       │ ◄────────────► │   MongoDB   │
│   (frontend)    │                     │   (backend)     │                │             │
└─────────────────┘                     └─────────────────┘                └─────────────┘
                                              │
                                              │ HTTP
                                              ▼
                                        ┌─────────────┐
                                        │  LLM Server │
                                        │ (OpenAI/    │
                                        │  Ollama)    │
                                        └─────────────┘
```

### Frontend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React 19 | UI rendering |
| Build Tool | Craco | Webpack config overrides |
| Styling | Tailwind CSS 3 | Utility-first CSS |
| Package Manager | Yarn 1.x | Dependency management |
| Routing | react-router-dom 7 | SPA navigation |
| HTTP Client | axios | API requests |
| Icons | lucide-react | SVG icons |
| Markdown | react-markdown + react-syntax-highlighter | Formatted LLM output |
| Testing | Jest + @testing-library/react | Component & service tests |

**State Management:**
- `AuthContext` — JWT tokens, login/logout/session expiry
- `ChatContext` — Messages, conversations, streaming, documents
- `LanguageContext` — EN/CN translations
- `ThemeContext` — Dark/light mode

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | FastAPI 0.104 | Async API framework |
| Server | uvicorn 0.24 | ASGI server |
| Database Driver | motor 3.3 | Async MongoDB driver |
| Auth | python-jose + passlib | JWT tokens, bcrypt passwords |
| Rate Limiting | slowapi | Per-user + per-IP limits |
| HTTP Client | httpx 0.25 | Async HTTP for LLM calls |
| Embeddings | sentence-transformers 3.0 | Dense vector generation |
| Document Parsing | pypdf, python-docx, openpyxl | PDF/DOCX/XLSX extraction |
| Web Search | duckduckgo-search, aiohttp | DuckDuckGo + Brave Search |
| Testing | pytest + pytest-asyncio + mongomock-motor | In-memory test DB |

**Database Collections:**
- `users` — Accounts, roles, password hashes
- `conversations` — Chat threads with metadata
- `messages` — Individual chat messages
- `documents` — Uploaded file metadata
- `document_chunks` — Chunked text with embeddings
- `knowledge_spaces` — Grouped document collections
- `refresh_tokens` — Revocable refresh tokens
- `tools` / `tool_audit_events` — Tool registry and audit log

## Feature Inventory

### Core Chat
- Real-time SSE streaming with `<think>` / `<answer>` tag parsing
- Multi-provider support (OpenAI-compatible, Ollama)
- Model policy layer (fast, balanced, deep, local/private)
- Manual model override for power users
- Automatic conversation titling via LLM

### Document & RAG
- Upload: PDF, DOCX, TXT, XLSX
- Recursive text chunking with overlap
- Sentence-transformers embeddings (all-MiniLM-L6-v2 or bge-m3)
- In-memory numpy cosine similarity search
- MongoDB Atlas Vector Search support (auto-detected fallback)
- Hybrid search (vector + full-text) option
- Knowledge spaces for persistent document grouping

### Web Search
- DuckDuckGo (default, no API key)
- Brave Search (requires `BRAVE_API_KEY`)
- Result aggregation and citation formatting

### Tool Governance
- Admin-configurable tool registry (web search, file search)
- Role-based access control per tool
- Tool audit logging (who used what, when, with what result)

### Workflows & Artifacts
- Predefined workflows: summary, translation, comparison, report, action items
- Structured output parsing
- Artifact panel for editable generated documents

### Auth & Security
- JWT access tokens (30 min) + refresh tokens (7 days)
- Logout endpoint with refresh token revocation
- Per-user rate limiting (authored by email, fallback to IP)
- Password minimum length enforcement (configurable)
- CORS configured for frontend origin

### Admin
- Admin Panel route (role-gated)
- Tool configuration UI
- User role management

### UI/UX
- Dark/light theme toggle
- English / Chinese language switch
- Responsive sidebar with conversation management
- Full-screen chat input
- Auto-scroll to latest message
- Suggested prompts for new conversations

## Testing

| Suite | Count | Framework | Key Mocks |
|-------|-------|-----------|-----------|
| Backend | 77 | pytest + asyncio | mongomock-motor (DB), FakeHttpxClient (LLM), fake embeddings |
| Frontend | 21 | Jest + React Testing Library | apiService, ChatContext, AuthContext, react-router-dom |

**CI/CD:** GitHub Actions runs backend tests, frontend tests, and frontend build on every PR/push to `main`. No live MongoDB or LLM required in CI.

## Environment Configuration

See `.env.example` files in `backend/` and `frontend/` for all available options. Key variables:

- `SECRET_KEY` — JWT signing key (≥32 chars)
- `MONGO_URL` / `DB_NAME` — MongoDB connection
- `LLM_BASE_URL` — OpenAI-compatible endpoint
- `EMBEDDING_MODEL_NAME` — `all-MiniLM-L6-v2` or `bge-m3`
- `VECTOR_SEARCH_ENABLED` — Toggle Atlas Vector Search
- `WEB_SEARCH_ENGINES` / `BRAVE_API_KEY` — Search provider config

## Deployment Assumptions

- MongoDB: Atlas M10+ recommended for Vector Search; local MongoDB works for development
- HTTPS required in production
- `ENVIRONMENT=production`, `DEBUG=False`
- Strong `SECRET_KEY` rotated periodically
- Reverse proxy (Nginx/Traefik/Cloudflare) for TLS termination

## Known Limitations

- RAG search loads all user chunks into memory (O(n) per query). Atlas Vector Search mitigates this when enabled.
- Streaming protocol uses custom XML tags (`<think>`, `<answer>`). Standard SSE events are planned for a future protocol upgrade.
- No Docker image yet; deployed via direct `uvicorn` + static file serving.
- Embedding model switch (e.g., to bge-m3) requires re-computing all existing chunk embeddings.

## Roadmap

See `docs/PLAN.md` for the detailed implementation roadmap and `docs/AUDIT_FINDINGS.md` for the latest comprehensive audit.
