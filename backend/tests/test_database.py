import pytest
from backend.database import init_indexes, init_vector_index

pytestmark = pytest.mark.asyncio


class TestDatabaseIndexes:
    """Tests for MongoDB index initialization."""

    async def test_init_indexes_creates_expected_indexes(self, clean_db):
        """init_indexes creates all expected indexes."""
        db = clean_db
        await init_indexes()
        
        indexes = await db.users.list_indexes().to_list(None)
        index_names = {idx["name"] for idx in indexes}
        assert "user_email_idx" in index_names
        
        indexes = await db.conversations.list_indexes().to_list(None)
        index_names = {idx["name"] for idx in indexes}
        assert "conversations_user_updated_idx" in index_names
        
        indexes = await db.messages.list_indexes().to_list(None)
        index_names = {idx["name"] for idx in indexes}
        assert "messages_conversation_timestamp_idx" in index_names
        
        indexes = await db.document_chunks.list_indexes().to_list(None)
        index_names = {idx["name"] for idx in indexes}
        assert "document_chunks_doc_chunk_idx" in index_names
        assert "document_chunks_text_idx" in index_names
        assert "document_chunks_filter_idx" in index_names
        
        indexes = await db.refresh_tokens.list_indexes().to_list(None)
        index_names = {idx["name"] for idx in indexes}
        assert "refresh_token_hash_lookup_idx" in index_names
        assert "refresh_tokens_ttl_idx" in index_names

    async def test_init_vector_index_is_noop(self, clean_db):
        """init_vector_index should be a no-op (2dsphere removed)."""
        db = clean_db
        await init_vector_index()
        
        indexes = await db.document_chunks.list_indexes().to_list(None)
        index_names = {idx["name"] for idx in indexes}
        assert "embedding_vector_idx" not in index_names
