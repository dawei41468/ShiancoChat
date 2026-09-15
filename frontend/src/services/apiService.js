import axios from 'axios';
import { streamResponse } from './streaming';
import { jwtDecode } from 'jwt-decode';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4100';
const REFRESH_THRESHOLD_MINUTES = 2; // Refresh 2 minutes before expiration

// JS-readable session hint. The refresh cookie is HttpOnly (invisible to JS),
// so this flag records that this browser recently held a session. It lets the
// 401 interceptor distinguish a returning user (worth a refresh attempt) from
// an anonymous visitor (skip the pointless refresh call).
const SESSION_HINT_KEY = 'shianco_has_session';

const apiClient = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true,
});

// Add request interceptor to attach AbortControllers
apiClient.interceptors.request.use((config) => {
  // Only auto-attach if caller didn't provide their own signal
  if (!config.signal) {
    const controller = new AbortController();
    config.signal = controller.signal;
    config._autoController = controller;
    activeControllers.add(controller);
    // Clean up when request finishes
    const cleanup = () => activeControllers.delete(controller);
    config._cleanup = cleanup;
  }
  return config;
});

let refreshTimer = null;
let isRefreshing = false;
let refreshPromise = null;

// Track active AbortControllers for request cancellation on logout
const activeControllers = new Set();

const clearRefreshTimer = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
};

const scheduleTokenRefresh = (token) => {
  clearRefreshTimer();

  try {
    const decoded = jwtDecode(token);
    const expiresAt = decoded.exp * 1000; // Convert to ms
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const refreshThreshold = REFRESH_THRESHOLD_MINUTES * 60 * 1000;

    if (timeUntilExpiry > refreshThreshold) {
      refreshTimer = setTimeout(() => {
        refreshAccessToken();
      }, timeUntilExpiry - refreshThreshold);
    }
  } catch (error) {
    console.error('Failed to schedule token refresh:', error);
  }
};

