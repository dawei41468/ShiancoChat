import numpy as np
from typing import List, Optional, Dict, Any
from backend.database import get_db
from datetime import datetime, timezone
from backend.config import config

import logging
logger = logging.getLogger(__name__)

# Lazy-loaded embedding model
_embedding_model = None
_embedding_model_name = None

def _get_embedding_model():
    global _embedding_model, _embedding_model_name
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        import os

        # Determine model path: explicit path > model name > default
        if config.embedding_model_path:
            model_path = config.embedding_model_path
        else:
            # Look in backend/models/ directory
            models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
            model_path = os.path.join(models_dir, config.embedding_model_name)

            # If not found locally, try downloading via sentence-transformers
            if not os.path.exists(model_path):
                model_path = config.embedding_model_name

        logger.info(f"Loading embedding model: {model_path}")
        _embedding_model = SentenceTransformer(model_path)
        _embedding_model_name = config.embedding_model_name
        logger.info(f"Embedding model loaded: {_embedding_model_name}")
    return _embedding_model


def _get_embedding_model_info() -> Dict[str, Any]:
    """Get info about the currently loaded embedding model."""
    model = _get_embedding_model()
    return {
        "name": _embedding_model_name or config.embedding_model_name,
        "embedding_dim": model.get_sentence_embedding_dimension(),
    }


async def embed_query(query: str) -> List[float]:
    """Embed a query string into a vector using the configured model."""
    try:
        model = _get_embedding_model()
        # For bge-m3, we should add the instruction prefix for retrieval
        if "bge" in config.embedding_model_name.lower():
            query = f"Represent this sentence for searching relevant passages: {query}"

        embedding_tensor = model.encode(query, convert_to_tensor=True)
        embedding = embedding_tensor.cpu().numpy()
        if getattr(embedding, "ndim", 1) > 1:
            embedding = embedding[0]
        return embedding.tolist() if hasattr(embedding, 'tolist') else list(embedding)
    except Exception as e:
        logger.error(f"Error embedding query: {str(e)}")
        return []


async def embed_documents(texts: List[str]) -> List[List[float]]:
    """Embed multiple documents in a batch."""
    try:
        model = _get_embedding_model()
        # For bge-m3, add instruction prefix for document embedding
        if "bge" in config.embedding_model_name.lower():
            texts = [f"Represent this document for retrieval: {t}" for t in texts]

        embeddings = model.encode(texts, convert_to_tensor=False)
        return embeddings.tolist()
    except Exception as e:
        logger.error(f"Error embedding documents: {str(e)}")
        return []


async def _vector_search_atlas(
    user_email: Optional[str],
    query_embedding: List[float],
    top_k: int = 5,
    conversation_id: Optional[str] = None,
    knowledge_space_id: Optional[str] = None,
) -> List[dict]:
    """Search using MongoDB Atlas Vector Search ($vectorSearch aggregation)."""
    db = await get_db()

    # Build the vectorSearch stage
    vector_search_stage = {
        "$vectorSearch": {
            "index": config.vector_search_index,
            "path": "embedding",
            "queryVector": query_embedding,
            "numCandidates": top_k * 10,
            "limit": top_k * 4,
        }
    }

    # Add filter if user_email or conversation_id provided
    # Note: Atlas Vector Search filters use the 'filter' field in $vectorSearch
    filter_conditions = []
    if user_email:
        filter_conditions.append({"user_email": {"$eq": user_email}})
    if conversation_id:
        filter_conditions.append({"conversation_id": {"$eq": conversation_id}})
    if knowledge_space_id:
        filter_conditions.append({"knowledge_space_id": {"$eq": knowledge_space_id}})

    if filter_conditions:
        if len(filter_conditions) == 1:
            vector_search_stage["$vectorSearch"]["filter"] = filter_conditions[0]
        else:
            vector_search_stage["$vectorSearch"]["filter"] = {"$and": filter_conditions}

    pipeline = [
        vector_search_stage,
        {
            "$set": {
                "similarity": {"$meta": "vectorSearchScore"}
            }
        },
        {
            "$match": {
                "similarity": {"$gte": config.rag_similarity_threshold}
            }
        },
        {
            "$project": {
                "document_id": 1,
                "chunk_index": 1,
                "content": 1,
                "similarity": 1,
                "created_at": 1,
            }
        },
        {"$limit": top_k * 2}
    ]

    results = []
    async for doc in db.document_chunks.aggregate(pipeline):
        results.append({
            "document_id": str(doc["document_id"]),
            "chunk_index": doc["chunk_index"],
            "content": doc["content"],
            "similarity": doc["similarity"],
            "created_at": doc.get("created_at"),
        })

    return results


