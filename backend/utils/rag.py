import numpy as np
from typing import List, Optional
from sentence_transformers import SentenceTransformer
from backend.database import get_db
from datetime import datetime

# Initialize embedding model (same as used in documents.py)
import os
model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'all-MiniLM-L6-v2')
embedding_model = SentenceTransformer(model_path)

import logging
logger = logging.getLogger(__name__)

async def embed_query(query: str) -> List[float]:
    """Embed a query string into a vector using the same model as document chunks."""
    try:
        # With sentence-transformers v3+, encode returns a tensor. Convert to numpy then list.
        embedding_tensor = embedding_model.encode(query, convert_to_tensor=True)
        # The result is a 2D array, so we take the first element for a single query.
        embedding = embedding_tensor.cpu().numpy()[0]
        return embedding
    except Exception as e:
        logger.error(f"Error embedding query: {str(e)}")
        return []

async def search_chunks(user_email: Optional[str], query_embedding: List[float], top_k: int = 5, threshold: float = 0.7, conversation_id: Optional[str] = None) -> List[dict]:
    """Search for relevant document chunks based on vector similarity, filtered by user and optionally conversation."""
    import time
    start_time = time.time()
    try:
        db = await get_db()
        if not query_embedding:
            logger.info("RAG search: Empty query embedding provided.")
            return []

        # Convert list to numpy array for cosine similarity computation
        query_vec = np.array(query_embedding)
        
        # Build filter for user-owned documents and/or conversation
        filter_query = {}
        if user_email:
            filter_query["user_email"] = user_email
        if conversation_id:
            filter_query["conversation_id"] = conversation_id
        
        # Fetch documents matching the user/conversation filter
        docs = await db.documents.find(filter_query).to_list(1000)  # Arbitrary high limit
        if not docs:
            logger.info(f"RAG search: No documents found for filter: {filter_query}.")
            return []
        
        doc_ids = [doc["_id"] for doc in docs]
        
        # Fetch chunks for these documents with embeddings
        chunks = await db.document_chunks.find({
            "document_id": {"$in": doc_ids},
            "embedding": {"$ne": None}
        }).to_list(1000)
        
        if not chunks:
            logger.info(f"RAG search: No chunks with embeddings found for user {user_email}.")
            return []
        
        # Compute cosine similarity between query and chunk embeddings + recency boost
        # Recency boost: up to +10% for content created within the last 7 days
        RECENT_DAYS = 7.0
        MAX_BOOST = 0.10

        candidates = []  # keep embedding for MMR
        now = datetime.utcnow()
        for chunk in chunks:
            chunk_vec = np.array(chunk["embedding"], dtype=float)
            if chunk_vec.shape != np.array(query_vec).shape:
                continue
            base_sim = float(np.dot(chunk_vec, query_vec) / (np.linalg.norm(chunk_vec) * np.linalg.norm(query_vec)))
            if base_sim < threshold:
                continue

            # Recency boost if created_at exists
            boost = 1.0
            created_at = chunk.get("created_at")
            try:
                if created_at:
                    # created_at may arrive as datetime already from Mongo
                    age_days = max((now - created_at).total_seconds() / 86400.0, 0.0)
                    recency_factor = max(0.0, 1.0 - min(age_days / RECENT_DAYS, 1.0))  # 1.0 -> 0.0 over RECENT_DAYS
                    boost = 1.0 + MAX_BOOST * recency_factor
            except Exception:
                pass

            similarity = base_sim * boost
            candidates.append({
                "document_id": chunk["document_id"],
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "similarity": similarity,
                "_embedding": chunk_vec,  # internal for MMR
            })

        if not candidates:
            logger.info("RAG search: No candidates above threshold after similarity + recency boost.")
            return []

        # Maximal Marginal Relevance (MMR) re-ranking for diversity
        # Select top_k items that maximize: lambda * sim(query, doc) - (1 - lambda) * max_sim(doc, selected)
        mmr_lambda = 0.7  # favor relevance but keep some diversity
        # Pre-sort to take a manageable pool (4x top_k) for MMR
        pool_size = min(len(candidates), max(top_k * 4, top_k))
        pool = sorted(candidates, key=lambda x: x["similarity"], reverse=True)[:pool_size]

        selected = []
        selected_embs = []

        # Seed with the most similar
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
                # max similarity to any already selected item
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
        logger.info(f"RAG search completed in {duration:.2f}s for user {user_email}. Found {len(final_results)} chunks, avg similarity: {avg_similarity:.2f}")
        
        return final_results
    
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"Error searching chunks after {duration:.2f}s: {str(e)}")
        return []