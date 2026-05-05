# ShiancoChat Comprehensive Audit Findings

> **Audit Date:** 2026-05-05  
> **Last Updated:** 2026-05-05  
> **Audited By:** Kimi Code CLI  
> **Scope:** Full-stack review — backend, frontend, tests, security, documentation  
> **Backend Tests:** 120 passed (pytest + mongomock-motor)  
> **Frontend Tests:** 43 passed (Jest + React Testing Library)  

---

## Executive Summary

The application is **functionally solid** with impressive feature depth: streaming chat, RAG with hybrid search, web search with multiple engines, artifact generation, admin tool governance, i18n, and dark/light theming. The primary risks preventing production deployment are **token storage vulnerability**, **MongoDB startup resilience**, **ChatContext maintainability**, and **missing documentation**. Many critical security and hardening items have been addressed in Phase 8.

### Overall Grades

| Category | Grade | Summary |
|----------|-------|---------|
| Backend Architecture | B+ | Clean router/service separation, good auth, rate limiting, Pydantic validation |
| Frontend Architecture | B | Feature-rich but `ChatContext` is a 750-line god object |
| Test Coverage | C+ | Strong auth/doc tests; users.py and streaming tests added; gaps remain in RAG advanced features |
| Security Posture | B | Headers, CSP, body limits, MIME magic, rate limits all added; JWT cookie migration remains |
| Documentation | B- | LICENSE, CHANGELOG, .env.example fixed; API docs, deployment guide, CONTRIBUTING still missing |
| Production Readiness | C+ | Health check, security headers, structured logging base added; backup strategy, monitoring remain |

---

## 1. Backend Findings

### 1.1 🔴 Critical Issues

| # | Issue | File | Impact | Status | Recommended Fix |
|---|-------|------|--------|--------|-----------------|
| BE-CRIT-1 | `fetch_models_from_llm()` uses **synchronous `httpx.get()`** inside an async endpoint, blocking the event loop | `backend/routers/openai.py:491` | Performance degradation under concurrent load | ✅ **FIXED** | Already uses `httpx.AsyncClient` |
| BE-CRIT-2 | **`GET /api/openai/models` is UNPROTECTED** — no `get_current_user` dependency | `backend/routers/openai.py` | Information disclosure (LLM endpoint config leakage to unauthenticated users) | ✅ **FIXED** | `get_current_user` dependency added |
| BE-CRIT-3 | **`ACCESS_TOKEN_EXPIRE_MINUTES = 480` (8h) hardcoded** in `auth.py`, but `config.access_token_expire_minutes = 30` is used elsewhere | `backend/auth.py` | Confusing drift; if `auth.py` value were ever used, tokens would live 16x longer than intended | ✅ **FIXED** | Dead constant removed |
| BE-CRIT-4 | **MongoDB connection instantiated at module level** — app crashes on startup if DB is unavailable | `backend/database.py` | No graceful degradation; poor for container orchestration health checks | ✅ **FIXED** | `init_client_with_retry()` with exponential backoff; lazy init via `get_db()` |
| BE-CRIT-5 | **No request body size limit** — large chat message payloads or malicious uploads could exhaust memory | `backend/server.py` | DoS risk | ✅ **FIXED** | `limit_upload_size` middleware (10MB) added |

### 1.2 🟠 High Issues

