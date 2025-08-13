import os
import httpx
from typing import List
from .base import SearchEngine
from .models import SearchResult

class BraveEngine(SearchEngine):
    """Brave search engine implementation."""
    
    async def search(self, query: str, max_results: int = 5) -> List[SearchResult]:
        api_key = os.getenv("BRAVE_API_KEY")
        if not api_key:
            print("Brave API key not found in environment variables.")
            return []
        
        url = "https://api.search.brave.com/res/v1/web/search"
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": api_key
        }
        params = {
            "q": query,
            "count": max_results
        }
        
        try:
            response = httpx.get(url, headers=headers, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            results = data.get("web", {}).get("results", [])
            return [
                SearchResult(
                    title=result.get("title", ""),
                    url=result.get("url", ""),
                    snippet=result.get("description", "")
                )
                for result in results[:max_results]
            ]
        except httpx.HTTPStatusError as e:
            print(f"HTTP error during Brave search: {e.response.status_code} - {e.response.text}")
            return []
        except httpx.TimeoutException as e:
            print(f"Timeout error during Brave search: {e}")
            return []
        except httpx.RequestError as e:
            print(f"Request error during Brave search: {e}")
            return []
        except Exception as e:
            print(f"An unexpected error occurred during Brave search: {e}")
            return []