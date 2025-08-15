from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from pydantic import SecretStr

class SearchResult(BaseModel):
    """
    A standardized model for representing search results from various providers.
    """
    title: str
    url: str
    snippet: str
    source: str  # Engine that produced the result

class SearchResponse(BaseModel):
    """
    A model for the response containing a list of search results.
    """
    results: List[SearchResult]

class SearchEngineConfig(BaseModel):
    """
    Configuration for search engine providers.
    """
    default_engine: Literal["duckduckgo", "sougou"] = "duckduckgo"
    sougou_api_key: Optional[SecretStr] = Field(
        None,
        description="API key for Sougou search from open.sogou.com"
    )
    max_results: int = Field(default=5, ge=1, le=20)
    domain_filter: Optional[str] = None