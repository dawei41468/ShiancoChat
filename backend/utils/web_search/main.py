import os
from typing import List
from .models import SearchResult
from .duckduckgo import DuckDuckGoEngine
from .brave import BraveEngine

async def perform_web_search(query: str, max_results: int = 5) -> List[SearchResult]:
    """
    Perform a web search using the configured search engine.
    
    Args:
        query (str): The search query.
        max_results (int): Maximum number of results to return. Defaults to 5.
    
    Returns:
        List[SearchResult]: A list of search results in standardized format.
    """
    engine = os.getenv("WEB_SEARCH_ENGINE", "duckduckgo").lower()
    
    if engine == "brave":
        return await BraveEngine().search(query, max_results)
    elif engine == "duckduckgo":
        return await DuckDuckGoEngine().search(query, max_results)
    else:
        print(f"Unsupported search engine: {engine}. Falling back to DuckDuckGo.")
        return await DuckDuckGoEngine().search(query, max_results)