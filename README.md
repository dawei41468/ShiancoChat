# ShiancoChat

ShiancoChat is an interactive chat application powered by a local Large Language Model (LLM). It features real-time chat, conversation history management, dark/light mode theming, and multi-language support (English and Chinese).

## Features

*   **Interactive Chat:** Engage in real-time conversations with a local LLM.
*   **Conversation Management:** Create new chats, view recent conversations, rename, and delete existing ones.
*   **Theming:** Switch between dark and light modes for a personalized experience.
*   **Multi-language Support:** UI available in English and Chinese.
*   **LLM Integration:** Connects with a local DeepSeek-R1 distilled model served via LM Studio.

## Setup and Installation

To get ShiancoChat up and running on your local machine, follow these steps:

### Prerequisites

*   **Node.js and Yarn:** For the frontend.
*   **Python 3.8+ and pip:** For the backend.
*   **MongoDB:** A running MongoDB instance (local or cloud-hosted).
*   **LM Studio:** To serve the local DeepSeek-R1 distilled model.

### 1. Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Configure environment variables:**
    Create a `.env` file in the `backend/` directory with the following content:
    ```
    MONGO_URL=your_mongodb_connection_string
    DB_NAME=shiancochat_db
    LLM_BASE_URL=http://localhost:1234 # Or your LM Studio server address
    PORT=4100 # Or your desired backend port
    ```
    *Replace `your_mongodb_connection_string` with your actual MongoDB connection string.*
5.  **Run the backend server:**
    ```bash
    uvicorn server:app --host 0.0.0.0 --port 4100 --reload
    ```
    The backend server should now be running on `http://localhost:4100`.

### 2. Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```
2.  **Install dependencies:**
    ```bash
    yarn install
    ```
3.  **Configure environment variables:**
    Create a `.env` file in the `frontend/` directory with the following content:
    ```
    REACT_APP_BACKEND_URL=http://localhost:4100 # Or your backend server address
    ```
4.  **Run the frontend development server:**
    ```bash
    yarn start
    ```
    The frontend application should now be accessible at `http://localhost:4141` (or another port if 4141 is in use).

### 3. LM Studio Setup

1.  **Download and Install LM Studio:** Get it from [LM Studio website](https://lmstudio.ai/).
2.  **Download the DeepSeek-R1 distilled model:**
    *   Open LM Studio.
    *   Go to the "Search" tab.
    *   Search for `deepseek/deepseek-r1-0528-qwen3-8b` and download it.
3.  **Load and Serve the Model:**
    *   Go to the "My Models" tab.
    *   Select the downloaded `deepseek/deepseek-r1-0528-qwen3-8b` model.
    *   Go to the "Local Inference Server" tab (usually the `>` icon on the left sidebar).
    *   Click "Start Server". Ensure the server is running on `http://localhost:1234` (or the URL configured in your backend's `.env` file).

## Usage

Once both the backend and frontend servers are running, open your web browser and navigate to `http://localhost:4141`. You can start a new chat, send messages, and interact with the local LLM.

## Project Analysis

For a detailed analysis of the project's architecture, tech stack, completed features, and remaining tasks, please refer to the `PROJECT_ANALYSIS.md` file in the root directory of this repository.
