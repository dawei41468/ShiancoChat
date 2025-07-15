# Web Search Implementation Plan for ShiancoChat

## Overview
This plan outlines the integration of web search functionality into ShiancoChat to enable Retrieval-Augmented Generation (RAG). This allows the LLM to fetch real-time internet data using Brave Search, augmenting responses to fill knowledge gaps from training data. The implementation builds on the existing multi-LLM backend (Ollama and OpenAI-compatible) and React frontend.

## Key Insights
- **Frontend**: React-based with ChatContext for managing messages and conversations. API calls handled via apiService.js, streaming to backend endpoints.
- **Backend**: FastAPI routers (ollama.py, openai.py) for LLM interactions, MongoDB for storage.
- **Provider**: Brave Search (privacy-focused, integrated via MCP tool `brave_web_search`).
- **Inspired by open-webui**: Web search injects results into prompts for RAG, triggered via UI or commands.

## Architecture
Extend the chat flow to optionally perform web search before LLM queries.

### Backend Changes (FastAPI)
- **New Utility File**: Create `backend/utils/search.py`.
  - Function: `perform_web_search(query)` – Uses MCP tool `<use_mcp_tool>` with `server_name: brave-search`, `tool_name: brave_web_search` (limit to 5-10 results).
  - Extract snippets/summaries and format as prompt augmentation (e.g., "Web results: [results]. Answer: [user prompt]").
- **Modify Chat Endpoints** (`/api/ollama/chat` and `/api/openai/chat`):
  - Add optional `enable_web_search` flag in request payload.
  - If enabled, call `perform_web_search`, augment prompt, then query LLM.
  - Handle errors (fallback to standard query) and streaming.
- **Configuration**: Use environment variables for any Brave Search params if needed.

### Frontend Changes (React)
- **UI Updates** (ChatPage.js/ChatInput.js): The "Web Search" button already exists in the `ChatInput` component. The logic to toggle a web search state will be implemented. This state will be passed along with the chat message.
- **API Service**: Update apiService.js to include `enable_web_search` in payloads.
- **Display**: Show search results in a collapsible UI section before LLM response.

### Integration Flow
1. User sends message with web search enabled.
2. Frontend sends API request with flag.
3. Backend performs search via MCP, augments prompt.
4. Queries LLM and streams response.
5. Stores in MongoDB.

## Mermaid Diagram
```mermaid
graph TD
    A[User Input] --> B{Web Search Enabled?}
    B -->|Yes| C[Call Brave Search via MCP]
    C --> D[Augment Prompt with Results]
    B -->|No| E[Original Prompt]
    D --> F[Query LLM (Ollama/OpenAI)]
    E --> F
    F --> G[Stream Response to Frontend]
    G --> H[Display in UI & Store in MongoDB]
```

## Benefits & Considerations
- **Seamless**: Minimal disruption to existing architecture.
- **Fallback**: If search fails, proceed without augmentation.
- **Extensibility**: Easy to add providers or auto-detection later.
- **Testing**: Ensure streaming works with augmented prompts; test offline scenarios.

## Next Steps
- Refine based on feedback.
- Implement in code mode.
