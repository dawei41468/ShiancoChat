import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from backend.routers.tools import ensure_default_tools, record_tool_audit


class FakeStreamResponse:
    status_code = 200

    async def aiter_bytes(self):
        yield b""

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


class FakeHttpxClient:
    def __init__(self, *args, **kwargs):
        pass

    def stream(self, *args, **kwargs):
        return FakeStreamResponse()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


class TestToolConfig:
    async def test_list_tools_user_sees_allowed(self, authorized_client, clean_db):
        response = await authorized_client.get("/api/tools")
        assert response.status_code == 200
        data = response.json()
        # Default tools are inserted automatically on first read
        assert len(data) == 2
        tool_ids = {t["id"] for t in data}
        assert tool_ids == {"web_search", "file_search"}

    async def test_list_tools_anon_unauthorized(self, anon_client):
        response = await anon_client.get("/api/tools")
        assert response.status_code == 401

    async def test_admin_can_update_tool(self, admin_client, clean_db):
        response = await admin_client.patch("/api/tools/web_search", json={"enabled": False})
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False

    async def test_user_cannot_update_tool(self, authorized_client, clean_db):
        response = await authorized_client.patch("/api/tools/web_search", json={"enabled": False})
        assert response.status_code == 403

    async def test_update_tool_default_enabled(self, admin_client, clean_db):
        response = await admin_client.patch("/api/tools/web_search", json={"default_enabled": True})
        assert response.status_code == 200
        data = response.json()
        assert data["default_enabled"] is True

    async def test_update_tool_allowed_roles(self, admin_client, clean_db):
        response = await admin_client.patch("/api/tools/web_search", json={"allowed_roles": ["Admin"]})
        assert response.status_code == 200
        data = response.json()
        assert data["allowed_roles"] == ["Admin"]


class TestToolAuditEvents:
    async def test_list_audit_events_admin_only(self, authorized_client, admin_client, clean_db):
        user_resp = await authorized_client.get("/api/tools/audit")
        assert user_resp.status_code == 403

        admin_resp = await admin_client.get("/api/tools/audit")
        assert admin_resp.status_code == 200
        assert isinstance(admin_resp.json(), list)

    async def test_record_tool_audit_writes_to_db(self, test_user, clean_db):
        from backend.database import db
        await record_tool_audit(
            db,
            tool_id="web_search",
            current_user=test_user,
            conversation_id="conv-123",
            status="success",
            latency_ms=150,
            details={"result_count": 5},
        )
        events = await db.tool_audit_events.find().to_list(10)
        assert len(events) == 1
        assert events[0]["tool_id"] == "web_search"
        assert events[0]["user_email"] == test_user.email
        assert events[0]["status"] == "success"
        assert events[0]["latency_ms"] == 150
        assert events[0]["details"]["result_count"] == 5
        assert events[0]["conversation_id"] == "conv-123"


class TestToolPolicyEnforcement:
    async def test_disabled_web_search_blocks_explicit_request(self, authorized_client, admin_client, test_user, clean_db):
        # Create a conversation as the test user
        conv_resp = await authorized_client.post("/api/chat/new", json={"title": "Test"})
        assert conv_resp.status_code == 200
        conversation_id = conv_resp.json()["id"]

        # Disable web_search as admin
        patch_resp = await admin_client.patch("/api/tools/web_search", json={"enabled": False})
        assert patch_resp.status_code == 200

        # Try to chat with web_search_enabled=True as the test user
        response = await authorized_client.post("/api/openai/chat", json={
            "conversation_id": conversation_id,
            "text": "hello",
            "model": "test-model",
            "web_search_enabled": True,
            "rag_enabled": False,
        })
        assert response.status_code == 403
        detail = response.json().get("detail", "").lower()
        assert "disabled" in detail

    async def test_disabled_file_search_blocks_rag(self, authorized_client, admin_client, test_user, clean_db):
        # Create a conversation as the test user
        conv_resp = await authorized_client.post("/api/chat/new", json={"title": "Test"})
        assert conv_resp.status_code == 200
        conversation_id = conv_resp.json()["id"]

        # Disable file_search as admin
        patch_resp = await admin_client.patch("/api/tools/file_search", json={"enabled": False})
        assert patch_resp.status_code == 200

        # Try to chat with rag_enabled=True as the test user
        response = await authorized_client.post("/api/openai/chat", json={
            "conversation_id": conversation_id,
            "text": "hello",
            "model": "test-model",
            "web_search_enabled": False,
            "rag_enabled": True,
        })
        assert response.status_code == 403
        detail = response.json().get("detail", "").lower()
        assert "disabled" in detail

    async def test_successful_web_search_writes_audit_record(self, authorized_client, admin_client, test_user, clean_db):
        from backend.database import db

        # Create a conversation as the test user
        conv_resp = await authorized_client.post("/api/chat/new", json={"title": "Test"})
        assert conv_resp.status_code == 200
        conversation_id = conv_resp.json()["id"]

        # Mock a successful web search result
        mock_result = MagicMock()
        mock_result.title = "Test Title"
        mock_result.url = "http://example.com"
        mock_result.snippet = "Test snippet"
        mock_result.source = "duckduckgo"

        with patch("backend.routers.openai.perform_web_search", return_value=[mock_result]):
            with patch("backend.routers.openai.httpx.AsyncClient", FakeHttpxClient):
                response = await authorized_client.post("/api/openai/chat", json={
                    "conversation_id": conversation_id,
                    "text": "latest news",
                    "model": "test-model",
                    "web_search_enabled": True,
                    "rag_enabled": False,
                })
                assert response.status_code == 200

        # Verify audit record was written
        events = await db.tool_audit_events.find({"tool_id": "web_search"}).to_list(10)
        assert len(events) >= 1
        assert events[0]["status"] == "success"
        assert events[0]["user_email"] == test_user.email
        assert events[0]["conversation_id"] == conversation_id
        assert events[0]["details"]["result_count"] == 1

    async def test_successful_rag_writes_audit_record(self, authorized_client, test_user, clean_db):
        from backend.database import db
        from backend.utils.rag import embed_query, search_chunks

        # Create a conversation as the test user
        conv_resp = await authorized_client.post("/api/chat/new", json={"title": "Test"})
        assert conv_resp.status_code == 200
        conversation_id = conv_resp.json()["id"]

        # Mock embed_query and search_chunks to simulate a successful RAG retrieval
        mock_chunk = {
            "document_id": "doc-123",
            "chunk_index": 0,
            "content": "This is a test chunk about AI.",
            "similarity": 0.92,
        }

        with patch("backend.routers.openai.embed_query", return_value=[0.1] * 384):
            with patch("backend.routers.openai.search_chunks", return_value=[mock_chunk]):
                with patch("backend.routers.openai.httpx.AsyncClient", FakeHttpxClient):
                    response = await authorized_client.post("/api/openai/chat", json={
                        "conversation_id": conversation_id,
                        "text": "tell me about AI",
                        "model": "test-model",
                        "web_search_enabled": False,
                        "rag_enabled": True,
                    })
                    assert response.status_code == 200

        # Verify audit record was written
        events = await db.tool_audit_events.find({"tool_id": "file_search"}).to_list(10)
        assert len(events) >= 1
        assert events[0]["status"] == "success"
        assert events[0]["user_email"] == test_user.email
        assert events[0]["conversation_id"] == conversation_id
        assert events[0]["details"]["result_count"] == 1
