import axios from 'axios';
import { streamResponse } from './streaming';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4100';

const apiClient = axios.create({
  baseURL: BACKEND_URL,
});

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

export const login = (email, password) => {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);
  return apiClient.post('/api/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
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