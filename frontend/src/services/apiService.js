import axios from 'axios';
import { streamResponse } from './streaming';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4100';

const apiClient = axios.create({
  baseURL: BACKEND_URL,
});

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
        if (!refreshToken) throw new Error('No refresh token');
        
        const refreshResponse = await apiClient.post('/api/auth/refresh', { refresh_token: refreshToken });
        const { access_token } = refreshResponse.data;
        
        localStorage.setItem('access_token', access_token);
        setAuthHeader(access_token);
        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Clear tokens if refresh fails
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setAuthHeader(null);
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export const setAuthHeader = (token) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
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

export const streamChatResponse = (payload, { signal, webSearchEnabled }) => {
    const modelType = payload.model.startsWith('ollama/') ? 'ollama' : 'openai';
    const url = `${BACKEND_URL}/api/${modelType}/chat`;
    
    // Add web_search_enabled directly to the payload
    payload.web_search_enabled = webSearchEnabled;

    // Pass the modified payload and signal to the streaming service
    return streamResponse(url, { ...payload, signal });
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