import logging
from duckduckgo_search import DDGS
from typing import List
from .base import SearchEngine
from .models import SearchResult

class DuckDuckGoEngine(SearchEngine):
    """DuckDuckGo search engine implementation."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    async def search(self, query: str, max_results: int = 5, timeout: int = 10) -> List[SearchResult]:
        try:
            with DDGS(timeout=timeout) as ddgs:
                # Disable fallback searches and use only DuckDuckGo
                results = ddgs.text(query, max_results=max_results, backend="api")
                return [
                    SearchResult(
                        title=result['title'],
                        url=result['href'],
                        snippet=result['body'],
                        source="duckduckgo"
                    )
                    for result in results
                ]
        except Exception as e:
            self.logger.error(f"DuckDuckGo search failed for query '{query}': {str(e)}")
            return []