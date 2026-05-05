# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Security: MIME type magic verification for file uploads (`python-magic`)
- Security: Content-Security-Policy meta tag in frontend
- Security: Security headers middleware (`X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, `Referrer-Policy`)
- Security: Request body size limit (10MB)
- Security: TrustedHostMiddleware using `allowed_hosts` config
- Security: Per-route ErrorBoundaries for graceful error isolation
- Security: Focus trapping in SettingsSheet (keyboard accessibility)
- Security: Abort in-flight requests on logout
- Health check endpoint (`/api/health`) with MongoDB connectivity verification
- Dead-letter endpoint for failed embedding documents (`/api/documents/dead-letter`)
- Exponential backoff retry for embedding background tasks
- Frontend `.env.example` with search engine and LLM endpoint documentation

### Changed
- ChatInput refactored from `position: fixed` with hardcoded pixels to flexbox layout
- ArtifactPanel now accessible on mobile as a slide-out overlay

### Fixed
- `PROJECT_ANALYSIS.md` dead reference to deleted `AI_APP_ROADMAP.md`
- `backend/routers/__init__.py` empty file removed
- `server.py` dev-only warning comment for `reload=True`

## [0.1.0] - 2026-05-05

### Added
- Initial release of ShiancoChat
- Streaming chat with OpenAI-compatible LLM endpoints
- RAG with hybrid search, MMR re-ranking, and knowledge spaces
- Web search (DuckDuckGo, Brave, Bing, Sougou)
- Artifact generation and editing
- Admin tool governance with audit logging
- User authentication with JWT and refresh tokens
- Dark/light theme support
- Internationalization (i18n)
- Rate limiting with slowapi
