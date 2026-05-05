# ShiancoChat

ShiancoChat is a full-stack chat application powered by Large Language Models (LLMs). It features real-time streaming chat, conversation history management, document upload with RAG (Retrieval-Augmented Generation), web search, dark/light mode theming, and multi-language support (English and Chinese).

## Features

- **Interactive Chat:** Engage in real-time conversations with local or remote LLMs.
- **Streaming Responses:** See responses generate token-by-token with reasoning visibility.
- **Conversation Management:** Create, view, rename, and delete conversations.
- **Document Upload & RAG:** Upload PDF, DOCX, and TXT files for knowledge-grounded answers.
- **Web Search:** Augment answers with live web search results.
- **Theming:** Switch between dark and light modes.
- **Multi-language Support:** UI available in English and Chinese.
- **Multi-Provider LLM Support:** Connect to OpenAI-compatible APIs (LM Studio, vLLM) or Ollama.

## Tech Stack

- **Frontend:** React 19, Tailwind CSS, Craco, Yarn
- **Backend:** FastAPI, Python 3.12, Motor (async MongoDB driver)
- **Database:** MongoDB (local or Atlas)
- **LLM Integration:** OpenAI-compatible APIs, Ollama

## Prerequisites

- **Node.js** 20+ and **Yarn** 1.x (frontend)
- **Python** 3.12+ and **pip** (backend)
- **MongoDB** 5.0+ (local or Atlas)
- An **LLM server** such as:
  - [LM Studio](https://lmstudio.ai/) (OpenAI-compatible local server)
  - [Ollama](https://ollama.com/) (local model runner)
  - Any OpenAI-compatible API endpoint

## Setup and Installation

### 1. Backend Setup

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**Configure environment variables:**

```bash
cp .env.example .env
# Edit .env with your settings (MongoDB URL, LLM base URL, secret key, etc.)
```

**Run the backend server:**

```bash
uvicorn server:app --host 0.0.0.0 --port 4100 --reload
```

The API will be available at `http://localhost:4100`.

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
yarn install
```

**Configure environment variables:**

```bash
cp .env.example .env
# Edit .env if your backend runs on a different host/port
```

**Run the frontend development server:**

```bash
yarn start
```

The app will be available at `http://localhost:4141`.

### 3. LLM Server Setup (LM Studio Example)

1. Download and install [LM Studio](https://lmstudio.ai/).
2. Download a model (e.g., `deepseek/deepseek-r1-0528-qwen3-8b`).
3. Go to the **Local Inference Server** tab and click **Start Server**.
4. Ensure the server is running on the URL configured in your backend `.env` (default: `http://localhost:1234`).

## Testing

### Backend Tests

The backend test suite uses `pytest` with `mongomock-motor` for an in-memory MongoDB and mocks all external services (LLM, embeddings, web search). **No live MongoDB or LLM is required.**

```bash
cd backend
source venv/bin/activate
pytest tests/ -q
```

### Frontend Tests

The frontend test suite uses Jest and React Testing Library.

```bash
cd frontend
yarn test --watchAll=false
```

Run with coverage:

```bash
yarn test --watchAll=false --coverage
```

## CI/CD

This project uses GitHub Actions for continuous integration:

- **Backend tests** run on every PR and push to `main`.
- **Frontend tests** and **frontend build** are validated on every PR and push to `main`.

See `.github/workflows/ci.yml` for details.

## Production Deployment Assumptions

- **MongoDB:** Use MongoDB Atlas (M10+ recommended) or a managed MongoDB instance. Atlas Vector Search can be enabled for scalable semantic search.
- **Secret Management:** Generate a strong `SECRET_KEY` (at least 32 random characters) and rotate it periodically. Never commit secrets to version control.
- **CORS:** Configure `ALLOWED_HOSTS` and CORS settings to match your production domain.
- **HTTPS:** Always serve the application over HTTPS in production.
- **Rate Limiting:** The backend includes per-user rate limiting. Ensure your reverse proxy (e.g., Nginx, Traefik, Cloudflare) does not inadvertently bypass it.
- **Environment:** Set `ENVIRONMENT=production` and `DEBUG=False` in production.
- **LLM Endpoint:** Use a reliable, high-availability LLM API or local inference cluster.

## Project Structure

```
.
├── backend/              # FastAPI backend
│   ├── routers/          # API route handlers
│   ├── services/         # Business logic
│   ├── models/           # Pydantic/MongoDB models
│   ├── tests/            # Pytest test suite
│   └── requirements.txt  # Python dependencies
├── frontend/             # React frontend
│   ├── src/              # Source code
│   │   ├── components/   # React components
│   │   ├── services/     # API client
│   │   └── *.test.js     # Jest tests
│   └── package.json      # Node dependencies (Yarn)
└── .github/workflows/    # CI/CD configuration
```

## Current Priorities

The project is in **Phase 8: Production Hardening**. See [`docs/AUDIT_FINDINGS.md`](docs/AUDIT_FINDINGS.md) for the comprehensive audit report and [`docs/PLAN.md`](docs/PLAN.md) for the implementation roadmap.

## License

[Add your license here]