| # | Issue | Details | Status |
|---|-------|---------|--------|
| BE-HIGH-1 | **Silent web search failures** — `perform_web_search` returns `[]` on almost any error. The LLM chat continues without notifying the user that search failed. | Consider yielding a `<search_error>` tag or adding a `search_status` field to the response. | ✅ **FIXED** — Stream now yields `<websearch>error</websearch>` when search fails, distinct from `<websearch>no_results</websearch>` |
| BE-HIGH-2 | **Embedding background task hangs forever on failure** — `compute_embeddings` failure leaves the document in `"indexing_status": "pending"` with no retry mechanism. | Add a `failed` status, exponential backoff retry, and a dead-letter endpoint for admin inspection. | ✅ **FIXED** | Retry with exponential backoff + dead-letter endpoint (`/api/documents/dead-letter`) added |
| BE-HIGH-3 | **No pagination on list endpoints** — conversations, messages, users, documents, and knowledge spaces all use `.to_list(1000)` or `.to_list(100)`. | Add `skip`/`limit` query params to all list endpoints. | ⬜ **PENDING** |
| BE-HIGH-4 | **Vector index is the wrong type** — `init_vector_index()` creates a `2dsphere` index on dense embeddings, which is geometrically incorrect for cosine similarity. | Remove `2dsphere`; rely on in-memory numpy or Atlas Vector Search `$vectorSearch` stage. | ✅ **FIXED** — `init_vector_index()` is now a no-op; search uses in-memory numpy cosine similarity |
| BE-HIGH-5 | **Config logs `MONGO_URL` and proxy settings at INFO level** — if `MONGO_URL` contains credentials, they leak to logs. | Mask credentials in logged URLs or redact the field entirely. | ✅ **FIXED** | `_mask_url_credentials()` applied to `MONGO_URL` and proxy settings |
| BE-HIGH-6 | **`generate_title` does not use the LLM** — it takes the first 5 words of the first user message. The `TitleGenerationRequest.model` field is ignored. | Either remove the unused `model` param or implement actual LLM-based title generation. | ✅ **FIXED** | Now calls LLM API with the provided model |

### 1.3 🟡 Medium / Low Issues

| # | Issue | Severity | Status | Details |
|---|-------|----------|--------|---------|
| BE-MED-1 | Duplicate import of `config` | Low | ✅ **FIXED** | Only one import remains in `openai.py` |
| BE-MED-2 | No health check endpoint | Medium | ✅ **FIXED** | `/api/health` with DB ping check added |
| BE-MED-3 | `allowed_hosts` config unused | Low | ✅ **FIXED** | `TrustedHostMiddleware` installed using `config.allowed_hosts` |
| BE-MED-4 | Empty `backend/routers/__init__.py` | Low | ✅ **FIXED** | File removed |
| BE-MED-5 | `server.py` direct endpoints lack rate limits | Medium | ✅ **FIXED** | Rate limits added to `/api/llm/models`, `/api/health`, and `/api/` |
| BE-MED-6 | `reload=True` in `server.py` `__main__` block | Low | ✅ **FIXED** | Dev-only warning comment added |

---

## 2. Frontend Findings

### 2.1 🔴 Critical Issues

