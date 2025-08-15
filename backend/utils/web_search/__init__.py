from .duckduckgo import DuckDuckGoEngine
from .base import SearchEngine

from .base import get_search_engine

def get_engine() -> SearchEngine:
    """
    Get a search engine instance based on configuration.
    
    Returns:
        SearchEngine instance
    """
    return get_search_engine()