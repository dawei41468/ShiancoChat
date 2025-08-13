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