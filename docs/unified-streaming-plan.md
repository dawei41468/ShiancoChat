# Unified Streaming Architecture: Implementation Plan

This document outlines the refactoring of the chat streaming architecture to a unified, event-driven protocol inspired by industry best practices like the OpenAI Assistants API. This will replace the current, inconsistent implementations in `ollama.py` and `openai.py` with a single, robust, and extensible system.

## 1. The Unified Event Protocol

All backend services (`ollama`, `openai`, etc.) will stream JSON objects representing events. The frontend will listen for these events and update the UI accordingly.

### Core Event Types:

-   **`thread.run.created`**: The run has started.
-   **`thread.run.step.in_progress`**: A reasoning step or tool call is in progress. This replaces the `<think>` tag.
-   **`thread.message.delta`**: A chunk of the final answer.
-   **`thread.run.completed`**: The run is finished.
-   **`error`**: An error occurred.

### Event Structure:

```json
{
  "event": "event.name",
  "data": { ... }
}
```

**Example Events:**

```json
// Reasoning step
{
  "event": "thread.run.step.in_progress",
  "data": { "step": "tool_calls", "details": "Searching for information about X..." }
}

// Answer chunk
{
  "event": "thread.message.delta",
  "data": { "content": "I found that..." }
}
```

## 2. Backend Refactoring

### 2.1. Create a Central Streaming Manager

Instead of having logic in each router, we can create a central module to handle the conversion to our unified protocol. Let's call it `backend/streaming_manager.py`.

### 2.2. Refactor `backend/routers/ollama.py`

This router will now use the `StreamingManager` to format its output.

```python
# backend/routers/ollama.py

# ... (imports)
# from backend.streaming_manager import StreamingManager

@router.post("/chat")
async def chat_with_ollama(input: MessageCreate, db):
    # ... (payload creation)

    async def stream_generator():
        streaming_manager = StreamingManager()
        full_response = ""
        
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream("POST", "http://localhost:11434/api/chat", json=payload) as response:
                response.raise_for_status()
                yield streaming_manager.format_event("thread.run.created")

                async for chunk in response.aiter_bytes():
                    # ... (logic to parse ollama chunk)
                    
                    # This is where you translate Ollama's output to your events
                    # For example, if you find a <think> tag:
                    if "<think>" in content:
                        thinking_text = ...
                        yield streaming_manager.format_event("thread.run.step.in_progress", {"step": "reasoning", "details": thinking_text})
                    else:
                        yield streaming_manager.format_event("thread.message.delta", {"content": content})

                yield streaming_manager.format_event("thread.run.completed")
    
    return StreamingResponse(stream_generator(), media_type="text/event-stream")
```

### 2.3. Refactor `backend/routers/openai.py`

This router will be updated similarly to use the `StreamingManager`. Since the OpenAI API is already more structured, this will be even cleaner.

```python
# backend/routers/openai.py

# ... (imports)
# from backend.streaming_manager import StreamingManager

@router.post("/chat")
async def chat_with_openai(input: MessageCreate, db):
    # ... (payload creation)

    async def stream_generator():
        streaming_manager = StreamingManager()
        
        async for chunk in generate_response(payload["model"], payload["messages"]):
            # ... (logic to parse openai chunk)
            
            # Translate OpenAI's response to your events
            # This will be more direct as OpenAI's structure is closer to our target
            event_type = openai_chunk['object'] # e.g., 'thread.run.step'
            formatted_event = streaming_manager.format_openai_chunk(openai_chunk)
            yield formatted_event

    return StreamingResponse(stream_generator(), media_type="text/event-stream")
```

## 3. Frontend Refactoring

### 3.1. Simplify `frontend/src/ChatContext.js`

The `handleSendMessage` function becomes a simple event dispatcher.

```javascript
// frontend/src/ChatContext.js

const handleSendMessage = async (text) => {
    // ... (setup code)

    try {
        const generator = apiService.streamChatResponse(payload, { signal: abortControllerRef.current.signal });

        for await (const event of generator) {
            switch (event.event) {
                case 'thread.run.created':
                    // Maybe set a "generating..." state
                    break;
                
                case 'thread.run.step.in_progress':
                    updateAIResponse({
                        thinking: (currentAIResponseMutable.thinking || '') + event.data.details,
                        isThinkingComplete: false,
                    });
                    currentAIResponseMutable.thinking += event.data.details;
                    break;

                case 'thread.message.delta':
                    updateAIResponse({
                        answer: (currentAIResponseMutable.answer || '') + event.data.content,
                    });
                    currentAIResponseMutable.answer += event.data.content;
                    break;

                case 'thread.run.completed':
                    updateAIResponse({ isThinkingComplete: true });
                    setIsTyping(false);
                    break;
                
                case 'error':
                    // Handle error
                    break;
            }
        }
    } catch (error) {
        // ... (error handling)
    }
};
```

### 3.2. Update `frontend/src/services/streaming.js`

The streaming service remains largely the same as in the previous plan, ensuring it parses each SSE `data` field as JSON.

This new architecture will be significantly more robust, maintainable, and scalable. It establishes a clean separation of concerns and a professional API contract between your frontend and backend.