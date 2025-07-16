import os
import httpx
import logging
import re
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from starlette.requests import ClientDisconnect
from backend.models import StreamRequestPayload
from backend.database import get_db
from backend.utils.search import perform_web_search

logger = logging.getLogger(__name__)
router = APIRouter()

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://localhost:1234")

def should_use_web_search(query: str) -> bool:
    """
    Determines if web search should be triggered based on the user's query.
    This function is designed to be conservative and only trigger a search
    when it's highly likely that the user is asking for information that
    the LLM doesn't have.
    """
    lower_query = query.lower().strip()

    # Exclude common conversational queries
    conversational_starters = [
        "what is your name", "who are you", "hello", "how are you",
        "thank you", "thanks", "ok", "okay", "sure", "alright",
        "please", "can you", "could you", "will you",
        "give me", "tell me", "show me", "explain"
    ]
    if any(lower_query.startswith(starter) for starter in conversational_starters):
        return False

    # Keywords that strongly suggest a need for real-time information
    search_keywords = [
        "latest news", "current events", "stock price",
        "weather forecast", "live score", "election results",
        "who won", "what's the score", "is it raining",
        "latest update", "recent news", "top headlines"
    ]
    if any(keyword in lower_query for keyword in search_keywords):
        return True

    # Check for questions about current or very recent events
    if (
        "?" in lower_query and
        (
            "today" in lower_query or
            "tomorrow" in lower_query or
            "yesterday" in lower_query or
            "this week" in lower_query or
            "this month" in lower_query or
            str(datetime.now().year) in lower_query
        )
    ):
        return True

    return False

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

    # Determine if web search should be performed
    perform_search = False
    user_query = ""
    if payload["messages"]:
        user_query = payload["messages"][-1]["content"]
        if input.web_search_enabled: # If the user has enabled the toggle, check if the query is a good candidate for a web search
            if should_use_web_search(user_query):
                perform_search = True
                logger.info(f"Web search enabled by user and query is a good candidate for a web search: '{user_query}'")
        else:  # If not manually enabled, check if we should enable it automatically
            if should_use_web_search(user_query):
                perform_search = True
                logger.info(f"Autonomously enabling web search for query: '{user_query}'")

    logger.info(f"Received web_search_enabled: {input.web_search_enabled}, final decision to search: {perform_search}")

    # Handle web search if enabled
    if perform_search and user_query:
        search_results = await perform_web_search(user_query)
        if search_results:
            search_context = "\n\nWeb Search Results:\n"
            for i, res in enumerate(search_results):
                search_context += f"{i+1}. Title: {res.get('title', 'N/A')}\n"
                search_context += f"   URL: {res.get('url', 'N/A')}\n"
                search_context += f"   Snippet: {res.get('snippet', 'N/A')}\n"
            search_context += "\nBased on the above web search results, answer the following question:\n"
            
            # Prepend search context to the last user message
            payload["messages"][-1]["content"] = search_context + user_query
            logger.info(f"Augmented prompt with web search results for OpenAI.")
        else:
            logger.warning("Web search was performed but no results were found or an error occurred.")
            # Add a notice to the user that the web search failed
            payload["messages"][-1]["content"] = "(Web search failed. Answering based on my existing knowledge.)\n\n" + user_query


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