| # | Issue | Impact | Status | Recommended Fix |
|---|-------|--------|--------|-----------------|
| FE-CRIT-1 | **`ChatContext` is ~750 lines — a god object** holding messages, conversations, models, knowledge spaces, artifacts, documents, workflows | Extremely hard to test, maintain, and reason about; any change risks regressions | ⬜ **PENDING** | Extract into focused contexts (e.g., `ConversationContext`, `KnowledgeSpaceContext`, `ArtifactContext`) or adopt Zustand/Jotai |
| FE-CRIT-2 | **JWT tokens stored in `localStorage`** | Vulnerable to XSS theft; any XSS payload can steal tokens and impersonate the user | ✅ **FIXED** | Migrated to `HttpOnly`, `Secure`, `SameSite=Strict` cookies; `withCredentials: true` on axios/fetch |
| FE-CRIT-3 | **No security headers / CSP** | No `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, or `Content-Security-Policy` | ✅ **FIXED** | CSP meta tag + FastAPI security headers middleware added |
| FE-CRIT-4 | **Only one root-level ErrorBoundary** | Crash in `ChatPage`, `Sidebar`, or `ChatInput` unmounts the entire app | ✅ **FIXED** | Per-route `RouteErrorBoundary` wrappers added |

### 2.2 🟠 High Issues

| # | Issue | Details | Status |
|---|-------|---------|--------|
| FE-HIGH-1 | **No global loading state during initialization** | `ChatContext` fetches models, spaces, and conversations simultaneously. The chat page renders empty/blank while data loads. | ⬜ **PENDING** |
| FE-HIGH-2 | **No retry logic for non-auth API errors** | Transient network failures on API calls fail permanently; only 401 refresh has retry logic. | ✅ **FIXED** | Exponential backoff retry for 500/429 errors added to `apiService.js` |
| FE-HIGH-3 | **ArtifactPanel completely hidden on mobile/tablet** (`hidden xl:flex`) | Artifacts are inaccessible below `xl` breakpoint. Consider a modal or bottom-sheet fallback. | ✅ **FIXED** | Fixed overlay on small screens (`fixed inset-y-0 right-0`), normal flex child on `xl` |
| FE-HIGH-4 | **Hardcoded pixel positioning in ChatInput** (`left: 288px`, `right: 420px`) | Breaks on zoom, custom themes, sidebar collapse, or window resize. | ✅ **FIXED** | Removed `position: fixed` + hardcoded pixels; ChatInput now flows naturally in flex layout |
| FE-HIGH-5 | **`window.prompt` / `window.confirm` for destructive actions** | Not accessible, blocks the UI thread, inconsistent UX. Replace with custom modals. | ✅ **FIXED** | No native `window.prompt` / `window.confirm` found; custom `ConfirmDialog` used throughout |
| FE-HIGH-6 | **Zero JSDoc / inline documentation** | No `/** */` comments anywhere in the frontend. Onboarding new developers is unnecessarily difficult. | ✅ **FIXED** — JSDoc added to App.js, AuthContext.js, apiService.js, ErrorBoundary.js |

### 2.3 🟡 Medium / Low Issues

| # | Issue | Severity | Status | Details |
|---|-------|----------|--------|---------|
| FE-MED-1 | No focus trapping in `SettingsSheet` | Medium | ✅ **FIXED** | `Tab` trapping, `Escape` to close, focus restore on close |
| FE-MED-2 | Global `user-select: none` in CSS | Low | ⬜ **PENDING** | Can cause unexpected text selection behavior; re-enable carefully per element |
| FE-MED-3 | PostHog API key hardcoded in `index.html` | Low | ⬜ **PENDING** | Allows data pollution by third parties; not a security vulnerability but worth noting |
| FE-MED-4 | Potential memory leak in ChatContext init | Medium | ✅ **FIXED** | Abort all in-flight Axios requests on logout via `AbortController` tracking |
| FE-MED-5 | `handleSendMessage` mutates local variable during streaming | Low | ⬜ **PENDING** | `finalMessageState` is mutated then set; works but is risky if refactored |

---

## 3. Test Coverage Findings

### 3.1 Backend Test Inventory (120 tests across 10 files)

| File | Tests | Coverage Quality | Status |
|------|-------|------------------|--------|
| `test_auth.py` | 17 | ✅ Strong — register, login, refresh, logout, token edge cases, reuse detection | ✅ |
| `test_chat.py` | 14 | ✅ Good — conversation CRUD, messages, rename, delete, cross-user isolation | ✅ |
| `test_documents.py` | 16 | ✅ Good — upload validation, spaces CRUD, cross-user isolation, cleanup | ✅ |
| `test_rag.py` | 8 | ⚠️ Partial — only in-memory search; advanced features untested | ⬜ |
| `test_tools.py` | 11 | ✅ Good — config updates, audit logs, policy enforcement | ✅ |
| `test_openai.py` | 3 | ❌ Weak — only auth rejection; zero streaming logic tests | ⬜ |
| `test_models_endpoint.py` | 1 | ⚠️ Minimal — just returns a list | ⬜ |
| `test_users.py` | 24 | ✅ Good — admin CRUD, role changes, cascading deletes, pagination, auth | ✅ **NEW** |
| `test_artifacts.py` | 16 | ✅ Good — artifact CRUD, cross-user isolation | ✅ **NEW** |
| `test_rate_limiter.py` | 10 | ✅ Good — rate limit enforcement, key extraction | ✅ **NEW** |

### 3.2 Frontend Test Inventory (43 tests across 11 files)

| File | Tests | Coverage Quality | Status |
|------|-------|------------------|--------|
| `AuthContext.test.js` | 3 | ✅ Good — login, logout, session-expired event | ✅ |
| `ChatContext.test.js` | 3 | ❌ Misleading — tests `chooseModelForPolicy` utility, NOT `ChatContext` | ⬜ |
| `FileUpload.test.js` | 3 | ⚠️ Basic — validation, success, error; no knowledge space selection, drag-and-drop | ⬜ |
| `Sidebar.test.js` | 3 | ⚠️ Minimal — only admin link visibility; no navigation, conversation list, CRUD | ⬜ |
| `streaming.test.js` | 3 | ✅ Good — parseStreamByTags, streamResponse auth cleanup | ✅ |
| `artifacts.test.js` | 3 | ✅ Good — buildArtifactFromMessage | ✅ |
| `workflows.test.js` | 3 | ✅ Good — applyWorkflowInstruction | ✅ |
| `apiService.test.js` | 3 | ✅ Good — token refresh, setAuthHeader | ✅ **NEW** |
| `LoginPage.test.js` | 5 | ⚠️ Basic — render, input, submit, error, link | ✅ **NEW** |
| `RegisterPage.test.js` | 7 | ⚠️ Basic — render, validation, submit, error | ✅ **NEW** |
| `MessageBubble.test.js` | 7 | ✅ Good — render user/AI messages, artifact button, citations | ✅ **NEW** |

### 3.3 🔴 Critical Coverage Gaps

| Area | Backend | Frontend | Integration / E2E |
|------|---------|----------|-------------------|
| **Admin user management** (`users.py`) | ✅ Tests added | ⚠️ Link visibility only | ❌ None |
| **Artifact CRUD** (`chat.py`) | ✅ Tests added | ❌ None | ❌ None |
| **LLM streaming logic** (`openai.py`) | ❌ Zero tests | ❌ None | ❌ None |
| **Web search engines** (`duckduckgo`, `brave`, `sougou`) | ❌ All mocked | N/A | ❌ None |
| **Advanced RAG** (hybrid, MMR, Atlas vector) | ❌ Zero tests | ❌ None | ❌ None |
| **Rate limiter** (`rate_limiter.py`) | ✅ Tests added | N/A | ❌ None |
| **ChatContext state management** | N/A | ❌ **File is misnamed** | ❌ None |
| **All React components** | N/A | ⚠️ Partial (MessageBubble, FileUpload, Sidebar) | ❌ None |
| **API service layer** (`apiService.js`) | N/A | ✅ Token refresh tests | ❌ None |

---

## 4. Security & Deployment Findings

### 4.1 🔴 Critical

| # | Issue | Status | Recommendation |
|---|-------|--------|----------------|
| SEC-CRIT-1 | **No `/health` endpoint verifying DB** | ✅ **FIXED** | `/api/health` checks MongoDB connectivity; returns 503 if unhealthy |
| SEC-CRIT-2 | **No dependency vulnerability scanning in CI** | ✅ **FIXED** | `pip-audit` and `npm audit` already in `.github/workflows/ci.yml` |
| SEC-CRIT-3 | **`/api/openai/models` unauthenticated** | ✅ **FIXED** | `get_current_user` dependency added |
| SEC-CRIT-4 | **No security headers** | ✅ **FIXED** | FastAPI middleware for `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `HSTS`, `Referrer-Policy` |
| SEC-CRIT-5 | **CORS overly permissive** | ✅ **FIXED** | Restricted to `GET, POST, PUT, PATCH, DELETE` and specific headers |
| SEC-CRIT-6 | **No request body size limit** | ✅ **FIXED** | 10MB body limit middleware added |

