import pytest
from unittest.mock import patch, MagicMock
from backend.routers.openai import should_use_web_search as should_use_web_search_openai
from backend.routers.ollama import should_use_web_search as should_use_web_search_ollama

@pytest.mark.parametrize("implementation", ["openai", "ollama"])
def test_should_use_web_search(implementation):
    """
    Tests the should_use_web_search function to ensure it correctly identifies
    queries that require web search.
    """
    if implementation == "openai":
        search_func = should_use_web_search_openai
    else:
        search_func = should_use_web_search_ollama

    # Test cases that should trigger web search
    assert search_func("who won the nba title this year 2025?") is True
    assert search_func("what is the latest news on AI?") is True
    assert search_func("current stock price of Apple") is True
    assert search_func("who is the president of the united states?") is True
    assert search_func("what's the weather like today?") is True
    assert search_func("how to bake a cake") is True
    assert search_func("latest updates on the mars rover") is True
    assert search_func("what is the capital of France?") is True # General knowledge but good to check

    # Test cases that should NOT trigger web search
    assert search_func("hello, how are you?") is False
    assert search_func("can you help me with a math problem?") is False
    assert search_func("tell me a story") is False
    assert search_func("what is your name?") is False
    assert search_func("summarize this document for me") is False