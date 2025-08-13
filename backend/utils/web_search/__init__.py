from .duckduckgo import DuckDuckGoEngine
from .brave import BraveEngine
from .base import SearchEngine

def get_engine(engine_name: str) -> SearchEngine:
    """
    Factory function to get the appropriate search engine instance.
    
    Args:
        engine_name: Name of the search engine ('duckduckgo' or 'brave')
        
    Returns:
        SearchEngine instance
        
    Raises:
        ValueError: If engine_name is not recognized
    """
    engines = {
        'duckduckgo': DuckDuckGoEngine,
        'brave': BraveEngine
    }
    
    engine_class = engines.get(engine_name.lower())
    if not engine_class:
        raise ValueError(f"Unknown search engine: {engine_name}")
        
    return engine_class()