export const refreshAccessToken = async () => {
  // Prevent concurrent refresh requests
  if (isRefreshing) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      // Refresh token is sent automatically via HttpOnly cookie
      const response = await apiClient.post('/api/auth/refresh', {});
      const { access_token } = response.data;

      setAuthHeader(access_token);
      scheduleTokenRefresh(access_token);
      return access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      clearRefreshTimer();
      setAuthHeader(null);
      window.dispatchEvent(new Event('auth:session-expired'));
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// Proactive token refresh is scheduled after login/refresh responses

// Keep Axios header and refresh timer in sync when the streaming layer refreshes tokens
window.addEventListener('auth:token-refreshed', (event) => {
  const { access_token } = event.detail || {};
  if (access_token) {
    setAuthHeader(access_token);
    scheduleTokenRefresh(access_token);
  }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableError = (error) => {
  if (!error.response) return true; // network/timeout errors
  const status = error.response.status;
  return status >= 500 || status === 429; // server errors or rate limited
};

// Add response interceptor for token refresh and transient error retry
apiClient.interceptors.response.use(
  response => {
    // Clean up auto-attached controller
    const config = response.config;
    if (config?._cleanup) config._cleanup();
    return response;
  },
  async error => {
    // Clean up auto-attached controller on error too
    const config = error.config;
    if (config?._cleanup) config._cleanup();
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    // Retry transient errors with exponential backoff
    const retryCount = originalRequest._retryCount || 0;
    const maxRetries = 3;
    if (isRetryableError(error) && retryCount < maxRetries && !originalRequest.url.includes('/auth/refresh')) {
      originalRequest._retryCount = retryCount + 1;
      const delay = Math.min(1000 * (2 ** retryCount), 8000);
      await sleep(delay);
      return apiClient(originalRequest);
    }

    // If 401 and not a refresh request, attempt refresh only when this
    // client plausibly holds a session: an in-memory Authorization header
    // (set by login/refresh) OR the session hint flag. The hint covers page
    // reloads where the access cookie expired but the 7-day HttpOnly refresh
    // cookie is still valid — without it those users would be bounced to
    // login instead of being silently re-authenticated. Anonymous visitors
    // (no header, no hint) skip the refresh round-trip entirely.
    const hasAuthHeader = Boolean(apiClient.defaults.headers.common['Authorization']);
    const hasSessionHint = localStorage.getItem(SESSION_HINT_KEY) === '1';
    if (error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url.includes('/auth/refresh') &&
        (hasAuthHeader || hasSessionHint)) {
      originalRequest._retry = true;

      try {
        const access_token = await refreshAccessToken();
        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed — auth state already cleared by refreshAccessToken
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export const setAuthHeader = (token) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem(SESSION_HINT_KEY, '1');
    scheduleTokenRefresh(token);
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    localStorage.removeItem(SESSION_HINT_KEY);
    clearRefreshTimer();
  }
};

export const deleteDocument = (documentId) => {
  return apiClient.delete(`/api/documents/${documentId}`);
};

export const fetchDocument = (documentId) => {
  return apiClient.get(`/api/documents/${documentId}`);
};

export const cleanupDocuments = () => {
  return apiClient.post('/api/documents/cleanup');
};

export const fetchKnowledgeSpaces = () => {
  return apiClient.get('/api/documents/spaces');
};

export const createKnowledgeSpace = (spaceData) => {
  return apiClient.post('/api/documents/spaces', spaceData);
};

export const fetchKnowledgeSpace = (spaceId) => {
  return apiClient.get(`/api/documents/spaces/${spaceId}`);
};

export const updateKnowledgeSpace = (spaceId, spaceData) => {
  return apiClient.patch(`/api/documents/spaces/${spaceId}`, spaceData);
};

export const deleteKnowledgeSpace = (spaceId) => {
  return apiClient.delete(`/api/documents/spaces/${spaceId}`);
};

export const fetchConversations = () => {
  return apiClient.get('/api/chat/conversations');
};

export const fetchMessagesForConversation = (conversationId) => {
  return apiClient.get(`/api/chat/conversations/${conversationId}/messages`);
};

export const fetchArtifactsForConversation = (conversationId) => {
  return apiClient.get(`/api/chat/conversations/${conversationId}/artifacts`);
};

export const createNewChat = (title) => {
  return apiClient.post('/api/chat/new', { title });
};

export const renameConversation = (conversationId, newTitle) => {
  return apiClient.put(`/api/chat/conversations/${conversationId}`, { new_title: newTitle });
};

export const deleteConversation = (conversationId) => {
  return apiClient.delete(`/api/chat/conversations/${conversationId}`);
};
export const fetchAvailableModels = () => {
  return apiClient.get('/api/llm/models');
};

export const fetchLLMConfig = () => {
  return apiClient.get('/api/openai/config');
};

/**
 * Initiates a streaming chat request to the backend.
 * Uses the fetch API for SSE-style streaming with abort signal support.
 * @param {Object} payload - Chat payload containing conversation_id, text, model, knowledge_space_id
 * @param {{ signal: AbortSignal, webSearchEnabled: boolean, ragEnabled: boolean }} options
 * @returns {AsyncGenerator} Yields parsed stream events (tags, deltas, status)
 */
export const streamChatResponse = (payload, { signal, webSearchEnabled, ragEnabled }) => {
    const url = `${BACKEND_URL}/api/openai/chat`;

    // Structure payload according to StreamRequestPayload model
    // Token is sent via Authorization header, not in body
    const requestPayload = {
        conversation_id: payload.conversation_id,
        text: payload.text,
        model: payload.model,
        knowledge_space_id: payload.knowledge_space_id,
        assistant_id: payload.assistant_id || null,
        web_search_enabled: webSearchEnabled,
        rag_enabled: ragEnabled,
    };

    // Pass the properly structured payload and signal to the streaming service
    return streamResponse(url, { ...requestPayload, signal });
};

export const saveMessage = (message) => {
  return apiClient.post('/api/chat/messages', message);
};

export const createArtifact = (artifact) => {
  return apiClient.post('/api/chat/artifacts', artifact);
};

export const updateArtifact = (artifactId, artifact) => {
  return apiClient.patch(`/api/chat/artifacts/${artifactId}`, artifact);
};

export const deleteArtifact = (artifactId) => {
  return apiClient.delete(`/api/chat/artifacts/${artifactId}`);
};

export const fetchTools = () => {
  return apiClient.get('/api/tools');
};

export const updateTool = (toolId, tool) => {
  return apiClient.patch(`/api/tools/${toolId}`, tool);
};

export const fetchToolAuditEvents = () => {
  return apiClient.get('/api/tools/audit');
};

export const fetchAssistants = () => {
  return apiClient.get('/api/assistants');
};

export const createAssistant = (assistant) => {
  return apiClient.post('/api/assistants', assistant);
};

export const updateAssistant = (assistantId, assistant) => {
  return apiClient.patch(`/api/assistants/${assistantId}`, assistant);
};

export const deleteAssistant = (assistantId) => {
  return apiClient.delete(`/api/assistants/${assistantId}`);
};

export const generateConversationTitle = (conversationId, model) => {
  return apiClient.post(`/api/chat/conversations/${conversationId}/generate-title`, { model });
};

/**
 * Authenticates a user and stores the access token in memory.
 * Backend sets HttpOnly refresh and access token cookies automatically.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export const login = async (email, password) => {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);
  const response = await apiClient.post('/api/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  
  // Cookies are set by the backend (HttpOnly, Secure, SameSite=Strict)
  const { access_token } = response.data;
  setAuthHeader(access_token);
  scheduleTokenRefresh(access_token);
  
  return response;
};

export const register = (userData) => {
  return apiClient.post('/api/auth/register', userData);
};

export const getCurrentUser = () => {
  return apiClient.get('/api/auth/users/me');
};

export const updateUser = (userData) => {
  return apiClient.patch('/api/auth/users/me', userData);
};

/**
 * Logs out the current user, aborts in-flight requests,
 * and clears the access token header.
 */
export const logout = async () => {
  // Cancel all in-flight requests before clearing auth
  activeControllers.forEach((controller) => {
    try { controller.abort(); } catch (e) { /* ignore */ }
  });
  activeControllers.clear();

  try {
    await apiClient.post('/api/auth/logout');
  } catch (error) {
    // Ignore errors — backend cookies are cleared regardless
  } finally {
    setAuthHeader(null);
    clearRefreshTimer();
  }
};

export const deleteAccount = () => {
  return apiClient.delete('/api/auth/users/me');
};

export const fetchUsers = () => {
  return apiClient.get('/api/users');
};

export const updateUserRole = (userId, newRole) => {
  return apiClient.patch(`/api/users/${userId}/role`, { role: newRole });
};

export const deleteUser = (userId) => {
  return apiClient.delete(`/api/users/${userId}`);
};

export const saveDocument = (documentData) => {
  return apiClient.post('/api/documents', documentData);
};

export const uploadDocument = async (formData) => {
  return apiClient.post('/api/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};
