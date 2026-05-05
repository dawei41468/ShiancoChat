import pytest
from unittest.mock import patch, AsyncMock
from backend.models import Conversation, Message
from datetime import datetime, timezone

pytestmark = pytest.mark.asyncio


class TestOpenAIChatAuth:
    async def test_stream_chat_requires_auth(self, anon_client):
        response = await anon_client.post("/api/openai/chat", json={
            "conversation_id": "some-conversation",
            "text": "hello",
            "model": "test-model",
            "web_search_enabled": False,
            "rag_enabled": False,
        })
        assert response.status_code == 401

    async def test_stream_chat_requires_owned_conversation(self, authorized_client):
        response = await authorized_client.post("/api/openai/chat", json={
            "conversation_id": "not-owned",
            "text": "hello",
            "model": "test-model",
            "web_search_enabled": False,
            "rag_enabled": False,
        })
        assert response.status_code == 404

    async def test_stream_chat_cross_user_conversation(self, authorized_client, authorized_client_b, clean_db):
        """User B should not be able to chat in User A's conversation."""
        conv_resp = await authorized_client.post("/api/chat/new", json={"title": "Private Chat"})
        conversation_id = conv_resp.json()["id"]

        response = await authorized_client_b.post("/api/openai/chat", json={
            "conversation_id": conversation_id,
            "text": "hello",
            "model": "test-model",
            "web_search_enabled": False,
            "rag_enabled": False,
        })
        assert response.status_code == 404


class TestOpenAIEndpointsAuth:
    """Auth tests for openai router endpoints."""

    async def test_models_endpoint_requires_auth(self, anon_client):
        """GET /api/openai/models should require authentication."""
        response = await anon_client.get("/api/openai/models")
        assert response.status_code == 401

    async def test_models_endpoint_returns_models(self, authorized_client):
        """Authenticated user can fetch models."""
        response = await authorized_client.get("/api/openai/models")
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert isinstance(data["models"], list)

    async def test_config_endpoint_requires_auth(self, anon_client):
        """GET /api/openai/config should require authentication."""
        response = await anon_client.get("/api/openai/config")
        assert response.status_code == 401

    async def test_config_endpoint_returns_endpoints(self, authorized_client):
        """Authenticated user can fetch LLM config."""
        response = await authorized_client.get("/api/openai/config")
        assert response.status_code == 200
        data = response.json()
        assert "endpoints" in data

    async def test_rag_config_endpoint_requires_auth(self, anon_client):
        """GET /api/openai/rag/config should require authentication."""
        response = await anon_client.get("/api/openai/rag/config")
        assert response.status_code == 401

    async def test_rag_config_endpoint_returns_config(self, authorized_client):
        """Authenticated user can fetch RAG config."""
        response = await authorized_client.get("/api/openai/rag/config")
        assert response.status_code == 200
        data = response.json()
        assert "embedding_model" in data
        assert "vector_search_enabled" in data


class TestOpenAIStreaming:
    """Tests for chat streaming functionality."""

    async def test_stream_chat_success(self, authorized_client, test_user, clean_db):
        """Successful chat streaming returns SSE response."""
        conv = Conversation(
            title="Test",
            user_email=test_user.email,
            created_at=datetime.now(timezone.utc),
            last_updated=datetime.now(timezone.utc),
        )
        await clean_db.conversations.insert_one(conv.dict())

        response = await authorized_client.post("/api/openai/chat", json={
            "conversation_id": conv.id,
            "text": "Hello",
            "model": "test-model",
            "web_search_enabled": False,
            "rag_enabled": False,
        })
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"

    async def test_stream_chat_with_web_search(self, authorized_client, test_user, clean_db):
        """Chat with web search enabled augments the prompt."""
        conv = Conversation(
            title="Test",
            user_email=test_user.email,
            created_at=datetime.now(timezone.utc),
            last_updated=datetime.now(timezone.utc),
        )
        await clean_db.conversations.insert_one(conv.dict())

        mock_result = type("Result", (), {
            "title": "News", "url": "https://example.com", "snippet": "Latest news"
        })()

        with patch("backend.routers.openai.perform_web_search", new_callable=AsyncMock, return_value=[mock_result]):
            response = await authorized_client.post("/api/openai/chat", json={
                "conversation_id": conv.id,
                "text": "What's the latest news?",
                "model": "test-model",
                "web_search_enabled": True,
                "rag_enabled": False,
            })
        assert response.status_code == 200

    async def test_stream_chat_with_rag(self, authorized_client, test_user, clean_db):
        """Chat with RAG enabled augments the prompt with document chunks."""
        import io
        conv = Conversation(
            title="Test",
            user_email=test_user.email,
            created_at=datetime.now(timezone.utc),
            last_updated=datetime.now(timezone.utc),
        )
        await clean_db.conversations.insert_one(conv.dict())

        # Upload a document
        upload_resp = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("doc.txt", io.BytesIO(b"Machine learning is a subset of AI."), "text/plain")}
        )
        assert upload_resp.status_code == 200

        # Manually add embeddings so RAG works
        from backend.utils.rag import _get_embedding_model
        model = _get_embedding_model()
        chunks = await clean_db.document_chunks.find({"document_id": upload_resp.json()["document_id"]}).to_list(100)
        for chunk in chunks:
            embedding = model.encode(chunk["content"], convert_to_tensor=False).tolist()
            await clean_db.document_chunks.update_one(
                {"_id": chunk["_id"]},
                {"$set": {"embedding": embedding}}
            )

        response = await authorized_client.post("/api/openai/chat", json={
            "conversation_id": conv.id,
            "text": "What is machine learning?",
            "model": "test-model",
            "web_search_enabled": False,
            "rag_enabled": True,
        })
        assert response.status_code == 200

    async def test_stream_chat_web_search_error_handled(self, authorized_client, test_user, clean_db):
        """Web search errors are handled gracefully without crashing the stream."""
        from backend.utils.web_search.main import WebSearchError
        conv = Conversation(
            title="Test",
            user_email=test_user.email,
            created_at=datetime.now(timezone.utc),
            last_updated=datetime.now(timezone.utc),
        )
        await clean_db.conversations.insert_one(conv.dict())

        with patch("backend.routers.openai.perform_web_search", new_callable=AsyncMock, side_effect=WebSearchError("Search failed")):
            response = await authorized_client.post("/api/openai/chat", json={
                "conversation_id": conv.id,
                "text": "What's the weather?",
                "model": "test-model",
                "web_search_enabled": True,
                "rag_enabled": False,
            })
        assert response.status_code == 200


class TestGenerateTitle:
    """Tests for the generate_title utility function."""

    async def test_generate_title_uses_llm(self):
        """generate_title should call the LLM and return the title."""
        from backend.routers.openai import generate_title
        title = await generate_title([{"role": "user", "content": "Explain quantum computing"}], "test-model")
        assert isinstance(title, str)
        assert len(title) > 0
