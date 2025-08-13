from pydantic import BaseModel
from typing import List

class SearchResult(BaseModel):
    """
    A standardized model for representing search results from various providers.
    """
    title: str
    url: str
    snippet: str

class SearchResponse(BaseModel):
    """
    A model for the response containing a list of search results.
    """
    results: List[SearchResult]