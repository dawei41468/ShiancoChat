import { useState, useCallback, useRef, useEffect } from 'react';
import * as apiService from '@/services/apiService';

export function useConversations({ user, showToast }) {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [creatingNewChat, setCreatingNewChat] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return [];
    }
    try {
      const response = await apiService.fetchConversations();
      setConversations(response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      showToastRef.current('Failed to load conversations', 'error');
      setConversations([]);
      return [];
    }
  }, [user]);

  const handleNewChat = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiService.createNewChat('New Chat');
      const newConversation = response.data;
      await fetchConversations();
      setCurrentConversationId(newConversation.id);
    } catch (error) {
      console.error('Error creating new chat:', error);
      showToastRef.current('Failed to create new chat', 'error');
    }
  }, [fetchConversations, user]);

  const handleSelectConversation = (conversationId) => {
    setCurrentConversationId(conversationId);
  };

  const handleRenameConversation = async (conversationId) => {
    const newTitle = prompt('Enter new title for the conversation:');
    if (newTitle && newTitle.trim() !== '') {
      try {
        await apiService.renameConversation(conversationId, newTitle);
        fetchConversations();
      } catch (error) {
        console.error('Error renaming conversation:', error);
        showToastRef.current('Failed to rename conversation', 'error');
      }
    }
  };

  const handleDeleteConversation = (conversationId) => {
    setDeleteConfirmId(conversationId);
  };

  const confirmDeleteConversation = async () => {
    if (!deleteConfirmId) return;
    try {
      await apiService.deleteConversation(deleteConfirmId);
      const remainingConversations = await fetchConversations();

      if (currentConversationId === deleteConfirmId) {
        if (remainingConversations.length > 0) {
          setCurrentConversationId(remainingConversations[0].id);
        } else {
          await handleNewChat();
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      showToastRef.current('Failed to delete conversation', 'error');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  return {
    conversations,
    setConversations,
    currentConversationId,
    setCurrentConversationId,
    creatingNewChat,
    setCreatingNewChat,
    deleteConfirmId,
    setDeleteConfirmId,
    fetchConversations,
    handleNewChat,
    handleSelectConversation,
    handleRenameConversation,
    handleDeleteConversation,
    confirmDeleteConversation,
  };
}
