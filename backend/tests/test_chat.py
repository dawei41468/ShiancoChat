import pytest
from datetime import datetime, timezone

from backend.models import Conversation, Message


class TestConversations:
    async def test_create_conversation(self, authorized_client, test_user):
        response = await authorized_client.post("/api/chat/new", json={"title": "Test Chat"})
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Chat"
        assert data["user_email"] == test_user.email
        assert "id" in data

    async def test_create_conversation_unauthorized(self, anon_client):
        response = await anon_client.post("/api/chat/new", json={"title": "Test Chat"})
        assert response.status_code == 401

    async def test_fetch_conversations(self, authorized_client, test_user):
        # Create a conversation first
        await authorized_client.post("/api/chat/new", json={"title": "Chat 1"})
        await authorized_client.post("/api/chat/new", json={"title": "Chat 2"})

        response = await authorized_client.get("/api/chat/conversations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["title"] == "Chat 2"  # Most recent first
        assert data[1]["title"] == "Chat 1"

    async def test_fetch_conversations_empty(self, authorized_client):
        response = await authorized_client.get("/api/chat/conversations")
        assert response.status_code == 200
        data = response.json()
        assert data == []

    async def test_fetch_conversations_unauthorized(self, anon_client):
        response = await anon_client.get("/api/chat/conversations")
        assert response.status_code == 401


class TestMessages:
    async def test_save_message(self, authorized_client, test_user, clean_db):
        # Create a conversation
        conv_resp = await authorized_client.post("/api/chat/new", json={"title": "Test Chat"})
        conversation_id = conv_resp.json()["id"]

        # Save a message
        response = await authorized_client.post("/api/chat/messages", json={
            "conversation_id": conversation_id,
            "sender": "user",
            "text": "Hello, AI!",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        assert response.status_code == 200
        data = response.json()
        assert data["sender"] == "user"
        assert data["text"] == "Hello, AI!"
        assert data["conversation_id"] == conversation_id

    async def test_save_message_wrong_conversation(self, authorized_client, clean_db):
        # Try to save a message for a non-existent conversation
        response = await authorized_client.post("/api/chat/messages", json={
            "conversation_id": "non-existent-id",
            "sender": "user",
            "text": "Hello!",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        assert response.status_code == 404

    async def test_fetch_messages(self, authorized_client, test_user, clean_db):
        # Create conversation and messages
        conv_resp = await authorized_client.post("/api/chat/new", json={"title": "Test Chat"})
        conversation_id = conv_resp.json()["id"]

        await authorized_client.post("/api/chat/messages", json={
            "conversation_id": conversation_id,
            "sender": "user",
            "text": "Message 1",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        await authorized_client.post("/api/chat/messages", json={
            "conversation_id": conversation_id,
            "sender": "assistant",
            "text": "Response 1",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        response = await authorized_client.get(f"/api/chat/conversations/{conversation_id}/messages")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["sender"] == "user"
        assert data[1]["sender"] == "assistant"

    async def test_fetch_messages_unauthorized(self, anon_client):
        response = await anon_client.get("/api/chat/conversations/some-id/messages")
        assert response.status_code == 401

    async def test_fetch_messages_cross_user(self, authorized_client, authorized_client_b, test_user, clean_db):
        """User B should not be able to fetch User A's conversation messages."""
        # Create conversation as User A
        conv_resp = await authorized_client.post("/api/chat/new", json={"title": "Secret Chat"})
        conversation_id = conv_resp.json()["id"]

        # Add a message
        await authorized_client.post("/api/chat/messages", json={
            "conversation_id": conversation_id,
            "sender": "user",
            "text": "Secret message",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        # User B tries to fetch messages
        response = await authorized_client_b.get(f"/api/chat/conversations/{conversation_id}/messages")
        assert response.status_code == 404


class TestConversationManagement:
    async def test_rename_conversation(self, authorized_client, test_user, clean_db):
        conv_resp = await authorized_client.post("/api/chat/new", json={"title": "Old Title"})
        conversation_id = conv_resp.json()["id"]

        response = await authorized_client.put(
            f"/api/chat/conversations/{conversation_id}",
            json={"new_title": "New Title"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "New Title"

    async def test_rename_conversation_not_found(self, authorized_client):
        response = await authorized_client.put(
            "/api/chat/conversations/non-existent",
            json={"new_title": "New Title"}
        )
        assert response.status_code == 404

    async def test_delete_conversation(self, authorized_client, test_user, clean_db):
        conv_resp = await authorized_client.post("/api/chat/new", json={"title": "To Delete"})
        conversation_id = conv_resp.json()["id"]

        # Add a message
        await authorized_client.post("/api/chat/messages", json={
            "conversation_id": conversation_id,
            "sender": "user",
            "text": "Message",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        response = await authorized_client.delete(f"/api/chat/conversations/{conversation_id}")
        assert response.status_code == 204

        # Verify conversation is gone
        get_resp = await authorized_client.get("/api/chat/conversations")
        assert len(get_resp.json()) == 0

    async def test_delete_conversation_not_found(self, authorized_client):
        response = await authorized_client.delete("/api/chat/conversations/non-existent")
        assert response.status_code == 404

    async def test_generate_title(self, authorized_client, test_user, clean_db):
        conv_resp = await authorized_client.post("/api/chat/new", json={"title": "Untitled"})
        conversation_id = conv_resp.json()["id"]

        # Add a user message
        await authorized_client.post("/api/chat/messages", json={
            "conversation_id": conversation_id,
            "sender": "user",
            "text": "Tell me about quantum computing",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        response = await authorized_client.post(
            f"/api/chat/conversations/{conversation_id}/generate-title",
            json={"model": "test-model"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "new_title" in data
        assert data["new_title"] != "Untitled"