async def _text_search(
    user_email: Optional[str],
    query: str,
    top_k: int = 5,
    conversation_id: Optional[str] = None,
    knowledge_space_id: Optional[str] = None,
) -> List[dict]:
    """Full-text search on document chunks using MongoDB text index."""
    db = await get_db()

    # Build match conditions
    match_conditions = {"$text": {"$search": query}}
    if user_email:
        match_conditions["user_email"] = user_email
    if conversation_id:
        match_conditions["conversation_id"] = conversation_id
    if knowledge_space_id:
        match_conditions["knowledge_space_id"] = knowledge_space_id

    pipeline = [
        {"$match": match_conditions},
        {"$addFields": {"text_score": {"$meta": "textScore"}}},
        {"$sort": {"text_score": -1}},
        {"$limit": top_k * 2},
        {
            "$project": {
                "document_id": 1,
                "chunk_index": 1,
                "content": 1,
                "text_score": 1,
                "created_at": 1,
            }
        }
    ]

    results = []
    async for doc in db.document_chunks.aggregate(pipeline):
        results.append({
            "document_id": str(doc["document_id"]),
            "chunk_index": doc["chunk_index"],
            "content": doc["content"],
            "text_score": doc["text_score"],
            "similarity": doc["text_score"],  # Normalized later
            "created_at": doc.get("created_at"),
        })

    return results


async def _hybrid_search(
    user_email: Optional[str],
    query: str,
    query_embedding: List[float],
    top_k: int = 5,
    conversation_id: Optional[str] = None,
    knowledge_space_id: Optional[str] = None,
) -> List[dict]:
    """Combine vector search and text search results using RRF (Reciprocal Rank Fusion)."""
    import asyncio

    # Run both searches in parallel
    vector_results, text_results = await asyncio.gather(
        _vector_search_atlas(user_email, query_embedding, top_k, conversation_id, knowledge_space_id),
        _text_search(user_email, query, top_k, conversation_id, knowledge_space_id),
        return_exceptions=True
    )

    # Handle exceptions
    if isinstance(vector_results, Exception):
        logger.error(f"Vector search failed: {vector_results}")
        vector_results = []
    if isinstance(text_results, Exception):
        logger.error(f"Text search failed: {text_results}")
        text_results = []

    # RRF fusion: score = sum(1 / (k + rank)) for k=60
    RRF_K = 60
    scores = {}

    # Add vector scores
    for rank, result in enumerate(vector_results):
        key = (result["document_id"], result["chunk_index"])
        if key not in scores:
            scores[key] = {"result": result, "score": 0}
        scores[key]["score"] += config.hybrid_search_alpha * (1.0 / (RRF_K + rank + 1))

    # Add text scores
    for rank, result in enumerate(text_results):
        key = (result["document_id"], result["chunk_index"])
        if key not in scores:
            scores[key] = {"result": result, "score": 0}
        scores[key]["score"] += (1 - config.hybrid_search_alpha) * (1.0 / (RRF_K + rank + 1))

    # Sort by combined score and return top_k
    sorted_results = sorted(scores.values(), key=lambda x: x["score"], reverse=True)

    final_results = []
    for item in sorted_results[:top_k]:
        result = item["result"]
        result["similarity"] = item["score"]  # Use fused score as similarity
        final_results.append(result)

    return final_results


