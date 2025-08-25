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
        embedding = embedding_model.encode(query).tolist()
        return embedding
    except Exception as e:
        logger.error(f"Error embedding query: {str(e)}")
        return []

async def search_chunks(user_email: str, query_embedding: List[float], top_k: int = 5, threshold: float = 0.7, conversation_id: Optional[str] = None) -> List[dict]:
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
        
        # Build filter for user-owned documents
        filter_query = {"user_email": user_email}
        if conversation_id:
            filter_query["conversation_id"] = conversation_id
        
        # Fetch documents matching the user/conversation filter
        docs = await db.documents.find(filter_query).to_list(1000)  # Arbitrary high limit
        if not docs:
            logger.info(f"RAG search: No documents found for user {user_email}.")
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
        
        # Compute cosine similarity between query and chunk embeddings
        results = []
        for chunk in chunks:
            chunk_vec = np.array(chunk["embedding"])
            if len(chunk_vec) != len(query_vec):
                continue
            similarity = np.dot(chunk_vec, query_vec) / (np.linalg.norm(chunk_vec) * np.linalg.norm(query_vec))
            if similarity >= threshold:
                results.append({
                    "document_id": chunk["document_id"],
                    "chunk_index": chunk["chunk_index"],
                    "content": chunk["content"],
                    "similarity": similarity
                })
        
        # Sort by similarity and take top_k
        results.sort(key=lambda x: x["similarity"], reverse=True)
        final_results = results[:top_k]
        
        duration = time.time() - start_time
        similarities = [r["similarity"] for r in final_results]
        avg_similarity = sum(similarities) / len(similarities) if similarities else 0
        logger.info(f"RAG search completed in {duration:.2f}s for user {user_email}. Found {len(final_results)} chunks, avg similarity: {avg_similarity:.2f}")
        
        return final_results
    
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"Error searching chunks after {duration:.2f}s: {str(e)}")
        return []