import os
import pytest
import logging
from unittest.mock import patch
from backend.utils.web_search.main import perform_web_search

@pytest.mark.asyncio
async def test_web_search_duckduckgo(caplog):
    """
    Test web search functionality with DuckDuckGo as the provider.
    Includes debug output of raw results and augmented prompt.
    """
    os.environ["WEB_SEARCH_ENGINE"] = "duckduckgo"
    
    with patch('backend.utils.web_search.duckduckgo.DuckDuckGoEngine.search') as mock_search:
        caplog.set_level(logging.INFO)
        from backend.utils.web_search.models import SearchResult
        mock_search.return_value = [
            SearchResult(title="Test Title 1", url="http://test1.com", snippet="Test Snippet 1", source="test"),
            SearchResult(title="Test Title 2", url="http://test2.com", snippet="Test Snippet 2", source="test")
        ]
        results = await perform_web_search("test query", max_results=2)
        
        # Debug output
        print("\nRaw search results:")
        for i, res in enumerate(mock_search.return_value):
            print(f"{i+1}. {res.title} - {res.url}")
            print(f"   {res.snippet}")
        
        print("\nCurated results:")
        for i, res in enumerate(results):
            print(f"{i+1}. {res.title} - {res.url}")
            print(f"   {res.snippet}")
        
        # Show augmented prompt format
        print("\nAugmented prompt format:")
        prompt = f"Web search results for 'test query':\n"
        prompt += "\n".join([
            f"- {res.title} ({res.url}): {res.snippet}"
            for res in results
        ])
        print(prompt)
        
        assert len(results) == 2
        assert results[0].title == "Test Title 1"
        assert results[0].url == "http://test1.com"
        assert results[0].snippet == "Test Snippet 1"

@pytest.mark.asyncio
@pytest.mark.asyncio
async def test_web_search_unsupported_engine():
    """
    Test web search functionality with an unsupported engine, should fallback to DuckDuckGo.
    """
    os.environ["WEB_SEARCH_ENGINE"] = "unsupported"
    
    with patch('backend.utils.web_search.duckduckgo.search') as mock_search:
        from backend.utils.web_search.models import SearchResult
        mock_search.return_value = [
            SearchResult(title="Fallback Test 1", url="http://fallback1.com", snippet="Fallback Snippet 1", source="test")
        ]
        results = await perform_web_search("fallback query", max_results=1)
        assert len(results) == 1
        assert results[0].title == "Fallback Test 1"
        assert results[0].url == "http://fallback1.com"
        assert results[0].snippet == "Fallback Snippet 1"

@pytest.mark.asyncio
async def test_real_web_search():
    """Test real web search with DuckDuckGo"""
    os.environ["WEB_SEARCH_ENGINE"] = "duckduckgo"
    
    query = "current president of the united states"
    results = await perform_web_search(query, max_results=3)
    
    print(f"\nReal search results for '{query}':")
    for i, res in enumerate(results):
        print(f"{i+1}. {res.title} - {res.url}")
        print(f"   {res.snippet}")
    
    # Show augmented prompt format
    print("\nAugmented prompt format:")
    prompt = f"Web search results for '{query}':\n"
    prompt += "\n".join([
        f"- {res.title} ({res.url}): {res.snippet}"
        for res in results
    ])
    print(prompt)

if __name__ == "__main__":
    pytest.main(["-v", __file__])