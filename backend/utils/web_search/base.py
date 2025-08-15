from abc import ABC, abstractmethod
from typing import List
from .models import SearchResult

class SearchEngine(ABC):
    """Abstract base class for search engine implementations."""
    
    @abstractmethod
    async def search(self, query: str, max_results: int = 5) -> List[SearchResult]:
        """
        Perform a web search.
        
        Args:
            query: The search query string
            max_results: Maximum number of results to return
            
        Returns:
            List of SearchResult objects
        """
        pass
    
def get_search_engine(engine_name: str = "") -> 'SearchEngine':
    """
    Factory function to get a search engine instance based on configuration or name.
    
    Args:
        engine_name: Optional name of the search engine to use. If None, uses the configured default.
    
    Returns:
        SearchEngine: An instance of a concrete search engine class.
    """
    from backend.config import config
    from .duckduckgo import DuckDuckGoEngine
    from .sougou import SougouEngine
    
    if not engine_name:
        engine_name = config.web_search["default_engine"]
    
    engine_name = engine_name.lower()
    if engine_name == 'duckduckgo':
        return DuckDuckGoEngine()
    elif engine_name == 'sougou' and config.web_search.get("sougou_api_key"):
        return SougouEngine()
    else:
        # Default to DuckDuckGo
        return DuckDuckGoEngine()