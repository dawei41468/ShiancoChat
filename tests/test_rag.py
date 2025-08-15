import pytest
import asyncio
from backend.utils.rag import embed_query, search_chunks
from backend.database import get_db
import numpy as np

@pytest.mark.asyncio
async def test_embed_query():
    """Test that query embedding produces a non-empty vector of expected length."""
    query = "Test query for embedding"
    embedding = await embed_query(query)
    assert isinstance(embedding, list)
    assert len(embedding) > 0  # Assuming the model outputs a vector of some length
    assert all(isinstance(val, float) for val in embedding)

@pytest.mark.asyncio
async def test_search_chunks_no_results():
    """Test search_chunks with a dummy user and embedding, expecting no results."""
    user_email = "nonexistent@example.com"
    query_embedding = [0.0] * 384  # Dummy embedding vector, adjust length based on model
    results = await search_chunks(user_email, query_embedding, top_k=5, threshold=0.7)
    assert isinstance(results, list)
    assert len(results) == 0  # Expect no results for nonexistent user

# Note: Additional tests would require mocked data or a test database with known documents and embeddings.
# For now, these basic tests ensure the functions run without errors.