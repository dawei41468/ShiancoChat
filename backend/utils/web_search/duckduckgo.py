from ddgs import DDGS
from typing import List
from .base import SearchEngine
from .models import SearchResult

class DuckDuckGoEngine(SearchEngine):
    """DuckDuckGo search engine implementation."""
    
    async def search(self, query: str, max_results: int = 5) -> List[SearchResult]:
        try:
            with DDGS() as ddgs:
                results = ddgs.text(query, max_results=max_results)
                return [
                    SearchResult(
                        title=result['title'],
                        url=result['href'],
                        snippet=result['body']
                    )
                    for result in results
                ]
        except Exception as e:
            print(f"Error performing DuckDuckGo search: {e}")
            return []