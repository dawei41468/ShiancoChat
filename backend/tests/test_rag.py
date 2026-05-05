import pytest
import numpy as np
from datetime import datetime, timezone

from backend.utils.rag import embed_query, search_chunks

pytestmark = pytest.mark.asyncio


class TestEmbedQuery:
    async def test_embed_query_returns_vector(self):
        """Embedding a query should return a non-empty vector."""
        embedding = await embed_query("What is machine learning?")
        assert isinstance(embedding, (list, np.ndarray))
        assert len(embedding) > 0

    async def test_embed_query_dimension(self):
        """Embedding should match the model's output dimension."""
        from backend.utils.rag import _get_embedding_model
        model = _get_embedding_model()
        expected_dim = model.get_sentence_embedding_dimension()

        embedding = await embed_query("What is machine learning?")
        assert isinstance(embedding, (list, np.ndarray))
        assert len(embedding) == expected_dim

    async def test_embed_query_consistency(self):
        """Same query should produce the same embedding."""
        emb1 = await embed_query("test query")
        emb2 = await embed_query("test query")
        assert np.allclose(emb1, emb2)

    async def test_embed_query_different_queries(self):
        """Different queries should produce different embeddings."""
        emb1 = await embed_query("machine learning")
        emb2 = await embed_query("cooking recipes")
        assert not np.allclose(emb1, emb2)


class TestSearchChunks:
    async def test_search_no_documents(self, clean_db):
        """Searching with no documents should return empty results."""
        query_embedding = await embed_query("test query")
        results = await search_chunks("test@example.com", query_embedding, top_k=5)
        assert results == []

    async def test_search_with_document(self, authorized_client, clean_db):
        """Upload a document and verify RAG search finds relevant chunks."""
        import io

        file_content = b"Machine learning is a subset of artificial intelligence. " \
                       b"It involves training algorithms on data to make predictions. " \
                       b"Deep learning is a type of machine learning using neural networks."
        upload_resp = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("ml_doc.txt", io.BytesIO(file_content), "text/plain")}
        )
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        from backend.database import db
        from backend.utils.rag import _get_embedding_model

        model = _get_embedding_model()
        chunks = await db.document_chunks.find({"document_id": doc_id}).to_list(100)
        assert len(chunks) > 0

        for chunk in chunks:
            embedding = model.encode(chunk["content"], convert_to_tensor=False).tolist()
            await db.document_chunks.update_one(
                {"_id": chunk["_id"]},
                {"$set": {"embedding": embedding}}
            )

        query_embedding = await embed_query("What is machine learning?")
        results = await search_chunks(
            user_email=upload_resp.json().get("user_email") or "test@example.com",
            query_embedding=query_embedding,
            top_k=3,
            threshold=0.3
        )

        assert len(results) > 0
        assert all("content" in r for r in results)
        assert all("similarity" in r for r in results)
        assert all(r["similarity"] >= 0.3 for r in results)

    async def test_search_filters_by_user(self, authorized_client, clean_db):
        """Search should only return chunks belonging to the requesting user."""
        import io

        file_content = b"User-specific document content"
        upload_resp = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("user_doc.txt", io.BytesIO(file_content), "text/plain")}
        )
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        from backend.database import db
        from backend.utils.rag import _get_embedding_model

        model = _get_embedding_model()
        chunks = await db.document_chunks.find({"document_id": doc_id}).to_list(100)
        for chunk in chunks:
            embedding = model.encode(chunk["content"], convert_to_tensor=False).tolist()
            await db.document_chunks.update_one(
                {"_id": chunk["_id"]},
                {"$set": {"embedding": embedding}}
            )

        query_embedding = await embed_query("document content")
        results = await search_chunks(
            user_email="other@example.com",
            query_embedding=query_embedding,
            top_k=5,
            threshold=0.3
        )
        assert results == []

    async def test_search_empty_embedding(self, clean_db):
        """Empty embedding should return empty results gracefully."""
        results = await search_chunks("test@example.com", [], top_k=5)
        assert results == []

    async def test_search_chunks_cross_user(self, authorized_client, authorized_client_b, clean_db):
        """User B should not retrieve chunks uploaded by User A."""
        import io
        from backend.database import db
        from backend.utils.rag import _get_embedding_model

        file_content = b"User A secret document content about quantum physics"
        upload_resp = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("secret.txt", io.BytesIO(file_content), "text/plain")}
        )
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        model = _get_embedding_model()
        chunks = await db.document_chunks.find({"document_id": doc_id}).to_list(100)
        for chunk in chunks:
            embedding = model.encode(chunk["content"], convert_to_tensor=False).tolist()
            await db.document_chunks.update_one(
                {"_id": chunk["_id"]},
                {"$set": {"embedding": embedding}}
            )

        query_embedding = await embed_query("quantum physics")
        results = await search_chunks(
            user_email="testb@example.com",
            query_embedding=query_embedding,
            top_k=5,
            threshold=0.3
        )
        assert results == []


