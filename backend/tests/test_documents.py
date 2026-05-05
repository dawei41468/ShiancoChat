import pytest
from datetime import datetime, timedelta, timezone

class TestDocumentUpload:
    async def test_upload_unsupported_type(self, authorized_client):
        """Uploading an unsupported file type should fail."""
        import io
        file_content = b"some content"
        response = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("test.exe", io.BytesIO(file_content), "application/octet-stream")}
        )
        assert response.status_code == 400
        assert "Unsupported file type" in response.json()["detail"]

    async def test_upload_no_filename(self, authorized_client):
        """Uploading without a filename should fail."""
        import io
        response = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("", io.BytesIO(b"content"), "text/plain")}
        )
        # FastAPI validates empty filename before our code runs
        assert response.status_code in (400, 422)

    async def test_upload_txt_file(self, authorized_client, clean_db):
        """Uploading a valid .txt file should succeed."""
        import io
        file_content = b"This is a test document for RAG. It contains important information about testing."
        response = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("test.txt", io.BytesIO(file_content), "text/plain")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "test.txt"
        assert "document_id" in data
        assert "content" in data
        assert "expires_at" in data

    async def test_upload_unauthorized(self, anon_client):
        """Uploading without auth should fail."""
        import io
        response = await anon_client.post(
            "/api/documents/upload",
            files={"file": ("test.txt", io.BytesIO(b"content"), "text/plain")}
        )
        assert response.status_code == 401


class TestKnowledgeSpaces:
    async def test_list_spaces_unauthorized(self, anon_client):
        response = await anon_client.get("/api/documents/spaces")
        assert response.status_code == 401

    async def test_create_update_delete_knowledge_space(self, authorized_client, clean_db):
        create_resp = await authorized_client.post(
            "/api/documents/spaces",
            json={"name": "Project Atlas", "description": "Working set for Atlas"}
        )
        assert create_resp.status_code == 200
        space = create_resp.json()
        assert space["name"] == "Project Atlas"
        assert space["description"] == "Working set for Atlas"

        update_resp = await authorized_client.patch(
            f"/api/documents/spaces/{space['id']}",
            json={"name": "Project Atlas v2", "description": "Updated description"}
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["name"] == "Project Atlas v2"
        assert updated["description"] == "Updated description"

        delete_resp = await authorized_client.delete(f"/api/documents/spaces/{space['id']}")
        assert delete_resp.status_code == 204

        list_resp = await authorized_client.get("/api/documents/spaces")
        assert list_resp.status_code == 200
        assert all(item["id"] != space["id"] for item in list_resp.json())

    async def test_default_space_cannot_be_modified_or_deleted(self, authorized_client, clean_db):
        list_resp = await authorized_client.get("/api/documents/spaces")
        assert list_resp.status_code == 200
        default_space = next(item for item in list_resp.json() if item["name"] == "My Knowledge")

        update_resp = await authorized_client.patch(
            f"/api/documents/spaces/{default_space['id']}",
            json={"name": "Renamed Default"}
        )
        assert update_resp.status_code == 400

        delete_resp = await authorized_client.delete(f"/api/documents/spaces/{default_space['id']}")
        assert delete_resp.status_code == 400


class TestDocumentFetch:
    async def test_get_document(self, authorized_client, clean_db):
        """Should fetch a document by ID."""
        import io
        file_content = b"Document content for fetching"
        upload_resp = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("fetch_test.txt", io.BytesIO(file_content), "text/plain")}
        )
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        response = await authorized_client.get(f"/api/documents/{doc_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "fetch_test.txt"
        assert data["content"] == "Document content for fetching"

    async def test_get_document_not_found(self, authorized_client):
        """Fetching a non-existent document should 404."""
        response = await authorized_client.get("/api/documents/non-existent-id")
        assert response.status_code == 404

    async def test_get_document_unauthorized(self, anon_client):
        """Fetching without auth should fail."""
        response = await anon_client.get("/api/documents/some-id")
        assert response.status_code == 401

    async def test_get_document_cross_user(self, authorized_client, authorized_client_b, clean_db):
        """User B should not be able to fetch User A's document."""
        import io
        upload_resp = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("cross_user.txt", io.BytesIO(b"secret content"), "text/plain")}
        )
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        response = await authorized_client_b.get(f"/api/documents/{doc_id}")
        assert response.status_code == 404


class TestDocumentDelete:
    async def test_delete_document(self, authorized_client, clean_db):
        """Should delete a document."""
        import io
        upload_resp = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("delete_test.txt", io.BytesIO(b"to delete"), "text/plain")}
        )
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        response = await authorized_client.delete(f"/api/documents/{doc_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "success"

        # Verify it's gone
        get_resp = await authorized_client.get(f"/api/documents/{doc_id}")
        assert get_resp.status_code == 404

    async def test_delete_document_not_found(self, authorized_client):
        """Deleting a non-existent document should 404."""
        response = await authorized_client.delete("/api/documents/non-existent-id")
        assert response.status_code == 404

    async def test_delete_document_cross_user(self, authorized_client, authorized_client_b, clean_db):
        """User B should not be able to delete User A's document."""
        import io
        upload_resp = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("cross_user_del.txt", io.BytesIO(b"to delete"), "text/plain")}
        )
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        response = await authorized_client_b.delete(f"/api/documents/{doc_id}")
        assert response.status_code == 404

        # Verify User A can still fetch it
        get_resp = await authorized_client.get(f"/api/documents/{doc_id}")
        assert get_resp.status_code == 200


class TestChunkOwnership:
    async def test_upload_stores_chunk_ownership(self, authorized_client, clean_db, test_user):
        """Uploaded chunks should contain user_email and conversation_id."""
        import io
        from backend.database import db

        file_content = b"Chunk ownership test content. " * 20
        response = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("ownership_test.txt", io.BytesIO(file_content), "text/plain")}
        )
        assert response.status_code == 200
        doc_id = response.json()["document_id"]

        chunks = await db.document_chunks.find({"document_id": doc_id}).to_list(100)
        assert len(chunks) > 0
        for chunk in chunks:
            assert chunk.get("user_email") == test_user.email
            assert chunk.get("knowledge_space_id") is not None


class TestDocumentCleanup:
    async def test_cleanup_expired_documents(self, authorized_client, admin_client, clean_db):
        """Cleanup should remove expired documents."""
        import io
        # Upload a document
        upload_resp = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("cleanup_test.txt", io.BytesIO(b"old content"), "text/plain")}
        )
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        # Manually expire the document by setting expires_at in the past
        from backend.database import db
        await db.documents.update_one(
            {"_id": doc_id},
            {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(hours=1)}}
        )

        # Run cleanup
        response = await admin_client.post("/api/documents/cleanup")
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] >= 1

        # Verify document is gone
        get_resp = await authorized_client.get(f"/api/documents/{doc_id}")
        assert get_resp.status_code == 404

    async def test_cleanup_no_expired_documents(self, admin_client, clean_db):
        """Cleanup with no expired documents should return 0 deleted."""
        response = await admin_client.post("/api/documents/cleanup")
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == 0

    async def test_cleanup_requires_admin(self, authorized_client, clean_db):
        """Cleanup should be restricted to admins."""
        response = await authorized_client.post("/api/documents/cleanup")
        assert response.status_code == 403