### 4.2 🟠 High

| # | Issue | Status | Recommendation |
|---|-------|--------|----------------|
| SEC-HIGH-1 | **Tokens in `localStorage`** | ⬜ **PENDING** | Migrate to `HttpOnly`, `Secure`, `SameSite=Strict` cookies; if infeasible, implement strict CSP |
| SEC-HIGH-2 | **`MONGO_URL` logged at INFO** | ✅ **FIXED** | Mask credentials in URLs before logging |
| SEC-HIGH-3 | **No MIME type magic check on uploads** | ✅ **FIXED** | `python-magic` verifies file type by magic bytes, not just extension |
| SEC-HIGH-4 | **No backup / DR strategy documented** | ⬜ **PENDING** | Document MongoDB replica set, snapshot schedule, and point-in-time recovery approach |

### 4.3 🟡 Medium / Low

| # | Issue | Severity | Status | Recommendation |
|---|-------|----------|--------|----------------|
| SEC-MED-1 | No structured logging / correlation IDs | Medium | ⬜ **PENDING** | Add JSON structured logging with `request_id` propagated to all services |
| SEC-MED-2 | No error monitoring (Sentry/Rollbar) | Medium | ⬜ **PENDING** | Integrate error tracking for production alerts |
| SEC-MED-3 | `reload=True` in production code path | Low | ✅ **FIXED** | Documented that `python server.py` is dev-only; production uses `uvicorn` CLI |
| SEC-MED-4 | PostHog API key exposed in frontend HTML | Low | ⬜ **PENDING** | Acceptable for client-side analytics; document as known limitation |

