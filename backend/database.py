import os
import logging
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

logger = logging.getLogger(__name__)

# Load environment variables
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

# MongoDB connection details
mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME')

if not mongo_url or not db_name:
    raise ValueError("Missing required environment variables. Please ensure MONGO_URL and DB_NAME are set in your .env file.")

# Lazy-initialized client and db (initialized on first use or explicit call)
client = None
db = None


async def init_client_with_retry(max_retries=5, base_delay=1.0):
    """Initialize MongoDB client with exponential backoff retry."""
    global client, db
    if client is not None:
        return

    last_error = None
    for attempt in range(max_retries):
        try:
            client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
            await client.admin.command("ping")
            db = client[db_name]
            logger.info(f"MongoDB connected successfully on attempt {attempt + 1}")
            return
        except Exception as e:
            last_error = e
            logger.warning(f"MongoDB connection attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.info(f"Retrying in {delay:.1f}s...")
                await asyncio.sleep(delay)

    logger.error(f"MongoDB connection failed after {max_retries} attempts: {last_error}")
    raise last_error


# Dependency function to get the database session
async def get_db():
    if db is None:
        await init_client_with_retry()
    return db

async def delete_user(user_email: str):
    # Find all conversations belonging to the user
    user_conversations = db.conversations.find({"user_email": user_email})
    conversation_ids = [conv["id"] async for conv in user_conversations]

    # Delete all messages associated with these conversations
    if conversation_ids:
        await db.messages.delete_many({"conversation_id": {"$in": conversation_ids}})

    # Delete all conversations belonging to the user
    await db.conversations.delete_many({"user_email": user_email})

    user_docs = await db.documents.find({"user_email": user_email}).to_list(length=None)
    document_ids = [doc["_id"] for doc in user_docs]
    if document_ids:
        await db.document_chunks.delete_many({"document_id": {"$in": document_ids}})
        await db.documents.delete_many({"_id": {"$in": document_ids}})

    await db.artifacts.delete_many({"user_email": user_email})

    await db.refresh_tokens.update_many(
        {"email": user_email},
        {"$set": {"is_active": False}}
    )

    # Delete the user document
    await db.users.delete_one({"email": user_email})

def close_mongo_connection():
    client.close()

async def init_indexes():
    """Initialize all MongoDB indexes for performance."""
    try:
        # Users: unique index on email for fast lookups
        await db.users.create_index("email", unique=True, name="user_email_idx")
        logger.info("Index created: users.email (unique)")

        # Conversations: compound index for user conversations sorted by last_updated
        await db.conversations.create_index(
            [("user_email", 1), ("last_updated", -1)],
            name="conversations_user_updated_idx"
        )
        logger.info("Index created: conversations(user_email, last_updated)")

        # Messages: index for conversation message lookups
        await db.messages.create_index(
            [("conversation_id", 1), ("timestamp", 1)],
            name="messages_conversation_timestamp_idx"
        )
        logger.info("Index created: messages(conversation_id, timestamp)")

        # Document chunks: index for document chunk lookups
        await db.document_chunks.create_index(
            [("document_id", 1), ("chunk_index", 1)],
            name="document_chunks_doc_chunk_idx"
        )
        logger.info("Index created: document_chunks(document_id, chunk_index)")

        # Documents: index for user document lookups
        await db.documents.create_index(
            [("user_email", 1), ("created_at", -1)],
            name="documents_user_created_idx"
        )
        logger.info("Index created: documents(user_email, created_at)")

        # Refresh tokens: index for token validation
        await db.refresh_tokens.create_index(
            [("token_hash", 1), ("is_active", 1), ("expires_at", 1)],
            name="refresh_token_hash_lookup_idx"
        )
        logger.info("Index created: refresh_tokens(token_hash, is_active, expires_at)")

        # TTL index for expired documents (auto-cleanup after expires_at)
        await db.documents.create_index(
            [("expires_at", 1)],
            expireAfterSeconds=0,
            name="documents_ttl_idx"
        )
        logger.info("Index created: documents.expires_at (TTL)")

        # TTL index for expired refresh tokens
        await db.refresh_tokens.create_index(
            [("expires_at", 1)],
            expireAfterSeconds=0,
            name="refresh_tokens_ttl_idx"
        )
        logger.info("Index created: refresh_tokens.expires_at (TTL)")

        # Text index for hybrid search on document chunks content
        try:
            await db.document_chunks.create_index(
                [("content", "text")],
                name="document_chunks_text_idx"
            )
            logger.info("Index created: document_chunks.content (text)")
        except Exception as e:
            logger.info(f"Note: Text index creation skipped: {str(e)}")

        # Index for vector search filter fields. Older installs used the same
        # name without knowledge_space_id, so replace that stale definition.
        existing_indexes = await db.document_chunks.list_indexes().to_list(100)
        for index in existing_indexes:
            if index.get("name") == "document_chunks_filter_idx":
                existing_keys = list(index.get("key", {}).items())
                expected_keys = [("user_email", 1), ("conversation_id", 1), ("knowledge_space_id", 1)]
                if existing_keys != expected_keys:
                    await db.document_chunks.drop_index("document_chunks_filter_idx")
                    logger.info("Dropped stale index: document_chunks_filter_idx")
                break

        # Index for vector search filter fields
        await db.document_chunks.create_index(
            [("user_email", 1), ("conversation_id", 1), ("knowledge_space_id", 1)],
            name="document_chunks_filter_idx"
        )
        logger.info("Index created: document_chunks(user_email, conversation_id, knowledge_space_id)")

        await db.knowledge_spaces.create_index(
            [("owner_email", 1), ("updated_at", -1)],
            name="knowledge_spaces_owner_updated_idx"
        )
        logger.info("Index created: knowledge_spaces(owner_email, updated_at)")

        await db.artifacts.create_index(
            [("conversation_id", 1), ("user_email", 1), ("updated_at", -1)],
            name="artifacts_conversation_user_updated_idx"
        )
        logger.info("Index created: artifacts(conversation_id, user_email, updated_at)")

        await db.artifacts.create_index(
            [("conversation_id", 1), ("source_message_id", 1), ("user_email", 1)],
            name="artifacts_source_message_idx"
        )
        logger.info("Index created: artifacts(conversation_id, source_message_id, user_email)")

        await db.tool_configs.create_index(
            [("id", 1)],
            unique=True,
            name="tool_configs_id_idx"
        )
        logger.info("Index created: tool_configs.id")

        await db.tool_audit_events.create_index(
            [("created_at", -1)],
            name="tool_audit_events_created_idx"
        )
        logger.info("Index created: tool_audit_events.created_at")

    except Exception as e:
        logger.error(f"Error creating indexes: {str(e)}")


async def init_vector_index():
    """No-op: removed incorrect 2dsphere vector index.
    Semantic search is performed in-memory using numpy cosine similarity
    in backend/utils/rag.py. For production vector search, use MongoDB Atlas
    Vector Search or a dedicated vector database like Qdrant.
    """
    pass
