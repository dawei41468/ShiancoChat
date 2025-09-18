import logging
import os
from duckduckgo_search import DDGS
from typing import List
from .base import SearchEngine
from .models import SearchResult
from itertools import islice

class DuckDuckGoEngine(SearchEngine):
    """DuckDuckGo search engine implementation."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
    async def search(self, query: str, max_results: int = 5, timeout: int = 10) -> List[SearchResult]:
        try:
            # Explicitly pass proxies from environment to improve reliability behind corporate/GFW proxies
            proxies = None
            http_proxy = os.getenv("HTTP_PROXY")
            https_proxy = os.getenv("HTTPS_PROXY")
            if http_proxy or https_proxy:
                proxies = {}
                if http_proxy:
                    proxies["http://"] = http_proxy
                if https_proxy:
                    proxies["https://"] = https_proxy

            # Try multiple DDG backends to mitigate persistent 202 responses on the API backend
            backends_to_try = ["api", "html", "lite"]

            with DDGS(timeout=timeout, proxies=proxies) as ddgs:
                for backend in backends_to_try:
                    try:
                        # ddgs.text returns a generator in 3.9.x; slice it to max_results
                        try:
                            results_iter = ddgs.text(query, backend=backend, max_results=max_results)
                        except TypeError:
                            # Fallback if older signature without max_results
                            results_iter = islice(ddgs.text(query, backend=backend), max_results)

                        parsed = []
                        for result in islice(results_iter, max_results):
                            title = result.get('title')
                            url = result.get('href')
                            snippet = result.get('body')
                            if title and url and snippet:
                                parsed.append(SearchResult(title=title, url=url, snippet=snippet, source="duckduckgo"))

                        if parsed:
                            self.logger.info(f"DuckDuckGo backend '{backend}' returned {len(parsed)} results")
                            return parsed
                        else:
                            self.logger.warning(f"DuckDuckGo backend '{backend}' returned 0 results; trying next backend")
                    except Exception as e:
                        self.logger.warning(f"DuckDuckGo backend '{backend}' failed: {e}")
                        continue

            # All backends failed or returned no results
            return []
        except Exception as e:
            self.logger.error(f"DuckDuckGo search failed for query '{query}': {str(e)}")
            return []