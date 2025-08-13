from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from starlette.requests import ClientDisconnect
import httpx
import re
import logging
from datetime import datetime
from backend.models import StreamRequestPayload
from backend.database import get_db
from backend.utils.web_search.main import perform_web_search

logger = logging.getLogger(__name__)
router = APIRouter()

def should_use_web_search(query: str) -> bool:
    """
    Determines if web search should be triggered based on the user's query.
    """
    # Broader keywords that suggest a need for real-time information
    search_keywords = [
        "who is", "what is", "when is", "where is", "how to",
        "latest", "news", "update", "current", "today",
        "who won", "results", "score", "stock price", "what's the", "what is the"
    ]
    
    # Exclude common conversational queries
    conversational_starters = [
        "what is your name", "who are you", "hello", "how are you"
    ]
    
    lower_query = query.lower().strip()
    
    if any(starter in lower_query for starter in conversational_starters):
        return False

    if any(keyword in lower_query for keyword in search_keywords):
        return True
        
    # Check for recent years (e.g., current or last year)
    current_year = datetime.now().year
    if str(current_year) in query or str(current_year - 1) in query:
        return True
        
    return False

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

    # Determine if web search should be performed
    perform_search = input.web_search_enabled
    user_query = ""
    if payload["messages"]:
        user_query = payload["messages"][-1]["content"]
        if not perform_search:  # If not manually enabled, check if we should enable it automatically
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
                search_context += f"{i+1}. Title: {res.title if res.title else 'N/A'}\n"
                search_context += f"   URL: {res.url if res.url else 'N/A'}\n"
                search_context += f"   Snippet: {res.snippet if res.snippet else 'N/A'}\n"
            search_context += "\nBased on the above web search results, answer the following question:\n"
            
            # Prepend search context to the last user message
            payload["messages"][-1]["content"] = search_context + user_query
            logger.info(f"Augmented prompt with web search results for Ollama.")
        else:
            logger.warning("Web search was performed but no results were found or an error occurred.")
            # Add a notice to the user that the web search failed
            payload["messages"][-1]["content"] = "(Web search failed. Answering based on my existing knowledge.)\n\n" + user_query

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