# Troubleshooting Guide

Common issues and their solutions.

## Backend Issues

### MongoDB Connection Failed

**Symptom:** App crashes on startup with `MongoDB connection failed`.

**Solutions:**
1. Verify `MONGO_URL` and `DB_NAME` are set in `backend/.env`
2. Check MongoDB is running: `sudo systemctl status mongod`
3. Verify network connectivity: `mongosh "$MONGO_URL" --eval "db.adminCommand('ping')"`
4. If using MongoDB Atlas, whitelist your server's IP address
5. Check credentials are correct in the connection string

### LLM Endpoint Unreachable

**Symptom:** Chat returns "LLM service unavailable" or timeouts.

**Solutions:**
1. Verify `LLM_BASE_URL` points to a running OpenAI-compatible server (e.g., LM Studio, Ollama, vLLM)
2. Test the endpoint directly:
   ```bash
   curl $LLM_BASE_URL/v1/models
   ```
3. Check firewall rules — port 1234 (or your LLM port) must be accessible
4. Verify `LLM_BASE_URLS` failover list if using multiple endpoints

### Embedding Model Download Fails

**Symptom:** First document upload hangs or throws model loading errors.

**Solutions:**
1. The embedding model downloads on first use. Ensure the server has internet access
2. Pre-download the model:
   ```python
   from sentence_transformers import SentenceTransformer
   SentenceTransformer("all-MiniLM-L6-v2")
   ```
3. Set `embedding_model_path` in config to a local directory with the model files

### Import Errors (Module Not Found)

**Symptom:** `ModuleNotFoundError: No module named 'backend'`

**Solutions:**
1. Ensure you're running from the project root, not `backend/`
2. Set `PYTHONPATH`:
   ```bash
   export PYTHONPATH=$(pwd)
   uvicorn backend.server:app --host 0.0.0.0 --port 4100
   ```

### Rate Limiting (429 Errors)

**Symptom:** API returns `429 Too Many Requests`.

**Solutions:**
1. Check `slowapi` limits in the router decorators
2. For load-balanced setups, configure a shared Redis backend for `slowapi`
3. Adjust limits in `backend/rate_limiter.py` if needed

## Frontend Issues

### CORS Errors

**Symptom:** Browser console shows `Access-Control-Allow-Origin` errors.

**Solutions:**
1. Verify `REACT_APP_BACKEND_URL` matches the actual backend URL
2. Check `cors_origins` in backend config includes your frontend URL
3. Ensure the backend is sending CORS headers (check Network tab)

### White Screen After Login

**Symptom:** Blank page after successful login.

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify the backend `/api/auth/users/me` endpoint returns valid user data
3. Check if `token` state is being set in AuthContext
4. Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)

### Web Search Not Working

**Symptom:** Web search toggle has no effect; no search results appear.

**Solutions:**
1. Web search requires an HTTP proxy (for China/GFW compatibility). Set `HTTP_PROXY` or `HTTPS_PROXY` in `.env`
2. Without a proxy, the app silently skips web search
3. Check backend logs for `No HTTP(S)_PROXY detected; skipping external web search`
4. For DuckDuckGo, ensure the server can reach `duckduckgo.com`

### Build Fails

**Symptom:** `yarn build` exits with errors.

**Solutions:**
1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules yarn.lock
   yarn install
   ```
2. Check Node.js version: `node -v` (requires 20+)
3. Check for ESLint errors: `yarn lint` or fix with `yarn lint --fix`

## Auth Issues

### Login Loop (Redirected Back to Login)

**Symptom:** After entering credentials, the app redirects back to `/login`.

**Solutions:**
1. Check browser cookies are enabled (HttpOnly cookies required)
2. Verify the backend login endpoint returns 200 and sets cookies
3. Check Network tab for 401 on `/api/auth/users/me`
4. Ensure `withCredentials: true` is set in the frontend axios config
5. Check cookie `Secure` flag — if backend runs HTTP (not HTTPS), cookies won't be set in production mode browsers

### Token Refresh Fails

**Symptom:** User is logged out after 30 minutes.

**Solutions:**
1. Verify `/api/auth/refresh` endpoint is accessible
2. Check that the refresh token cookie is being sent with the request
3. Ensure `REFRESH_COOKIE_NAME` cookie hasn't expired
4. Check backend logs for `Invalid refresh token`

## Performance Issues

### Slow Chat Responses

**Symptom:** Long delay before AI response starts streaming.

**Solutions:**
1. Check LLM server load and queue depth
2. Enable RAG caching or reduce `rag_top_k`
3. If web search is enabled but slow, it blocks the stream. Consider disabling by default
4. Use a faster embedding model or GPU for embeddings

### High Memory Usage

**Symptom:** Backend process uses >4GB RAM.

**Solutions:**
1. The embedding model loads into memory on first use (~400MB)
2. Large uploads are limited to 10MB by the body size middleware
3. Set `DOCUMENT_TTL_HOURS` lower to clean up old documents faster
4. Use a dedicated vector database (Qdrant) instead of in-memory search for large datasets

## Getting Help

If an issue persists:

1. Check `backend/logs/` or stdout for error traces
2. Set `LOG_LEVEL=DEBUG` in `.env` for verbose output
3. Open an issue on GitHub with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Backend and frontend logs
   - Environment details (OS, Python/Node versions)