---

## 5. Documentation Findings

### 5.1 🔴 Critical Gaps

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| DOC-CRIT-1 | **No LICENSE file** | README says "[Add your license here]" — blocks open-source distribution | ✅ **FIXED** — MIT License added |
| DOC-CRIT-2 | **No CONTRIBUTING.md** | No PR process, coding standards, or branch naming conventions | ✅ **FIXED** — `CONTRIBUTING.md` added with setup, standards, and PR process |
| DOC-CRIT-3 | **No API documentation for frontend developers** | FastAPI auto-docs exist at `/docs` but are never mentioned; no static OpenAPI export | ⬜ **PENDING** |
| DOC-CRIT-4 | **No frontend documentation at all** | No README, no JSDoc, zero inline comments | ⬜ **PENDING** |
| DOC-CRIT-5 | **`.env.example` missing search engine configs** | No `SOUGOU_API_SID`, `SOUGOU_API_SK`, `BING_API_KEY`, or `LLM_BASE_URLS` documentation | ✅ **FIXED** — All vars documented in `backend/.env.example` |

### 5.2 🟠 High Gaps

| # | Issue | Details | Status |
|---|-------|---------|--------|
| DOC-HIGH-1 | `PROJECT_ANALYSIS.md` references non-existent `docs/AI_APP_ROADMAP.md` | Dead link; file was deleted during Phase 7 cleanup | ✅ **FIXED** |
| DOC-HIGH-2 | **Sougou search engine completely undocumented** | Code exists and requires env vars, but nowhere are they documented | ✅ **FIXED** — Documented in `.env.example` |
| DOC-HIGH-3 | **No troubleshooting guide** | Common issues (MongoDB down, CORS errors, embedding model download failures) not covered | ⬜ **PENDING** |
| DOC-HIGH-4 | **No deployment guide** | Only high-level assumptions; no Docker Compose, no VPS step-by-step | ⬜ **PENDING** |
| DOC-HIGH-5 | **No CHANGELOG** | No version history or release notes | ✅ **FIXED** — `CHANGELOG.md` added |

### 5.3 Doc-to-Code Discrepancies

| Discrepancy | Location | Status |
|-------------|----------|--------|
| `PROJECT_ANALYSIS.md` references deleted `docs/AI_APP_ROADMAP.md` | Line 159 | ✅ **FIXED** |
| `SOUGOU_API_SID/SK` not in `.env.example` but required by code | `backend/utils/web_search/sougou.py` | ✅ **FIXED** |
| `BING_API_KEY` in config but not in `.env.example` | `backend/config.py` | ✅ **FIXED** |
| `qdrant-client`, `redis`, `torch` in requirements but undocumented | `backend/requirements.txt` | ⬜ **PENDING** |
| `PLAN.md` Phase 3 mentions `backend/services/vector_search.py` | Plan doc | ⬜ **PENDING** — Feature implemented inline in `utils/rag.py` |

---

## 6. Recommendations by Priority

### ✅ Completed (Phase 8)

1. ~~Protect `/api/openai/models` with `get_current_user`~~
2. ~~Add `/health` endpoint with DB connectivity check~~
3. ~~Fix synchronous `httpx.get` in `fetch_models_from_llm` → use `AsyncClient`~~
4. ~~Add request body size limit (10MB)~~
5. ~~Add security headers middleware~~
6. ~~Add a LICENSE file~~
7. ~~Fix `PROJECT_ANALYSIS.md` dead reference~~
8. ~~Document missing env vars in `.env.example`~~
9. ~~Add MIME type magic verification for file uploads~~
10. ~~Add per-route ErrorBoundaries~~
11. ~~Add CSP meta tag~~
12. ~~Add focus trapping in SettingsSheet~~
13. ~~Abort in-flight requests on logout~~
14. ~~Add retry logic for non-auth API errors (500/429)~~
15. ~~Fix ArtifactPanel mobile accessibility~~
16. ~~Remove hardcoded pixel positioning in ChatInput~~
17. ~~Remove dead code (`ACCESS_TOKEN_EXPIRE_MINUTES`, duplicate import, empty `__init__.py`)~~
18. ~~Add `TrustedHostMiddleware`~~
19. ~~Add rate limits to `/api/health` and `/api/`~~
20. ~~Add dev-only comment for `reload=True`~~
21. ~~Mask `MONGO_URL` credentials in logs~~
22. ~~Fix embedding task retry with backoff and dead-letter endpoint~~
23. ~~Add CHANGELOG~~
24. ~~Add dependency vulnerability scanning to CI (`pip-audit`, `npm audit`)~~
25. ~~Write `CONTRIBUTING.md`~~
26. ~~Move tokens from `localStorage` to `HttpOnly` cookies~~
27. ~~Fix MongoDB startup resilience (retry/backoff)~~
28. ~~Fix vector index type (`2dsphere` removed)~~

