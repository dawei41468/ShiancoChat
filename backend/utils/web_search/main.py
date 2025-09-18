import os
from pathlib import Path
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from pydantic import SecretStr
from .models import SearchResult
from .duckduckgo import DuckDuckGoEngine
import logging
import asyncio
from typing import List, Optional
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

async def perform_web_search(
    query: str,
    max_results: int = 5,
    engines: Optional[List[str]] = None,
    domain_filter: Optional[str] = None
) -> List[SearchResult]:
    """
    Perform concurrent web searches using multiple engines.
    
    Args:
        query (str): The search query.
        max_results (int): Maximum number of results to return.
        engines (List[str]): List of engines to use (default: all).
        domain_filter (str): Optional domain to filter results by.
    
    Returns:
        List[SearchResult]: Combined results from all engines, sorted by relevance.
    """
    try:
        # Ensure latest env vars (e.g., WEB_SEARCH_ENGINES, BRAVE_API_KEY) are loaded without requiring server restart
        # This file lives at backend/utils/web_search/main.py; we need backend/.env (go up 2 levels: utils/web_search -> utils -> backend)
        env_path = Path(__file__).resolve().parents[2] / '.env'
        load_dotenv(env_path, override=True)
        # Build engine map lazily to avoid import errors for optional providers
        engine_map = {
            "duckduckgo": DuckDuckGoEngine()
        }
        # Optionally include Sougou if requested and dependency is available
        requested_engines_env = os.getenv("WEB_SEARCH_ENGINES", "").strip()
        requested_engines = []
        if requested_engines_env:
            requested_engines = [e.strip().lower() for e in requested_engines_env.split(',') if e.strip()]
        # If caller passed engines, respect that; else use env list; else default to ddg
        if engines and len(engines) > 0:
            selected_engines = [e.strip().lower() for e in engines if e]
        elif requested_engines:
            selected_engines = requested_engines
        else:
            selected_engines = ["duckduckgo"]
        # Attempt to register Sougou engine if selected
        if "sougou" in selected_engines and "sougou" not in engine_map:
            try:
                from .sougou import SougouEngine  # type: ignore
                engine_map["sougou"] = SougouEngine()
            except Exception as e:
                logger.warning(f"Sougou engine requested but unavailable: {e}")
                # Remove from selection to avoid task errors
                selected_engines = [e for e in selected_engines if e != "sougou"]
        # Attempt to register Brave engine if selected
        if "brave" in selected_engines and "brave" not in engine_map:
            try:
                from .brave import BraveEngine  # type: ignore
                engine_map["brave"] = BraveEngine()
            except Exception as e:
                logger.warning(f"Brave engine requested but unavailable: {e}")
                selected_engines = [e for e in selected_engines if e != "brave"]
        
        # China-friendly gating: only run external search when proxy is configured
        use_proxy = os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY")
        if not use_proxy:
            logger.info("No HTTP(S)_PROXY detected; skipping external web search. Configure a proxy to enable web search.")
            return []

        # Filter out unknown engines and log the final list
        selected_engines = [e for e in selected_engines if e in engine_map]
        if not selected_engines:
            selected_engines = ["duckduckgo"]
        logger.info(f"Web search engines selected: {selected_engines}")

        async def _run_with_retry(engine_name: str, tries: int = 2) -> List[SearchResult]:
            delay = 0.5
            for attempt in range(tries):
                try:
                    return await engine_map[engine_name].search(query, max_results + 2, timeout=10)
                except Exception as e:
                    logger.error(f"Engine {engine_name} attempt {attempt+1}/{tries} failed: {e}")
                    if attempt < tries - 1:
                        await asyncio.sleep(delay)
                        delay *= 2
            return []

        tasks = [
            _run_with_retry(engine)
            for engine in selected_engines
            if engine in engine_map
        ]
        
        # Run all searches concurrently and handle exceptions
        logger.info(f"Starting web search for: '{query}'")
        results_lists = await asyncio.gather(*tasks, return_exceptions=True)
        raw_results: List[SearchResult] = []
        for i, engine_results in enumerate(results_lists):
            if isinstance(engine_results, BaseException):
                engine_name = selected_engines[i]
                logger.error(f"Web search failed: {str(engine_results)}")
                continue
            if hasattr(engine_results, '__iter__') and not isinstance(engine_results, str):
                # Validate results before adding
                valid_results = [
                    r for r in engine_results
                    if isinstance(r, SearchResult) and r.title and r.url and r.snippet
                ]
                logger.info(f"Engine {selected_engines[i]} returned {len(valid_results)} valid results")
                raw_results.extend(valid_results)
        
        # If no results from selected engines, try a best-effort fallback
        if not raw_results:
            # Prefer trying an engine that wasn't selected but is readily available
            try:
                # If Brave key is present, try Brave once
                if os.getenv("BRAVE_API_KEY"):
                    try:
                        from .brave import BraveEngine  # type: ignore
                        logger.info("No results; attempting Brave fallback")
                        brave_results = await BraveEngine().search(query, max_results + 2)
                        raw_results.extend(brave_results)
                    except Exception as e:
                        logger.warning(f"Brave fallback failed: {e}")
                # If still empty and ddg wasn't selected, try ddg once
                if not raw_results and "duckduckgo" not in selected_engines:
                    logger.info("No results; attempting DuckDuckGo fallback")
                    try:
                        ddg_results = await DuckDuckGoEngine().search(query, max_results + 2)
                        raw_results.extend(ddg_results)
                    except Exception as e:
                        logger.error(f"DuckDuckGo fallback failed: {e}")
            except Exception:
                pass
        
        # Apply domain filter if specified
        if domain_filter:
            results = [
                r for r in raw_results
                if domain_filter.lower() in r.url.lower()
            ]
        else:
            results = raw_results
        
        # Deduplicate results by URL
        seen_urls = set()
        deduped_results = []
        for result in results:
            if result.url not in seen_urls:
                seen_urls.add(result.url)
                deduped_results.append(result)
        
        # Sort by relevance (prioritize longer titles and snippets)
        sorted_results = sorted(
            deduped_results,
            key=lambda x: (len(x.title), len(x.snippet)),
            reverse=True
        )
        
        return sorted_results[:max_results]
    except Exception as e:
        logger.error(f"Web search failed: {str(e)}")
        return []

# Add RAG indexing function
def index_knowledge(docs: List[str]):  # Assuming docs is a list of strings or Documents
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_text('\n\n'.join(docs))  # Use split_text for list of strings
    openai_api_key = os.getenv('OPENAI_API_KEY', '')
    embeddings = OpenAIEmbeddings(api_key=SecretStr(openai_api_key) if openai_api_key else None)
    vectorstore = FAISS.from_texts(chunks, embeddings)  # Use from_texts for text chunks
    vectorstore.save_local('knowledge_index')  # Save the vector store