import os
import httpx
import asyncio
import json
from urllib.parse import urlparse
import logging
import re
from datetime import datetime
from time import perf_counter
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from starlette.requests import ClientDisconnect
from backend.models import StreamRequestPayload, User
from backend.database import get_db
from backend.utils.web_search.main import perform_web_search, WebSearchError
from backend.utils.rag import embed_query, search_chunks
from backend.config import config
from backend.rate_limiter import limiter
from backend.auth import get_current_user
from backend.routers.tools import assert_tool_allowed, get_tool_config, record_tool_audit, user_can_use_tool

logger = logging.getLogger(__name__)
router = APIRouter()

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
@limiter.limit("30/minute")
async def chat_with_openai(
    input: StreamRequestPayload,
    request: Request,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_email = current_user.email
    payload = {
        "model": input.model,
        "messages": [],
        "stream": True,
    }

    if input.conversation_id:
        conversation = await db.conversations.find_one({
            "id": input.conversation_id,
            "user_email": current_user.email,
        })
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found or not owned by user",
            )

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
    web_search_allowed = False
    file_search_allowed = False
    if input.web_search_enabled:
        await assert_tool_allowed(db, "web_search", current_user)
        web_search_allowed = True
    if input.rag_enabled:
        await assert_tool_allowed(db, "file_search", current_user)
        file_search_allowed = True

    if payload["messages"]:
        user_query = payload["messages"][-1]["content"]
        query_wants_search = should_use_web_search(user_query)
        if input.web_search_enabled:
            if query_wants_search:
                perform_search = True
                logger.info(f"Web search explicitly enabled by user for query: '{user_query}'")
            else:
                logger.info(f"Web search toggle on but query is conversational; skipping search for: '{user_query}'")
        elif query_wants_search:
            web_search_tool = await get_tool_config(db, "web_search")
            if user_can_use_tool(web_search_tool, current_user):
                web_search_allowed = True
                perform_search = True
                logger.info(f"Autonomously enabling web search for query: '{user_query}'")
            else:
                logger.info("Autonomous web search skipped by tool policy")
    else:
        logger.warning("No messages found in payload, skipping web search and RAG processing")

    logger.info(f"Received web_search_enabled: {input.web_search_enabled}, final decision to search: {perform_search}")

    # Handle web search if enabled
    search_context = None
    search_failed = False
    if perform_search and user_query:
        # Let the web search orchestrator determine engines via env (WEB_SEARCH_ENGINES)
        search_started = perf_counter()
        try:
            search_results = await perform_web_search(user_query)
        except WebSearchError as e:
            search_results = []
            search_failed = True
            logger.error(f"Web search error: {e}")
        search_latency_ms = int((perf_counter() - search_started) * 1000)
        if search_results:
            await record_tool_audit(
                db,
                tool_id="web_search",
                current_user=current_user,
                conversation_id=input.conversation_id,
                status="success",
                latency_ms=search_latency_ms,
                details={"result_count": len(search_results)},
            )
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
            audit_status = "error" if search_failed else "no_results"
            await record_tool_audit(
                db,
                tool_id="web_search",
                current_user=current_user,
                conversation_id=input.conversation_id,
                status=audit_status,
                latency_ms=search_latency_ms,
                details={"result_count": 0, "reason": "search_failed" if search_failed else "empty_results"},
            )
            if search_failed:
                logger.warning("Web search failed due to an error. Answering based on existing knowledge.")
            else:
                logger.warning("Web search was performed but no results were found.")
            # Check if payload["messages"] is not empty before accessing it
            if payload["messages"]:
                payload["messages"][-1]["content"] = "(Web search failed. Answering based on my existing knowledge.)\n\n" + user_query
            else:
                logger.warning("No messages found in payload, cannot set web search failure message")

    # Handle RAG if enabled
    perform_rag = input.rag_enabled and file_search_allowed
    rag_context = ""
    rag_chunks = None
    if perform_rag and user_query:
        logger.info(f"RAG enabled for query: '{user_query}'")
        rag_started = perf_counter()
        query_embedding = await embed_query(user_query)
        if query_embedding:
            # Pass query_text for hybrid search support
            chunks = await search_chunks(
                user_email, query_embedding,
                top_k=5, threshold=0.7,
                conversation_id=input.conversation_id,
                knowledge_space_id=input.knowledge_space_id,
                query_text=user_query
            )
            if chunks:
                await record_tool_audit(
                    db,
                    tool_id="file_search",
                    current_user=current_user,
                    conversation_id=input.conversation_id,
                    status="success",
                    latency_ms=int((perf_counter() - rag_started) * 1000),
                    details={"result_count": len(chunks), "knowledge_space_id": input.knowledge_space_id},
                )
                doc_ids = list({chunk["document_id"] for chunk in chunks if chunk.get("document_id")})
                doc_metadata = {}
                if doc_ids:
                    docs = await db.documents.find({
                        "_id": {"$in": doc_ids},
                        "user_email": user_email,
                    }).to_list(len(doc_ids))
                    doc_metadata = {
                        doc["_id"]: {
                            "filename": doc.get("filename"),
                            "knowledge_space_id": doc.get("knowledge_space_id"),
                            "indexing_status": doc.get("indexing_status"),
                        } for doc in docs
                    }
                rag_chunks = chunks
                rag_context = "\n\nRelevant Document Chunks:\n"
                for i, chunk in enumerate(chunks):
                    metadata = doc_metadata.get(chunk["document_id"], {})
                    source_name = metadata.get("filename") or chunk["document_id"]
                    chunk["filename"] = metadata.get("filename")
                    chunk["knowledge_space_id"] = metadata.get("knowledge_space_id")
                    chunk["indexing_status"] = metadata.get("indexing_status")
                    rag_context += f"{i+1}. Source: {source_name}, Chunk {chunk['chunk_index']}\n"
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
                    if input.knowledge_space_id:
                        doc_filter["knowledge_space_id"] = input.knowledge_space_id
                    docs_cursor = db.documents.find(doc_filter).sort("created_at", -1)
                    latest_doc = await docs_cursor.to_list(1)
                    if latest_doc:
                        doc_id = latest_doc[0]["_id"]
                        raw_chunks = await db.document_chunks.find({"document_id": doc_id}).sort("chunk_index", 1).to_list(5)
                        if raw_chunks:
                            rag_chunks = [{
                                "document_id": c.get("document_id"),
                                "filename": latest_doc[0].get("filename"),
                                "knowledge_space_id": latest_doc[0].get("knowledge_space_id"),
                                "indexing_status": latest_doc[0].get("indexing_status"),
                                "chunk_index": c.get("chunk_index"),
                                "content": c.get("content", ""),
                                "similarity": 1.0,
                            } for c in raw_chunks]
                            await record_tool_audit(
                                db,
                                tool_id="file_search",
                                current_user=current_user,
                                conversation_id=input.conversation_id,
                                status="fallback",
                                latency_ms=int((perf_counter() - rag_started) * 1000),
                                details={
                                    "result_count": len(raw_chunks),
                                    "knowledge_space_id": input.knowledge_space_id,
                                    "document_id": doc_id,
                                },
                            )
                            rag_context = "\n\nDocument Content (raw chunks):\n"
                            for i, c in enumerate(rag_chunks):
                                rag_context += f"{i+1}. Source: {c.get('filename') or c['document_id']}, Chunk {c['chunk_index']}\n"
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
                    await record_tool_audit(
                        db,
                        tool_id="file_search",
                        current_user=current_user,
                        conversation_id=input.conversation_id,
                        status="no_results",
                        latency_ms=int((perf_counter() - rag_started) * 1000),
                        details={"result_count": 0, "knowledge_space_id": input.knowledge_space_id},
                    )
                    if payload["messages"]:
                        payload["messages"][-1]["content"] = "(No relevant documents found. Answering based on conversation history.)\n\n" + payload["messages"][-1]["content"]
                    else:
                        logger.warning("No messages found in payload, cannot set RAG no-results message")
        else:
            await record_tool_audit(
                db,
                tool_id="file_search",
                current_user=current_user,
                conversation_id=input.conversation_id,
                status="error",
                latency_ms=int((perf_counter() - rag_started) * 1000),
                details={"reason": "embedding_failed", "knowledge_space_id": input.knowledge_space_id},
            )
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
            if search_failed:
                yield f"data: <websearch>error</websearch>\n\n"
            elif search_context:
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
                            "title": chunk.get('filename') or f"Document {chunk.get('document_id')}",
                            "filename": chunk.get('filename'),
                            "knowledge_space_id": chunk.get('knowledge_space_id'),
                            "indexing_status": chunk.get('indexing_status'),
                            "similarity": chunk.get('similarity'),
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
                    logger.info("Client disconnected. Stopping OpenAI stream.")
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
            logger.error(f"LLM stream failed: {last_error}")
            yield "data: An error occurred while generating the response. Please try again later.\n\n"
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
@limiter.limit("30/minute")
async def get_models(request: Request, current_user: User = Depends(get_current_user)):
    return await fetch_models_from_llm()


