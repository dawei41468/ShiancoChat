import axios from 'axios';
import { streamResponse } from './streaming';
import { jwtDecode } from 'jwt-decode';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4100';
const REFRESH_THRESHOLD_MINUTES = 2; // Refresh 2 minutes before expiration

const apiClient = axios.create({
  baseURL: BACKEND_URL,
});

let refreshTimer = null;

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

const refreshAccessToken = async () => {
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return;

    const response = await apiClient.post('/api/auth/refresh', { refresh_token: refreshToken });
    const { access_token } = response.data;
    
    localStorage.setItem('access_token', access_token);
    setAuthHeader(access_token);
    scheduleTokenRefresh(access_token);
  } catch (error) {
    console.error('Token refresh failed:', error);
    clearRefreshTimer();
  }
};

// Initialize auth token if exists
const token = localStorage.getItem('access_token');
if (token) {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  scheduleTokenRefresh(token);
}

// Add response interceptor for token refresh
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // If 401 and not a refresh request
    if (error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url.includes('/auth/refresh')) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          // No refresh token available - clear everything
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setAuthHeader(null);
          return Promise.reject(new Error('No refresh token available'));
        }
        
        const refreshResponse = await apiClient.post('/api/auth/refresh', { refresh_token: refreshToken });
        const { access_token } = refreshResponse.data;
        
        localStorage.setItem('access_token', access_token);
        setAuthHeader(access_token);
        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Clear tokens if refresh fails and prevent infinite loop
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setAuthHeader(null);
        
        // Only reject if this isn't already a refresh request
        if (!originalRequest.url.includes('/auth/refresh')) {
          return Promise.reject(refreshError);
        }
        // For refresh failures, return original error to prevent loop
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export const setAuthHeader = (token) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    scheduleTokenRefresh(token);
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
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

export const fetchConversations = () => {
  return apiClient.get('/api/chat/conversations');
};

export const fetchMessagesForConversation = (conversationId) => {
  return apiClient.get(`/api/chat/conversations/${conversationId}/messages`);
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

export const streamChatResponse = (payload, { signal, webSearchEnabled, ragEnabled }) => {
    const modelType = payload.model.startsWith('ollama/') ? 'ollama' : 'openai';
    const url = `${BACKEND_URL}/api/${modelType}/chat`;
    
    // Structure payload according to StreamRequestPayload model
    const requestPayload = {
        conversation_id: payload.conversation_id,
        text: payload.text,
        model: payload.model,
        web_search_enabled: webSearchEnabled,
        rag_enabled: ragEnabled,
        token: localStorage.getItem('access_token') // Add token to payload
    };

    // Pass the properly structured payload and signal to the streaming service
    return streamResponse(url, { ...requestPayload, signal });
};

export const saveMessage = (message) => {
  return apiClient.post('/api/chat/messages', message);
};

export const generateConversationTitle = (conversationId, model) => {
  return apiClient.post(`/api/chat/conversations/${conversationId}/generate-title`, { model });
};

export const login = async (email, password) => {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);
  const response = await apiClient.post('/api/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  
  // Store both tokens
  const { access_token, refresh_token } = response.data;
  localStorage.setItem('access_token', access_token);
  localStorage.setItem('refresh_token', refresh_token);
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

export const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  setAuthHeader(null);
  clearRefreshTimer();
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