import os
import httpx
import asyncio
import json
from urllib.parse import urlparse
import logging
import re
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from starlette.requests import ClientDisconnect
from backend.models import StreamRequestPayload
from backend.database import get_db
from backend.utils.web_search.main import perform_web_search
from backend.utils.rag import embed_query, search_chunks
from jose import jwt, JWTError
from backend.auth import SECRET_KEY, ALGORITHM

logger = logging.getLogger(__name__)
router = APIRouter()

from backend.config import config

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
        "latest update", "recent news", "top headlines",
        "current president", "current prime minister", "current leader"
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

    # Add the current user message to the payload
    # This should be done after loading conversation history
    payload["messages"].append({"role": "user", "content": input.text})

    # Determine if web search should be performed
    perform_search = False
    user_query = ""
    if payload["messages"]:
        user_query = payload["messages"][-1]["content"]
        if input.web_search_enabled: # If the user has enabled the toggle, always perform a web search
            perform_search = True
            logger.info(f"Web search explicitly enabled by user for query: '{user_query}'")
        else:  # If not manually enabled, check if we should enable it automatically
            if should_use_web_search(user_query):
                perform_search = True
                logger.info(f"Autonomously enabling web search for query: '{user_query}'")
    else:
        logger.warning("No messages found in payload, skipping web search and RAG processing")

    logger.info(f"Received web_search_enabled: {input.web_search_enabled}, final decision to search: {perform_search}")

    # Handle web search if enabled
    search_context = None
    if perform_search and user_query:
        # Let the web search orchestrator determine engines via env (WEB_SEARCH_ENGINES)
        search_results = await perform_web_search(user_query)
        if search_results:
            search_context = "\n\nWeb Search Results:\n"
            for i, res in enumerate(search_results):
                search_context += f"{i+1}. Title: {res.title if res.title else 'N/A'}\n"
                search_context += f"   URL: {res.url if res.url else 'N/A'}\n"
                search_context += f"   Snippet: {res.snippet if res.snippet else 'N/A'}\n"
            search_context += "\nBased on the above web search results, answer the following question:\n"
            # Check if payload["messages"] is not empty before accessing it
            if payload["messages"]:
                payload["messages"][-1]["content"] = search_context + user_query
            else:
                logger.warning("No messages found in payload, cannot augment with web search results")
            logger.info(f"Augmented prompt with web search results for OpenAI.")
        else:
            logger.warning("Web search was performed but no results were found or an error occurred.")
            # Check if payload["messages"] is not empty before accessing it
            if payload["messages"]:
                payload["messages"][-1]["content"] = "(Web search failed. Answering based on my existing knowledge.)\n\n" + user_query
            else:
                logger.warning("No messages found in payload, cannot set web search failure message")

    # Handle RAG if enabled
    perform_rag = input.rag_enabled
    rag_context = ""
    rag_chunks = None
    if perform_rag and user_query:
        logger.info(f"RAG enabled for query: '{user_query}'")
        query_embedding = await embed_query(user_query)
        if query_embedding:
            # Try to decode user email from token if provided for per-user filtering
            user_email = None
            if input.token:
                try:
                    decoded_payload = jwt.decode(input.token, SECRET_KEY, algorithms=[ALGORITHM])
                    user_email = decoded_payload.get("sub")
                except JWTError:
                    logger.warning("Failed to decode JWT from streaming payload; proceeding without user filter")

            chunks = await search_chunks(user_email, query_embedding, top_k=5, threshold=0.7, conversation_id=input.conversation_id)
            if chunks:
                rag_chunks = chunks
                rag_context = "\n\nRelevant Document Chunks:\n"
                for i, chunk in enumerate(chunks):
                    rag_context += f"{i+1}. Document ID: {chunk['document_id']}, Chunk {chunk['chunk_index']}\n"
                    rag_context += f"   Content: {chunk['content'][:200]}...\n"
                    rag_context += f"   Similarity: {chunk['similarity']:.2f}\n"
                rag_context += "\nUse the above document chunks to inform your response if relevant:\n"
                if payload["messages"]:
                    payload["messages"][-1]["content"] = rag_context + payload["messages"][-1]["content"]
                else:
                    logger.warning("No messages found in payload, cannot augment with RAG context")
                logger.info(f"Augmented prompt with RAG document chunks for OpenAI.")
            else:
                # Fallback: if embeddings not ready yet, try to use recent document chunks by conversation
                try:
                    doc_filter = {}
                    if user_email:
                        doc_filter["user_email"] = user_email
                    if input.conversation_id:
                        doc_filter["conversation_id"] = input.conversation_id
                    docs_cursor = db.documents.find(doc_filter).sort("created_at", -1)
                    latest_doc = await docs_cursor.to_list(1)
                    if latest_doc:
                        doc_id = latest_doc[0]["_id"]
                        # Take first few chunks in order as context
                        raw_chunks = await db.document_chunks.find({"document_id": doc_id}).sort("chunk_index", 1).to_list(5)
                        if raw_chunks:
                            rag_chunks = [{
                                "document_id": c.get("document_id"),
                                "chunk_index": c.get("chunk_index"),
                                "content": c.get("content", ""),
                                "similarity": 1.0,
                            } for c in raw_chunks]
                            rag_context = "\n\nDocument Content (raw chunks):\n"
                            for i, c in enumerate(rag_chunks):
                                rag_context += f"{i+1}. Document ID: {c['document_id']}, Chunk {c['chunk_index']}\n"
                                rag_context += f"   Content: {c['content'][:200]}...\n"
                            rag_context += "\nUse the above document content to summarize as requested.\n"
                            if payload["messages"]:
                                payload["messages"][-1]["content"] = rag_context + payload["messages"][-1]["content"]
                            else:
                                logger.warning("No messages found in payload, cannot augment with fallback RAG context")
                            logger.info("RAG fallback used: raw document chunks included due to missing embeddings.")
                        else:
                            logger.info("RAG fallback: latest document has no chunks.")
                    else:
                        logger.info("RAG fallback: no documents found for conversation/user filter.")
                except Exception as e:
                    logger.warning(f"RAG fallback retrieval error: {e}")
                # If still no rag_context after fallback, annotate the message minimally
                if not rag_context:
                    if payload["messages"]:
                        payload["messages"][-1]["content"] = "(No relevant documents found. Answering based on conversation history.)\n\n" + payload["messages"][-1]["content"]
                    else:
                        logger.warning("No messages found in payload, cannot set RAG no-results message")
        else:
            logger.warning("Failed to embed query for RAG.")
            # Check if payload["messages"] is not empty before accessing it
            if payload["messages"]:
                payload["messages"][-1]["content"] = "(RAG embedding failed. Answering based on conversation history.)\n\n" + payload["messages"][-1]["content"]
            else:
                logger.warning("No messages found in payload, cannot set RAG failure message")


    async def generate_stream():
        """
        Generates the SSE stream including web search state and LLM response.
        """
        # Signal web search start if needed
        if perform_search:
            yield f"data: <websearch>true</websearch>\n\n"
            if search_context:
                yield f"data: <websearch>results</websearch>\n\n"
                # Emit citations for web search
                try:
                    if 'search_results' in locals() and search_results:
                        web_items = [{
                            "type": "web",
                            "title": getattr(res, 'title', None),
                            "url": getattr(res, 'url', None),
                            "snippet": getattr(res, 'snippet', None),
                            "source": getattr(res, 'source', None)
                        } for res in search_results if res]
                        yield f"data: <citations>{json.dumps({'items': web_items})}</citations>\n\n"
                except Exception as e:
                    logger.warning(f"Failed to emit web citations: {e}")
            else:
                yield f"data: <websearch>no_results</websearch>\n\n"
            yield f"data: <websearch>false</websearch>\n\n"

        # Signal RAG start if needed
        if perform_rag:
            yield f"data: <rag>true</rag>\n\n"
            if rag_context:
                yield f"data: <rag>results</rag>\n\n"
                # Emit citations for RAG
                try:
                    if rag_chunks:
                        rag_items = [{
                            "type": "rag",
                            "document_id": str(chunk.get('document_id')),
                            "chunk_index": chunk.get('chunk_index'),
                            "snippet": (chunk.get('content') or '')[:200]
                        } for chunk in rag_chunks]
                        yield f"data: <citations>{json.dumps({'items': rag_items})}</citations>\n\n"
                except Exception as e:
                    logger.warning(f"Failed to emit RAG citations: {e}")
            else:
                yield f"data: <rag>no_results</rag>\n\n"
            yield f"data: <rag>false</rag>\n\n"

        # Stream LLM response with failover and retries
        endpoints = []
        if config.llm_base_urls:
            # Support comma-separated env string or list
            if isinstance(config.llm_base_urls, list):
                endpoints = [u.strip() for u in config.llm_base_urls if u]
            else:
                endpoints = [u.strip() for u in str(config.llm_base_urls).split(',') if u.strip()]
        if not endpoints and config.llm_base_url:
            endpoints = [config.llm_base_url]

        timeout_seconds = max(5, int(config.llm_request_timeout_seconds or 60))
        max_retries = max(0, int(config.llm_max_retries or 0))
        backoff_base = float(config.llm_retry_backoff_seconds or 0.75)

        # Prepare global proxy mapping (applied only to non-local endpoints)
        global_proxies = None
        if config.http_proxy or config.https_proxy:
            global_proxies = {}
            if config.http_proxy:
                global_proxies["http://"] = config.http_proxy
            if config.https_proxy:
                global_proxies["https://"] = config.https_proxy

        success = False
        last_error = None
        for base_url in endpoints:
            # Simple retries per endpoint
            for attempt in range(max_retries + 1):
                try:
                    # Bypass proxy for localhost endpoints to avoid routing local LM Studio via proxy
                    host = urlparse(base_url).hostname or ""
                    use_proxies = None if host in ("127.0.0.1", "localhost") else global_proxies
                    async with httpx.AsyncClient(timeout=timeout_seconds, proxies=use_proxies) as client:
                        url = f"{base_url.rstrip('/')}/v1/chat/completions"
                        async with client.stream("POST", url, json=payload, headers={"Content-Type": "application/json"}) as response:
                            if response.status_code >= 400:
                                error_msg = f"LLM service error ({base_url}): {response.status_code}"
                                logger.error(error_msg)
                                last_error = error_msg
                                break  # Move to next endpoint or retry
                            # Successful, stream bytes through
                            async for chunk in response.aiter_bytes():
                                yield chunk
                            success = True
                            break
                except ClientDisconnect:
                    print("Client disconnected. Stopping OpenAI stream.")
                    return
                except (httpx.RequestError, httpx.HTTPError) as e:
                    last_error = str(e)
                    logger.error(f"LLM request error on {base_url} (attempt {attempt+1}/{max_retries+1}): {e}")
                    # Backoff if we have remaining retries on this endpoint
                    if attempt < max_retries:
                        await asyncio.sleep(backoff_base * (2 ** attempt))
                    else:
                        # Exhausted retries for this endpoint; try next endpoint
                        break
            if success:
                break

        if not success:
            msg = last_error or "No LLM endpoint reachable. Ensure LM Studio is running at your configured LLM_BASE_URL."
            yield f"data: {msg}\n\n"
            return

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(generate_stream(), media_type="text/event-stream", headers=headers)

