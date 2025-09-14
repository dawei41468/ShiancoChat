import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/services/apiService';
import { keys } from './queryKeys';

// Conversations
export function useConversations(options = {}) {
  return useQuery({
    queryKey: keys.chat.conversations,
    queryFn: async () => {
      const res = await api.fetchConversations();
      return res.data;
    },
    staleTime: 1000 * 30,
    ...options,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title = 'New Chat') => {
      const res = await api.createNewChat(title);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.chat.conversations });
    },
  });
}

export function useRenameConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, newTitle }) => {
      await api.renameConversation(conversationId, newTitle);
      return { conversationId, newTitle };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.chat.conversations });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId) => {
      await api.deleteConversation(conversationId);
      return conversationId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.chat.conversations });
    },
  });
}

// Messages
export function useMessages(conversationId, options = {}) {
  return useQuery({
    queryKey: keys.chat.messages(conversationId),
    queryFn: async () => {
      if (!conversationId) return [];
      const res = await api.fetchMessagesForConversation(conversationId);
      return res.data;
    },
    enabled: Boolean(conversationId),
    refetchOnWindowFocus: false,
    ...options,
  });
}

export function useSaveMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (message) => {
      const res = await api.saveMessage(message);
      return res.data;
    },
    onSuccess: (saved) => {
      if (saved?.conversation_id) {
        qc.invalidateQueries({ queryKey: keys.chat.messages(saved.conversation_id) });
        qc.invalidateQueries({ queryKey: keys.chat.conversations });
      }
    },
  });
}

// Models
export function useAvailableModels(options = {}) {
  return useQuery({
    queryKey: keys.chat.models,
    queryFn: async () => {
      const res = await api.fetchAvailableModels();
      return res.data.models;
    },
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}