async def fetch_models_from_llm():
    try:
        base_url = config.llm_base_url
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{base_url}/v1/models")
            response.raise_for_status()
            models_data = response.json()
            return {"models": [model['id'] for model in models_data.get('data', [])]}
    except (httpx.RequestError, httpx.HTTPStatusError) as e:
        logger.error(f"Failed to fetch models from LLM service: {e}")
        return {"models": ["deepseek/deepseek-r1-0528-qwen3-8b"]}

@router.get("/config")
@limiter.limit("30/minute")
async def get_llm_config(request: Request, current_user: User = Depends(get_current_user)):
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


@router.get("/rag/config")
@limiter.limit("30/minute")
async def get_rag_config(request: Request, current_user: User = Depends(get_current_user)):
    """Expose RAG configuration for frontend visibility."""
    from backend.utils.rag import _get_embedding_model_info
    try:
        model_info = _get_embedding_model_info()
    except Exception:
        model_info = {"name": config.embedding_model_name, "embedding_dim": None}

    return {
        "embedding_model": model_info,
        "vector_search_enabled": config.vector_search_enabled,
        "hybrid_search_enabled": config.hybrid_search_enabled,
        "similarity_threshold": config.rag_similarity_threshold,
        "top_k": config.rag_top_k,
        "mmr_lambda": config.rag_mmr_lambda,
    }