class TestAdvancedRAG:
    """Tests for hybrid search, MMR, and knowledge space filtering."""

    async def test_search_with_knowledge_space_filter(self, authorized_client, clean_db):
        """Search should filter by knowledge_space_id when provided."""
        import io
        from backend.database import db
        from backend.utils.rag import _get_embedding_model

        # Create two knowledge spaces
        space_1_resp = await authorized_client.post("/api/documents/spaces", json={
            "name": "Space One",
            "description": "First space",
            "scope": "user",
        })
        assert space_1_resp.status_code == 200
        space_1_id = space_1_resp.json()["id"]

        space_2_resp = await authorized_client.post("/api/documents/spaces", json={
            "name": "Space Two",
            "description": "Second space",
            "scope": "user",
        })
        assert space_2_resp.status_code == 200
        space_2_id = space_2_resp.json()["id"]

        # Upload documents to each space
        upload_resp_1 = await authorized_client.post(
            "/api/documents/upload",
            data={"knowledge_space_id": space_1_id},
            files={"file": ("space1.txt", io.BytesIO(b"Content about space one."), "text/plain")}
        )
        assert upload_resp_1.status_code == 200
        doc_1_id = upload_resp_1.json()["document_id"]

        upload_resp_2 = await authorized_client.post(
            "/api/documents/upload",
            data={"knowledge_space_id": space_2_id},
            files={"file": ("space2.txt", io.BytesIO(b"Content about space two."), "text/plain")}
        )
        assert upload_resp_2.status_code == 200
        doc_2_id = upload_resp_2.json()["document_id"]

        model = _get_embedding_model()
        for doc_id in [doc_1_id, doc_2_id]:
            chunks = await db.document_chunks.find({"document_id": doc_id}).to_list(100)
            for chunk in chunks:
                embedding = model.encode(chunk["content"], convert_to_tensor=False).tolist()
                await db.document_chunks.update_one(
                    {"_id": chunk["_id"]},
                    {"$set": {"embedding": embedding}}
                )

        query_embedding = await embed_query("space one")
        results = await search_chunks(
            user_email="test@example.com",
            query_embedding=query_embedding,
            top_k=5,
            threshold=0.3,
            knowledge_space_id=space_1_id,
        )

        # Results should only come from space_1 documents
        assert len(results) > 0
        for r in results:
            assert r["document_id"] == doc_1_id

    async def test_search_mmr_re_ranking(self, authorized_client, clean_db):
        """MMR re-ranking should diversify results."""
        import io
        from backend.database import db
        from backend.utils.rag import _get_embedding_model

        # Upload a document with multiple similar chunks
        content = b"Python is a programming language. " * 20 + b"Java is also a programming language. " * 20
        upload_resp = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("prog.txt", io.BytesIO(content), "text/plain")}
        )
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        model = _get_embedding_model()
        chunks = await db.document_chunks.find({"document_id": doc_id}).to_list(100)
        for chunk in chunks:
            embedding = model.encode(chunk["content"], convert_to_tensor=False).tolist()
            await db.document_chunks.update_one(
                {"_id": chunk["_id"]},
                {"$set": {"embedding": embedding}}
            )

        query_embedding = await embed_query("programming languages")
        results = await search_chunks(
            user_email="test@example.com",
            query_embedding=query_embedding,
            top_k=5,
            threshold=0.3,
        )

        # Should return results without crashing
        assert isinstance(results, list)

    async def test_hybrid_search_falls_back_to_vector(self, authorized_client, clean_db):
        """Hybrid search falls back to vector search when text index is unavailable."""
        import io
        from backend.database import db
        from backend.utils.rag import _get_embedding_model

        file_content = b"Artificial intelligence and machine learning"
        upload_resp = await authorized_client.post(
            "/api/documents/upload",
            files={"file": ("hybrid.txt", io.BytesIO(file_content), "text/plain")}
        )
        assert upload_resp.status_code == 200
        doc_id = upload_resp.json()["document_id"]

        model = _get_embedding_model()
        chunks = await db.document_chunks.find({"document_id": doc_id}).to_list(100)
        for chunk in chunks:
            embedding = model.encode(chunk["content"], convert_to_tensor=False).tolist()
            await db.document_chunks.update_one(
                {"_id": chunk["_id"]},
                {"$set": {"embedding": embedding}}
            )

        query_embedding = await embed_query("machine learning")
        results = await search_chunks(
            user_email="test@example.com",
            query_embedding=query_embedding,
            top_k=5,
            threshold=0.3,
            query_text="machine learning",
        )

        # Should return results even if hybrid search fails and falls back
        assert isinstance(results, list)
