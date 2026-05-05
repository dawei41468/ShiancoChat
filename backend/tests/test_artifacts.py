import pytest
from datetime import datetime, timezone
from backend.models import Conversation, Artifact, ArtifactCreate

pytestmark = pytest.mark.asyncio


class TestArtifactEndpoints:
    """Tests for artifact CRUD endpoints."""

    async def _create_conversation(self, db, user_email: str) -> Conversation:
        conv = Conversation(
            title="Test Conv",
            user_email=user_email,
            created_at=datetime.now(timezone.utc),
            last_updated=datetime.now(timezone.utc),
        )
        await db.conversations.insert_one(conv.dict())
        return conv

    async def test_create_artifact(self, authorized_client, test_user, clean_db):
        """Create an artifact for a conversation."""
        conv = await self._create_conversation(clean_db, test_user.email)
        payload = {
            "conversation_id": conv.id,
            "type": "document",
            "title": "Test Artifact",
            "content": "# Test Content",
        }
        response = await authorized_client.post("/api/chat/artifacts", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Artifact"
        assert data["content"] == "# Test Content"
        assert data["conversation_id"] == conv.id
        assert data["user_email"] == test_user.email

    async def test_fetch_artifacts_for_conversation(self, authorized_client, test_user, clean_db):
        """Fetch artifacts for a conversation."""
        conv = await self._create_conversation(clean_db, test_user.email)
        artifact = Artifact(
            conversation_id=conv.id,
            user_email=test_user.email,
            type="document",
            title="Artifact 1",
            content="Content 1",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        await clean_db.artifacts.insert_one(artifact.dict())

        response = await authorized_client.get(f"/api/chat/conversations/{conv.id}/artifacts")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Artifact 1"

    async def test_update_artifact(self, authorized_client, test_user, clean_db):
        """Update an artifact's title and content."""
        conv = await self._create_conversation(clean_db, test_user.email)
        artifact = Artifact(
            conversation_id=conv.id,
            user_email=test_user.email,
            type="document",
            title="Old Title",
            content="Old content",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        await clean_db.artifacts.insert_one(artifact.dict())

        response = await authorized_client.patch(
            f"/api/chat/artifacts/{artifact.id}",
            json={"title": "New Title", "content": "New content"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "New Title"
        assert data["content"] == "New content"

    async def test_update_artifact_empty_title_rejected(self, authorized_client, test_user, clean_db):
        """Updating an artifact with an empty title should fail."""
        conv = await self._create_conversation(clean_db, test_user.email)
        artifact = Artifact(
            conversation_id=conv.id,
            user_email=test_user.email,
            type="document",
            title="Title",
            content="Content",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        await clean_db.artifacts.insert_one(artifact.dict())

        response = await authorized_client.patch(
            f"/api/chat/artifacts/{artifact.id}",
            json={"title": "   "}
        )
        assert response.status_code == 400

    async def test_delete_artifact(self, authorized_client, test_user, clean_db):
        """Delete an artifact."""
        conv = await self._create_conversation(clean_db, test_user.email)
        artifact = Artifact(
            conversation_id=conv.id,
            user_email=test_user.email,
            type="document",
            title="To Delete",
            content="Content",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        await clean_db.artifacts.insert_one(artifact.dict())

        response = await authorized_client.delete(f"/api/chat/artifacts/{artifact.id}")
        assert response.status_code == 204

        response = await authorized_client.get(f"/api/chat/conversations/{conv.id}/artifacts")
        data = response.json()
        assert len(data) == 0

    async def test_cross_user_artifact_access_denied(self, authorized_client, authorized_client_b, test_user, test_user_b, clean_db):
        """Users cannot access artifacts belonging to other users."""
        conv = await self._create_conversation(clean_db, test_user.email)
        artifact = Artifact(
            conversation_id=conv.id,
            user_email=test_user.email,
            type="document",
            title="Private",
            content="Content",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        await clean_db.artifacts.insert_one(artifact.dict())

        response = await authorized_client_b.get(f"/api/chat/conversations/{conv.id}/artifacts")
        assert response.status_code == 404

    async def test_artifact_pagination(self, authorized_client, test_user, clean_db):
        """Artifact list pagination works."""
        conv = await self._create_conversation(clean_db, test_user.email)
        for i in range(5):
            artifact = Artifact(
                conversation_id=conv.id,
                user_email=test_user.email,
                type="document",
                title=f"Artifact {i}",
                content=f"Content {i}",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            await clean_db.artifacts.insert_one(artifact.dict())

        response = await authorized_client.get(f"/api/chat/conversations/{conv.id}/artifacts?limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
