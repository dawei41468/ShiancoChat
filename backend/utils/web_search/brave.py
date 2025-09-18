import os
import logging
from typing import List
import httpx

from .base import SearchEngine
from .models import SearchResult


class BraveEngine(SearchEngine):
    """Brave Search engine implementation using Brave Search API.

    Requires environment variable BRAVE_API_KEY.
    Docs: https://api.search.brave.com/app/documentation
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    async def search(self, query: str, max_results: int = 5, timeout: int = 10) -> List[SearchResult]:
        try:
            api_key = os.getenv("BRAVE_API_KEY")
            if not api_key:
                self.logger.error("Brave API key not configured (set BRAVE_API_KEY)")
                return []

            # Pass proxy settings if available
            proxies = None
            http_proxy = os.getenv("HTTP_PROXY")
            https_proxy = os.getenv("HTTPS_PROXY")
            if http_proxy or https_proxy:
                proxies = {}
                if http_proxy:
                    proxies["http://"] = http_proxy
                if https_proxy:
                    proxies["https://"] = https_proxy

            headers = {
                "Accept": "application/json",
                "X-Subscription-Token": api_key,
            }
            params = {
                "q": query,
                "count": min(max_results, 20),
            }

            async with httpx.AsyncClient(timeout=timeout, proxies=proxies) as client:
                resp = await client.get(
                    "https://api.search.brave.com/res/v1/web/search",
                    headers=headers,
                    params=params,
                )
                resp.raise_for_status()
                data = resp.json()

                results: List[SearchResult] = []
                web = data.get("web") or {}
                items = web.get("results") or []
                for item in items[:max_results]:
                    title = item.get("title")
                    url = item.get("url")
                    snippet = item.get("description") or item.get("snippet")
                    if title and url and snippet:
                        results.append(
                            SearchResult(
                                title=title,
                                url=url,
                                snippet=str(snippet),
                                source="brave",
                            )
                        )
                return results
        except httpx.HTTPError as e:
            self.logger.error(f"Brave search HTTP error: {e}")
            return []
        except Exception as e:
            self.logger.error(f"Brave search failed: {e}")
            return []
