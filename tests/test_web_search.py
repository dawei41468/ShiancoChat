import os
import pytest
import asyncio
from unittest.mock import patch
from backend.utils.search import perform_web_search

@pytest.mark.asyncio
async def test_web_search_duckduckgo():
    """
    Test web search functionality with DuckDuckGo as the provider.
    """
    os.environ["WEB_SEARCH_ENGINE"] = "duckduckgo"
    
    with patch('backend.utils.web_search.duckduckgo.search') as mock_search:
        mock_search.return_value = [
            {"title": "Test Title 1", "url": "http://test1.com", "snippet": "Test Snippet 1"},
            {"title": "Test Title 2", "url": "http://test2.com", "snippet": "Test Snippet 2"}
        ]
        results = await perform_web_search("test query", max_results=2)
        assert len(results) == 2
        assert results[0]["title"] == "Test Title 1"
        assert results[0]["url"] == "http://test1.com"
        assert results[0]["snippet"] == "Test Snippet 1"

@pytest.mark.asyncio
async def test_web_search_brave():
    """
    Test web search functionality with Brave as the provider.
    """
    os.environ["WEB_SEARCH_ENGINE"] = "brave"
    
    with patch('backend.utils.web_search.brave.search') as mock_search:
        mock_search.return_value = [
            {"title": "Brave Test 1", "url": "http://brave1.com", "snippet": "Brave Snippet 1"},
            {"title": "Brave Test 2", "url": "http://brave2.com", "snippet": "Brave Snippet 2"}
        ]
        results = await perform_web_search("brave query", max_results=2)
        assert len(results) == 2
        assert results[0]["title"] == "Brave Test 1"
        assert results[0]["url"] == "http://brave1.com"
        assert results[0]["snippet"] == "Brave Snippet 1"

@pytest.mark.asyncio
async def test_web_search_unsupported_engine():
    """
    Test web search functionality with an unsupported engine, should fallback to DuckDuckGo.
    """
    os.environ["WEB_SEARCH_ENGINE"] = "unsupported"
    
    with patch('backend.utils.web_search.duckduckgo.search') as mock_search:
        mock_search.return_value = [
            {"title": "Fallback Test 1", "url": "http://fallback1.com", "snippet": "Fallback Snippet 1"}
        ]
        results = await perform_web_search("fallback query", max_results=1)
        assert len(results) == 1
        assert results[0]["title"] == "Fallback Test 1"
        assert results[0]["url"] == "http://fallback1.com"
        assert results[0]["snippet"] == "Fallback Snippet 1"

if __name__ == "__main__":
    pytest.main(["-v", __file__])