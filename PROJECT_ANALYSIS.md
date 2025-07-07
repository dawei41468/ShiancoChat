# ShiancoChat Project Analysis

## Project Overview
ShiancoChat is a full-stack web application designed for interactive conversations with a local Large Language Model (LLM). It provides a user-friendly interface for chat, including features like conversation history, dark/light mode, and multi-language support. The application is structured with a React.js frontend and a FastAPI/Python backend, leveraging MongoDB for data persistence.

## Project Setup and Architecture

### Frontend
The frontend is a React.js application, likely initialized using Create React App and customized with Craco. It is responsible for rendering the user interface, handling user interactions, and communicating with the backend API.

*   **UI Framework:** React.js
*   **Styling:** Tailwind CSS for a utility-first CSS approach, configured with custom themes for dark and light modes.
*   **State Management:** React's built-in `useState` and `useEffect` hooks manage component-level and global application state (e.g., messages, conversations, theme).
*   **API Communication:** `axios` is used for making HTTP requests to the FastAPI backend.
*   **Internationalization:** A custom `LanguageContext` provides English and Chinese translations for various UI elements, allowing users to switch languages.
*   **Components:** The application is composed of reusable React components such as `Sidebar`, `TopBar`, `ChatInput`, `MessageBubble`, `AIResponseBlock`, `SuggestedPrompts`, and `ConversationActions`.

### Backend
The backend is a FastAPI application that serves as the API layer for the chat functionality. It handles business logic, interacts with the database, and communicates with the local LLM service.

*   **Web Framework:** FastAPI, an asynchronous web framework for building APIs with Python 3.7+.
*   **ASGI Server:** `uvicorn` is used to run the FastAPI application.
*   **Database:** MongoDB, an NoSQL database, is used for storing chat conversations and individual messages. `motor` is employed as the asynchronous MongoDB driver.
*   **LLM Integration:** A dedicated `LLMService` class handles communication with the local LLM, streaming responses back to the frontend.
*   **Configuration:** Environment variables (`.env` file) manage sensitive information and configuration settings like MongoDB connection URL and LLM base URL.
*   **CORS:** `CORSMiddleware` is configured to allow cross-origin requests from the frontend.

### LLM Service
The `LLMService` within the backend is responsible for interfacing with the local LLM.

*   **Communication:** Uses `httpx` for asynchronous HTTP POST requests to the LLM's API endpoint (e.g., `http://localhost:1234/v1/chat/completions`).
*   **Streaming:** Designed to handle Server-Sent Events (SSE) for streaming LLM responses, processing chunks, and extracting content. It specifically parses `<think>` and `</think>` tags to separate the LLM's internal thought process from its final answer.
*   **Model:** Currently configured to use a fixed local model, `deepseek/deepseek-r1-0528-qwen3-8b`, served by LM Studio.

## Tech Stack

*   **Frontend:**
    *   React.js
    *   JavaScript (ES6+)
    *   HTML5
    *   CSS3 (Tailwind CSS)
    *   `axios` (HTTP client)
    *   `lucide-react` (Icons)
    *   `react-router-dom` (Though currently minimal routing for main pages)
*   **Backend:**
    *   Python 3.x
    *   FastAPI
    *   `uvicorn` (ASGI server)
    *   `motor` (Async MongoDB driver)
    *   `httpx` (Async HTTP client)
    *   `python-dotenv` (Environment variable management)
*   **Database:** MongoDB
*   **LLM:** DeepSeek-R1 distilled model (served locally via LM Studio)

## Completed Features

Based on the provided description and codebase analysis, the following features have been successfully implemented:

*   **Core Chat Functionality:**
    *   Users can send messages to the LLM.
    *   LLM responses are streamed in real-time.
    *   AI responses are formatted to include a collapsible "Thinking..." section (parsed from `<think>` tags) and the final answer.
    *   Conversations are managed: new chats can be created, existing conversations are listed, selected, renamed, and deleted.
    *   All messages and conversations are persistently stored in MongoDB.
*   **User Interface & Experience:**
    *   A clean and responsive chat interface.
    *   **Dark Mode and Light Mode:** The UI supports both dark and light themes, with the user's preference saved locally.
    *   **Language Options:** The application supports switching between English and Chinese for UI text.
    *   Suggested prompts are displayed to help users start conversations.
    *   The chat input area can be expanded to full screen for a better typing experience.
    *   Automatic scrolling to the latest message in the chat window.
*   **LLM Integration:**
    *   Successful integration with a local LM Studio server hosting the DeepSeek-R1 distilled model.

## Remaining Tasks

Based on your description, the following features are yet to be implemented:

*   **Frontend Pages:**
    *   **Tutorials Page:** The navigation for this page exists in the sidebar, but the content and functionality need to be implemented.
    *   **Settings Page:** The navigation for this page exists in the sidebar, but the content and functionality need to be implemented.
    *   **FAQ Page:** The navigation for this page exists in the sidebar, but the content and functionality need to be implemented.
*   **Future LLM Enhancements:**
    *   **MCP Server Access for LLM:** Integration of an MCP server to allow the local LLM to browse the live internet for up-to-date information. (This is explicitly noted as a later task).