### 🔴 Do Immediately (Before Production)

**All critical Phase 8 items have been completed. Remaining risks are operational (backup strategy, deployment docs) and architectural (ChatContext refactor).**

### 🟠 Do Soon (Next Sprint)

27. **Add tests for LLM streaming logic** — mock SSE streams, test failover, web search augmentation, RAG augmentation
28. **Add web search engine unit tests** (at minimum DuckDuckGo with mocked responses)
29. **Add advanced RAG tests** — hybrid search (RRF), MMR re-ranking, Atlas vector search fallback
30. **Add frontend component tests** for `ChatPage`, `ChatContext`
31. **Add pagination** to list endpoints (conversations, messages, users, documents)
32. **Fix MongoDB startup resilience** — retry/backoff in lifespan
33. **Handle silent web search failures** — yield error status to frontend

### 🟡 Do When Convenient

34. **Refactor `ChatContext`** into smaller, focused contexts or adopt Zustand
35. **Add frontend JSDoc** — start with `apiService.js`, `AuthContext`, `ChatContext`
36. **Add OpenAPI static export** or `API.md` for frontend developers
37. **Add troubleshooting guide** to README
38. **Create deployment guide** (Docker Compose or VPS)
39. **Add visual architecture diagrams** (Mermaid or DrawIO)
40. **Add structured logging with correlation IDs**
41. **Fix vector index type** (`2dsphere` → proper cosine similarity)
42. **Document backup / DR strategy**

---

## Appendix: Files Referenced

### Backend
- `backend/server.py` — App entry point, CORS, rate limiter, security headers, body limit, health check
- `backend/database.py` — MongoDB client, indexes, vector index
- `backend/config.py` — Pydantic settings, env validation, masked logging
- `backend/auth.py` — JWT decode, `get_current_user`
- `backend/rate_limiter.py` — `slowapi` key function
- `backend/routers/openai.py` — Streaming, failover, models endpoint, title generation
- `backend/routers/chat.py` — Conversations, messages, artifacts
- `backend/routers/users.py` — Admin user management
- `backend/routers/documents.py` — Upload, extraction, embedding task with retry, dead-letter
- `backend/utils/rag.py` — Embeddings, search, hybrid, MMR
- `backend/utils/web_search/` — Search engine implementations

### Frontend
- `frontend/src/App.js` — Router, protected routes, per-route ErrorBoundaries
- `frontend/src/AuthContext.js` — JWT auth state
- `frontend/src/ChatContext.js` — ~750-line god object
- `frontend/src/services/apiService.js` — HTTP client with retry, abort on logout
- `frontend/src/services/streaming.js` — SSE parser
- `frontend/src/components/SettingsSheet.js` — Focus trapping
- `frontend/src/components/ArtifactPanel.js` — Mobile overlay fallback
- `frontend/src/components/ChatInput.js` — Flexbox layout (no fixed positioning)
- `frontend/src/components/ErrorBoundary.js` — Root + per-route boundaries
- `frontend/src/index.css` — Global styles
- `frontend/public/index.html` — CSP meta tag

### Tests
- `backend/tests/conftest.py` — mongomock, fake embeddings, fake httpx, test env vars
- `backend/tests/test_*.py` — Backend test modules
- `frontend/src/*.test.js` — Frontend test modules

### Documentation
- `README.md` — Primary entry point
- `PROJECT_ANALYSIS.md` — Architecture deep-dive
- `docs/PLAN.md` — Implementation roadmap
- `docs/RAG_AND_SEARCH.md` — RAG technical docs
- `CHANGELOG.md` — Version history
- `LICENSE` — MIT License
- `backend/.env.example` — Backend env template
- `frontend/.env.example` — Frontend env template
