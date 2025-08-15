# ShiancoChat Project Analysis (Updated)

## Project Overview

ShiancoChat is a full-stack web application designed for interactive conversations with Large Language Models (LLMs). It has evolved into a sophisticated, multi-provider LLM gateway, allowing users to connect to and switch between different LLM backends, including any OpenAI-compatible API (like LM Studio) and local Ollama instances. The application provides a user-friendly interface for chat, including features like conversation history, dynamic model selection, automatic conversation titling, dark/light mode, and multi-language support. The application is structured with a React.js frontend and a FastAPI/Python backend, leveraging MongoDB for data persistence.

## Project Setup and Architecture

### Frontend

The frontend is a React.js application, customized with Craco. It is responsible for rendering the user interface, handling user interactions, and communicating with the backend API.

*   **UI Framework:** React.js
*   **Styling:** Tailwind CSS for a utility-first CSS approach, configured with custom themes for dark and light modes.
*   **State Management:** React's built-in `useState` and `useEffect` hooks, along with `Context` (`LanguageContext`, `ChatContext`), manage component-level and global application state.
*   **API Communication:** `axios` is used for making HTTP requests to the FastAPI backend. The `apiService.js` module contains a `streamChatResponse` function that dynamically routes requests to either the `/api/ollama/chat` or `/api/openai/chat` endpoint based on the selected model's prefix.
*   **Routing:** `react-router-dom` is used to manage navigation between the main pages: `Chat`, `Tutorials`, `FAQ`, and `Settings`.
*   **Internationalization:** A custom `LanguageContext` provides English and Chinese translations for various UI elements.
*   **Markdown and Syntax Highlighting:** `react-markdown` and `react-syntax-highlighter` are used to render formatted LLM responses, including code blocks.
*   **Components:** The application is composed of reusable React components such as `Sidebar`, `TopBar`, `ChatInput`, `MessageBubble`, `AIResponseBlock`, `SuggestedPrompts`, and `ConversationActions`.

### Backend

The backend is a FastAPI application that serves as a multi-provider API gateway for the chat functionality. It handles business logic, interacts with the database, and communicates with various local LLM services.

*   **Web Framework:** FastAPI, an asynchronous web framework for building APIs with Python 3.7+.
*   **ASGI Server:** `uvicorn` is used to run the FastAPI application.
*   **Database:** MongoDB, a NoSQL database, is used for storing chat conversations and individual messages. `motor` is employed as the asynchronous MongoDB driver.
*   **LLM Integration:** The backend features a modular, router-based architecture that can communicate with multiple LLM providers.
    *   **OpenAI-Compatible Router:** Handles communication with any OpenAI-compatible API (e.g., LM Studio, vLLM), configured via the `LLM_BASE_URL` environment variable.
    *   **Ollama Router:** Handles communication with a local Ollama instance.
*   **Dynamic Title Generation:** A sophisticated title generation feature automatically creates a summary title for new conversations. It intelligently uses the currently selected model (either Ollama or OpenAI-compatible) to generate the title.
*   **Configuration:** Environment variables (`.env` file) manage sensitive information and configuration settings like MongoDB connection URL and LLM base URL.
*   **CORS:** `CORSMiddleware` is configured to allow cross-origin requests from the frontend.

## Tech Stack

*   **Frontend:**
    *   React.js
    *   JavaScript (ES6+)
    *   HTML5
    *   CSS3 (Tailwind CSS)
    *   `axios` (HTTP client)
    *   `react-router-dom` (Routing)
    *   `lucide-react` (Icons)
    *   `react-markdown` (Markdown rendering)
    *   `react-syntax-highlighter` (Code highlighting)
*   **Backend:**
    *   Python 3.x
    *   FastAPI
    *   `uvicorn` (ASGI server)
    *   `motor` (Async MongoDB driver)
    *   `httpx` (Async HTTP client)
    *   `python-dotenv` (Environment variable management)
*   **Database:** MongoDB
*   **LLM Services:**
    *   OpenAI-compatible APIs (e.g., LM Studio)
    *   Ollama

## Completed Features

*   **Core Chat Functionality:**
    *   Users can send messages to the LLM.
    *   LLM responses are streamed in real-time.
    *   AI responses are formatted to include a collapsible "Thinking..." section and the final answer.
    *   Conversations are managed: new chats can be created, existing conversations are listed, selected, renamed, and deleted.
    *   All messages and conversations are persistently stored in MongoDB.
*   **Multi-LLM Support:**
    *   **Provider-Agnostic Backend:** The backend can communicate with both OpenAI-compatible APIs and Ollama instances.
    *   **Dynamic Model Selection:** The application can fetch and display a list of available models from the configured LLM service, allowing the user to switch between them.
*   **User Interface & Experience:**
    *   A clean and responsive chat interface.
    *   **Dark Mode and Light Mode:** The UI supports both dark and light themes.
    *   **Language Options:** The application supports switching between English and Chinese.
    *   **Automatic Conversation Titling:** New conversations are automatically given a summary title generated by the selected LLM.
    *   Suggested prompts are displayed to help users start conversations.
    *   The chat input area can be expanded to full screen.
    *   Automatic scrolling to the latest message.
    *   **Informational Pages:** Fully implemented `Tutorials`, `FAQ`, and `Settings` pages provide users with guidance, answers to common questions, and UI customization options.
*   **LLM Integration:**
    *   Successful integration with local LLM services like LM Studio and Ollama.

## Remaining Tasks

*   **Future LLM Enhancements:**
    *   **MCP Server Access for LLM:** Integration of an MCP server to allow the local LLM to browse the live internet for up-to-date information.

## Document Management Enhancements Based on Open-WebUI Best Practices

### Insights from Open-WebUI
Open-WebUI handles document uploads with advanced features like chunking, vector embeddings, and persistent storage using databases like Qdrant. Best practices include:
- Chunking documents for efficient processing and retrieval.
- Generating embeddings for semantic search.
- Using persistent storage (e.g., SQLite or vector databases) instead of in-memory solutions.
- Enhancing user interfaces for document previews and search results.

### Proposed Modifications
1. **Document Chunking:** Use RecursiveCharacterTextSplitter to break documents into chunks.
2. **Embeddings and Search:** Integrate sentence-transformers to generate embeddings and add basic search functionality.
3. **Persistent Storage:** Switch from in-memory storage to SQLite for reliability.
4. **Frontend Enhancements:** Update components to display previews and integrate search.

### Step-by-Step Implementation Plan
- [ ] Update backend/models.py to include 'chunks' and 'embeddings' fields.
- [ ] Modify backend/routers/documents.py to handle chunking and embedding generation during uploads.
- [ ] Implement SQLite integration in backend for persistent storage.
- [ ] Enhance frontend components (e.g., ChatInput, MessageBubble) for search and previews.
- [ ] Test the updated system for errors and performance.