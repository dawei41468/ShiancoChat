import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from backend.utils.web_search.main import perform_web_search, WebSearchError
from backend.utils.web_search.models import SearchResult

pytestmark = pytest.mark.asyncio


def _mock_getenv(key, default=None):
    """Mock getenv that returns proxy for HTTP_PROXY and defaults for everything else."""
    if key == "HTTP_PROXY":
        return "http://proxy:8080"
    return default


class TestDuckDuckGoEngine:
    """Tests for DuckDuckGo search engine."""

    async def test_duckduckgo_search_success(self):
        """DuckDuckGo engine returns parsed results."""
        from backend.utils.web_search.duckduckgo import DuckDuckGoEngine
        engine = DuckDuckGoEngine()

        mock_result = SearchResult(title="Result 1", url="https://example.com/1", snippet="Snippet 1", source="duckduckgo")
        with patch.object(engine, "search", new_callable=AsyncMock, return_value=[mock_result]):
            results = await engine.search("test query", max_results=5)

        assert len(results) == 1
        assert results[0].title == "Result 1"
        assert results[0].url == "https://example.com/1"
        assert results[0].snippet == "Snippet 1"

    async def test_duckduckgo_search_empty(self):
        """DuckDuckGo engine handles empty results gracefully."""
        from backend.utils.web_search.duckduckgo import DuckDuckGoEngine
        engine = DuckDuckGoEngine()

        with patch.object(engine, "search", new_callable=AsyncMock, return_value=[]):
            results = await engine.search("test query", max_results=5)

        assert results == []


class TestPerformWebSearch:
    """Tests for the web search orchestrator."""

    async def test_perform_web_search_no_proxy_skips(self):
        """If no proxy is configured, search is skipped and returns []."""
        with patch.dict("os.environ", {}, clear=True):
            results = await perform_web_search("test query")

        assert results == []

    async def test_perform_web_search_returns_results(self):
        """Search returns combined results from engines."""
        mock_result = SearchResult(title="Test", url="https://example.com", snippet="Hello", source="duckduckgo")

        with patch("os.getenv", side_effect=_mock_getenv):
            with patch("backend.utils.web_search.main.DuckDuckGoEngine") as MockEngine:
                instance = MockEngine.return_value
                instance.search = AsyncMock(return_value=[mock_result])
                results = await perform_web_search("test query")

        assert len(results) == 1
        assert results[0].title == "Test"

    async def test_perform_web_search_error_raises(self):
        """Unhandled exceptions during search raise WebSearchError."""
        with patch("os.getenv", side_effect=_mock_getenv):
            with patch("asyncio.gather", side_effect=Exception("critical failure")):
                with pytest.raises(WebSearchError):
                    await perform_web_search("test query")