async def generate_title(messages: list, model: str):
    """Generates a title from a short conversation history."""
    # Use the provided model for title generation
    payload = {
        "model": model,
        "messages": messages + [{"role": "user", "content": "Summarize the above conversation in 5 words or less."}],
        "stream": False,
    }
    try:
        base_url = config.llm_base_url
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(f"{base_url}/v1/chat/completions", json=payload, headers={"Content-Type": "application/json"})
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
        base_url = config.llm_base_url
        response = httpx.get(f"{base_url}/v1/models", timeout=10)
        response.raise_for_status()
        models_data = response.json()
        return {"models": [model['id'] for model in models_data.get('data', [])]}
    except (httpx.RequestError, httpx.HTTPStatusError) as e:
        logger.error(f"Failed to fetch models from LLM service: {e}")
        return {"models": ["deepseek/deepseek-r1-0528-qwen3-8b"]}

@router.get("/config")
async def get_llm_config():
    """Expose LLM endpoint configuration (sanitized) for frontend visibility."""
    endpoints = []
    if config.llm_base_urls:
        if isinstance(config.llm_base_urls, list):
            endpoints = [u for u in config.llm_base_urls if u]
        else:
            endpoints = [u.strip() for u in str(config.llm_base_urls).split(',') if u.strip()]
    elif config.llm_base_url:
        endpoints = [config.llm_base_url]
    return {"endpoints": endpoints}