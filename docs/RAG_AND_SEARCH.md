# RAG & Web Search

This document covers the current architecture, best practices, and improvement roadmap for ShiancoChat's document retrieval and web search systems.

---

## 1. Current Architecture

### 1.1 RAG Stack

| Component | Implementation | Notes |
|-----------|---------------|-------|
| Vector Store | MongoDB `document_chunks` collection | Each chunk stores `content` + `embedding` array |
| Similarity | In-memory numpy cosine similarity | Loads all user chunks into memory; fine for small-medium corpora |
| Embeddings | sentence-transformers | `all-MiniLM-L6-v2` (384d) or `bge-m3` (1024d) |
| Chunking | Recursive character split | Configurable chunk size and overlap |
| Re-ranking | MMR (Maximal Marginal Relevance) | Balances relevance vs. diversity |

### 1.2 Web Search Stack

| Engine | Auth | Default | Use Case |
|--------|------|---------|----------|
| DuckDuckGo | None | ✅ | General queries, no rate limits |
| Brave | `BRAVE_API_KEY` | ❌ | Higher-quality results, faster |

Configure via:

```env
WEB_SEARCH_ENGINES=duckduckgo,brave
BRAVE_API_KEY=your_key_here
```

---

## 2. Best Practices

### 2.1 When to Enable Atlas Vector Search

For production workloads with large document corpora, enable MongoDB Atlas Vector Search:

```env
VECTOR_SEARCH_ENABLED=true
VECTOR_SEARCH_INDEX=vector_index
```

The application auto-detects Atlas support on startup and falls back to in-memory search if unavailable. Atlas provides:
- Sub-second ANN search over millions of chunks
- Native metadata filtering (`user_email`, `conversation_id`, `knowledge_space_id`)
- No additional infrastructure (same MongoDB connection)

### 2.2 Hybrid Search

Combine dense vector similarity with MongoDB text search:

```env
HYBRID_SEARCH_ENABLED=true
HYBRID_SEARCH_ALPHA=0.7
```

- `alpha = 0.7` means 70% weight on vector similarity, 30% on BM25 text score
- Requires a text index on `document_chunks.content` (auto-created on startup)
- Best for queries where exact keyword matching improves recall

### 2.3 Web Search

1. **Result Deduplication:** The backend deduplicates URLs across engines before ranking.
2. **Citation Formatting:** Search results are formatted with `title`, `url`, and `snippet` for LLM grounding.
3. **Timeout Handling:** Web search has a 10-second timeout; failures are logged but do not block the chat stream.
4. **Caching:** Consider adding Redis for search result caching if query volume grows.

### 2.4 Security & Privacy

- **User Isolation:** By default, RAG queries filter by `user_email` (and optionally `conversation_id` / `knowledge_space_id`).
- **Department Spaces:** When a `knowledge_space_id` is supplied, the chat endpoint verifies space access (owner, department member, or admin; denials return 404) and retrieval filters by `knowledge_space_id` only — the `user_email` chunk filter is dropped for department-scoped spaces so members share the same library, and the `conversation_id` filter is dropped for any explicit space selection.
- **PII:** Documents are chunked and embedded as-is; no automatic PII redaction is performed.
- **Access Logging:** Tool audit events track web search and file search usage per user.

### 2.5 Performance Targets

| Metric | In-Memory | Atlas Vector Search |
|--------|-----------|---------------------|
| Search Latency (P95) | < 200ms (< 1k chunks) | < 100ms |
| Scalability | Single-node memory bound | Millions of chunks |
| Index Build | N/A (no index) | ~minutes for 100k docs |

---

## 3. Improvement Roadmap

### 3.1 RAG Quality

#### Query Rewriting
Before embedding the user query, rewrite it for better retrieval:
- Expand acronyms
- Add synonyms
- Decompose multi-part questions into sub-queries

**Implementation:** Add a lightweight LLM call (or rule-based) in `backend/utils/rag.py` before `embed_query()`.

#### Re-ranking Model
Replace MMR with a cross-encoder re-ranker for better relevance:
- Use `sentence-transformers` cross-encoder (e.g., `cross-encoder/ms-marco-MiniLM-L-6-v2`)
- Run on the top-k candidates from initial retrieval
- Keeps the same MongoDB storage; only changes the ranking step

#### Metadata Enrichment
Store richer metadata per chunk to improve filtering:
- `document_type` (pdf, docx, txt)
- `heading_hierarchy` (H1, H2, H3 breadcrumbs)
- `page_number` / `sheet_name`
- Add these to the `$match` stage in Atlas Vector Search pipelines

### 3.2 Web Search Enhancements

#### Result Caching
Add a Redis or in-memory cache for identical queries:
- Cache key: `hash(query + max_results)`
- TTL: 1 hour for general queries, 24 hours for factual queries
- Invalidation: None (search results are ephemeral)

#### Parallel Engine Queries
Query all configured engines in parallel and merge results:
- Already partially implemented; can be extended with `asyncio.gather`
- Apply reciprocal rank fusion for merged ranking

#### Content Extraction
Fetch and summarize the top-N result pages instead of relying on snippets:
- Use `httpx` to fetch page content
- Truncate to ~500 chars per page
- Inject full content into LLM context for deeper grounding

### 3.3 Atlas Vector Search Production Setup

If using MongoDB Atlas in production, ensure the vector index is properly configured:

```json
{
  "name": "document_chunks_vector_index",
  "definition": {
    "mappings": {
      "dynamic": false,
      "fields": {
        "embedding": {
          "type": "knnVector",
          "dimensions": 384,
          "similarity": "cosine"
        }
      }
    }
  }
}
```

> **Note:** Use `dimensions: 1024` if using `bge-m3`.

Create the index via the Atlas UI or programmatically:

```python
from backend.database import get_db

db = await get_db()
await db.document_chunks.create_search_index({
    "name": "document_chunks_vector_index",
    "definition": { ... }
})
```

### 3.4 Observability

Add structured logging around RAG and search:
- `rag.search` — query, chunks_loaded, latency, top_k, threshold
- `web_search.query` — engine, query, result_count, latency
- `embedding.compute` — text_length, latency, model_name

These logs can be consumed by the existing tool audit system or a future metrics pipeline.

---

## 4. Decision Log

| Decision | Status | Rationale |
|----------|--------|-----------|
| MongoDB vs. Qdrant | **MongoDB** | Single database, no extra infra, Atlas Vector Search available |
| all-MiniLM-L6-v2 vs. bge-m3 | **Configurable** | Default MiniLM for speed; bge-m3 for multilingual quality |
| In-memory vs. Atlas | **Both** | In-memory for dev/self-hosted; Atlas for production scale |
| Hybrid search | **Optional** | Disabled by default; enable when text recall matters |
