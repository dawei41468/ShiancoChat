from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from starlette.requests import ClientDisconnect
import httpx
import re
import logging
from backend.models import StreamRequestPayload
from backend.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/chat")
async def chat_with_ollama(input: StreamRequestPayload, request: Request, db=Depends(get_db)):
    payload = {
        "model": input.model.replace("ollama/", "") if input.model else "",
        "messages": [],
        "stream": True,
    }

    if input.conversation_id:
        messages_cursor = db.messages.find({"conversation_id": input.conversation_id}).sort("timestamp", 1)
        async for msg_doc in messages_cursor:
            role = 'assistant' if msg_doc["sender"] in ['ai', 'assistant'] else msg_doc["sender"]
            content = msg_doc["text"]
            if role == 'assistant':
                clean_content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)
                clean_content = re.sub(r'<answer>|</answer>', '', clean_content, flags=re.DOTALL).strip()
                content = clean_content
            if content:
                payload["messages"].append({"role": role, "content": content})

    async def stream_response():
        """
        Streams the raw response to the client, handling disconnection.
        This function now directly handles the httpx call to ensure
        the connection to the LLM is closed immediately on client disconnect.
        """
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream("POST", "http://localhost:11434/api/chat", json=payload) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
                        yield chunk
        except ClientDisconnect:
            print("Client disconnected. Stopping Ollama stream.")
        except httpx.RequestError as e:
            print(f"An error occurred while requesting from Ollama: {e}")
            # In a real application, you might want more robust error handling here
            return

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(stream_response(), media_type="text/event-stream", headers=headers)

async def generate_title(messages: list, model: str):
   """Generates a title from a short conversation history using Ollama."""
   payload = {
       "model": model.replace("ollama/", "") if model else "",
       "messages": messages + [{"role": "user", "content": "Summarize the above conversation in 5 words or less."}],
       "stream": False,
   }
   try:
       async with httpx.AsyncClient(timeout=30) as client:
           response = await client.post("http://localhost:11434/api/chat", json=payload)
           response.raise_for_status()
           data = response.json()
           title = data.get("message", {}).get("content", "New Chat")
           # Clean up the title by removing quotes
           return title.strip().strip('"')
   except httpx.RequestError as e:
       logger.error(f"An httpx error occurred during Ollama title generation: {e}")
       return "New Chat"
   except Exception as e:
       logger.error(f"An unexpected error occurred during Ollama title generation: {e}")
       return "New Chat"