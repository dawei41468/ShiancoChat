import os
from langchain_text_splitters import RecursiveCharacterTextSplitter  # Correct submodule
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from pydantic import SecretStr
from typing import List, Optional
from .models import SearchResult
from .duckduckgo import DuckDuckGoEngine
from .sougou import SougouEngine
import logging
import asyncio
from typing import List, Optional, Union

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
        engine_map = {
            "duckduckgo": DuckDuckGoEngine()
        }
        
        selected_engines = ["duckduckgo"]  # Only use DuckDuckGo
        tasks = [
            engine_map[engine].search(query, max_results + 2, timeout=10)
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
                logger.warning(f"Search engine {engine_name} failed: {str(engine_results)}")
                continue
            if hasattr(engine_results, '__iter__') and not isinstance(engine_results, str):
                # Validate results before adding
                valid_results = [
                    r for r in engine_results
                    if isinstance(r, SearchResult) and r.title and r.url and r.snippet
                ]
                logger.info(f"Engine {selected_engines[i]} returned {len(valid_results)} valid results")
                raw_results.extend(valid_results)
        
        # If no results from primary engine, try fallback
        if not raw_results and "duckduckgo" not in selected_engines:
            logger.info("No results from configured engines, falling back to DuckDuckGo")
            try:
                ddg_results = await DuckDuckGoEngine().search(query, max_results + 2)
                raw_results.extend(ddg_results)
            except Exception as e:
                logger.error(f"DuckDuckGo fallback failed: {e}")
        
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