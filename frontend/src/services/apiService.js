import axios from 'axios';
import { streamResponse } from './streaming';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4100';

const apiClient = axios.create({
  baseURL: BACKEND_URL,
});

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

export const streamChatResponse = (payload, { signal }) => {
    const modelType = payload.model.startsWith('ollama/') ? 'ollama' : 'openai';
    const url = `${BACKEND_URL}/api/${modelType}/chat`;
    
    // Pass the full payload and signal to the streaming service
    return streamResponse(url, { ...payload, signal });
};

export const saveMessage = (message) => {
  return apiClient.post('/api/chat/messages', message);
};

export const generateConversationTitle = (conversationId, model) => {
  return apiClient.post(`/api/chat/conversations/${conversationId}/generate-title`, { model });
};