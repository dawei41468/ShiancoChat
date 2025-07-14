import os
import httpx
import logging
import re
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from starlette.requests import ClientDisconnect
from backend.models import StreamRequestPayload
from backend.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://localhost:1234")

@router.post("/chat")
async def chat_with_openai(input: StreamRequestPayload, request: Request, db=Depends(get_db)):
    payload = {
        "model": input.model,
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
        Streams the raw SSE response to the client, handling disconnection.
        This function now directly handles the httpx call to ensure
        the connection to the LLM is closed immediately on client disconnect.
        """
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream("POST", f"{LLM_BASE_URL}/v1/chat/completions", json=payload, headers={"Content-Type": "application/json"}) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
                        yield chunk
        except ClientDisconnect:
            print("Client disconnected. Stopping OpenAI stream.")
        except httpx.RequestError as e:
            logger.error(f"An httpx error occurred: {e}")
            raise

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(stream_response(), media_type="text/event-stream", headers=headers)

async def generate_title(messages: list, model: str):
    """Generates a title from a short conversation history."""
    # Use the provided model for title generation
    payload = {
        "model": model,
        "messages": messages + [{"role": "user", "content": "Summarize the above conversation in 5 words or less."}],
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(f"{LLM_BASE_URL}/v1/chat/completions", json=payload, headers={"Content-Type": "application/json"})
            response.raise_for_status()
            data = response.json()
            title = data.get("choices", [{}])[0].get("message", {}).get("content", "New Chat")
            # Clean up the title by removing quotes
            return title.strip().strip('"')
    except httpx.RequestError as e:
        logger.error(f"An httpx error occurred during title generation: {e}")
        return "New Chat"

@router.get("/models")
async def get_models():
    try:
        response = httpx.get(f"{LLM_BASE_URL}/v1/models", timeout=10)
        response.raise_for_status()
        models_data = response.json()
        return {"models": [model['id'] for model in models_data.get('data', [])]}
    except (httpx.RequestError, httpx.HTTPStatusError) as e:
        logger.error(f"Failed to fetch models from LLM service: {e}")
        return {"models": ["deepseek/deepseek-r1-0528-qwen3-8b"]}