async def _in_memory_search(
    user_email: Optional[str],
    query_embedding: List[float],
    top_k: int = 5,
    threshold: float = 0.7,
    conversation_id: Optional[str] = None,
    knowledge_space_id: Optional[str] = None,
) -> List[dict]:
    """Fallback in-memory cosine similarity search (original implementation, enhanced)."""
    import time
    start_time = time.time()

    db = await get_db()
    if not query_embedding:
        logger.info("RAG search: Empty query embedding provided.")
        return []

    query_vec = np.array(query_embedding)

    # Build filter for chunks directly (consistent with Atlas vector search)
    chunk_filter = {"embedding": {"$ne": None}}
    if user_email:
        chunk_filter["user_email"] = user_email
    if conversation_id:
        chunk_filter["conversation_id"] = conversation_id
    if knowledge_space_id:
        chunk_filter["knowledge_space_id"] = knowledge_space_id

    chunks = await db.document_chunks.find(chunk_filter).to_list(1000)
    if not chunks:
        logger.info(f"RAG search: No chunks found for filter: {chunk_filter}.")
        return []

    if not chunks:
        logger.info(f"RAG search: No chunks with embeddings found for user {user_email}.")
        return []

    # Compute cosine similarity between query and chunk embeddings + recency boost
    RECENT_DAYS = 7.0
    MAX_BOOST = 0.10

    candidates = []
    now = datetime.now(timezone.utc)
    for chunk in chunks:
        chunk_vec = np.array(chunk["embedding"], dtype=float)
        if chunk_vec.shape != query_vec.shape:
            continue
        base_sim = float(np.dot(chunk_vec, query_vec) / (np.linalg.norm(chunk_vec) * np.linalg.norm(query_vec)))
        if base_sim < threshold:
            continue

        # Recency boost if created_at exists
        boost = 1.0
        created_at = chunk.get("created_at")
        try:
            if created_at:
                age_days = max((now - created_at).total_seconds() / 86400.0, 0.0)
                recency_factor = max(0.0, 1.0 - min(age_days / RECENT_DAYS, 1.0))
                boost = 1.0 + MAX_BOOST * recency_factor
        except Exception as e:
            logger.warning(f"Recency boost calculation failed: {e}")

        similarity = base_sim * boost
        candidates.append({
            "document_id": str(chunk["document_id"]),
            "chunk_index": chunk["chunk_index"],
            "content": chunk["content"],
            "similarity": similarity,
            "_embedding": chunk_vec,
        })

    if not candidates:
        logger.info("RAG search: No candidates above threshold after similarity + recency boost.")
        return []

    # Maximal Marginal Relevance (MMR) re-ranking for diversity
    mmr_lambda = config.rag_mmr_lambda
    pool_size = min(len(candidates), max(top_k * 4, top_k))
    pool = sorted(candidates, key=lambda x: x["similarity"], reverse=True)[:pool_size]

    selected = []
    selected_embs = []

    seed = pool.pop(0)
    selected.append(seed)
    selected_embs.append(seed["_embedding"])

    def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
        denom = (np.linalg.norm(a) * np.linalg.norm(b))
        if denom == 0:
            return 0.0
        return float(np.dot(a, b) / denom)

    while pool and len(selected) < top_k:
        mmr_scores = []
        for cand in pool:
            if selected_embs:
                max_sim_selected = max(cosine_sim(cand["_embedding"], emb) for emb in selected_embs)
            else:
                max_sim_selected = 0.0
            score = mmr_lambda * cand["similarity"] - (1.0 - mmr_lambda) * max_sim_selected
            mmr_scores.append(score)

        best_idx = int(np.argmax(mmr_scores))
        best = pool.pop(best_idx)
        selected.append(best)
        selected_embs.append(best["_embedding"])

    # Strip internal fields and finalize
    final_results = [{
        "document_id": r["document_id"],
        "chunk_index": r["chunk_index"],
        "content": r["content"],
        "similarity": r["similarity"],
    } for r in selected]

    duration = time.time() - start_time
    similarities = [r["similarity"] for r in final_results]
    avg_similarity = sum(similarities) / len(similarities) if similarities else 0
    logger.info(f"In-memory RAG search completed in {duration:.2f}s for user {user_email}. Found {len(final_results)} chunks, avg similarity: {avg_similarity:.2f}")

    return final_results


async def search_chunks(
    user_email: Optional[str],
    query_embedding: List[float],
    top_k: int = None,
    threshold: float = None,
    conversation_id: Optional[str] = None,
    knowledge_space_id: Optional[str] = None,
    query_text: Optional[str] = None,
) -> List[dict]:
    """Search for relevant document chunks using the best available search strategy.

    Priority:
    1. Hybrid search (vector + text) if enabled and Atlas Vector Search is available
    2. Atlas Vector Search if enabled
    3. In-memory cosine similarity (fallback)
    """
    import time
    start_time = time.time()

    # Use config defaults if not specified
    if top_k is None:
        top_k = config.rag_top_k
    if threshold is None:
        threshold = config.rag_similarity_threshold

    try:
        results = []

        if config.vector_search_enabled and config.hybrid_search_enabled and query_text:
            # Hybrid search: vector + text
            logger.info(f"Using hybrid search for user {user_email}")
            results = await _hybrid_search(
                user_email, query_text, query_embedding, top_k, conversation_id, knowledge_space_id
            )
        elif config.vector_search_enabled:
            # Pure vector search via Atlas
            logger.info(f"Using Atlas vector search for user {user_email}")
            results = await _vector_search_atlas(
                user_email, query_embedding, top_k, conversation_id, knowledge_space_id
            )
            # Apply threshold filter
            results = [r for r in results if r["similarity"] >= threshold]
        else:
            # Fallback to in-memory search
            logger.info(f"Using in-memory search for user {user_email}")
            results = await _in_memory_search(
                user_email, query_embedding, top_k, threshold, conversation_id, knowledge_space_id
            )

        duration = time.time() - start_time
        logger.info(f"RAG search completed in {duration:.2f}s. Found {len(results)} chunks.")
        return results

    except Exception as e:
        logger.error(f"RAG search failed: {str(e)}. Falling back to in-memory search.")
        # Always fall back to in-memory on any error
        return await _in_memory_search(
            user_email, query_embedding, top_k, threshold, conversation_id, knowledge_space_id
        )
