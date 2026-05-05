import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import { useToast } from '@/components/ToastNotification';
import ConfirmDialog from '@/components/ConfirmDialog';
import { MODEL_POLICIES, chooseModelForPolicy, normalizePolicy } from './utils/modelPolicy';
import { DEFAULT_WORKFLOW_ID, WORKFLOWS, getWorkflowById } from './utils/workflows';
import { useConversations } from './hooks/useConversations';
import { useMessages } from './hooks/useMessages';
import { useKnowledgeSpaces } from './hooks/useKnowledgeSpaces';
import * as apiService from '@/services/apiService';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [isChatInputFullScreen, setIsChatInputFullScreen] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('selected_model'));
  const [modelPolicy, setModelPolicy] = useState(() => normalizePolicy(localStorage.getItem('model_policy')));
  const [manualModelOverride, setManualModelOverride] = useState(() => localStorage.getItem('manual_model_override') || '');
  const [documents, setDocuments] = useState([]);
  const [currentDocument, setCurrentDocument] = useState(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(() => localStorage.getItem('selected_workflow_id') || DEFAULT_WORKFLOW_ID);
  const [artifacts, setArtifacts] = useState([]);
  const selectedWorkflow = getWorkflowById(selectedWorkflowId);

  const conversationsHook = useConversations({ user, showToast });
  const knowledgeHook = useKnowledgeSpaces({ user, showToast });
  const messagesHook = useMessages({
    user,
    currentConversationId: conversationsHook.currentConversationId,
    conversations: conversationsHook.conversations,
    selectedModel,
    selectedKnowledgeSpaceId: knowledgeHook.selectedKnowledgeSpaceId,
    showToast,
    fetchConversations: conversationsHook.fetchConversations,
  });

  // Use refs to avoid unstable object references in effect deps
  const messagesRef = React.useRef(messagesHook);
  messagesRef.current = messagesHook;
  const conversationsRef = React.useRef(conversationsHook);
  conversationsRef.current = conversationsHook;

  // Auto-scroll when new messages are appended
  useEffect(() => {
    if (messagesRef.current.messages.length > messagesRef.current.lastMessageCountRef.current) {
      messagesRef.current.scrollToBottom();
    }
    messagesRef.current.lastMessageCountRef.current = messagesRef.current.messages.length;
  }, [messagesHook.messages]);

  // Fetch messages when conversation changes
  useEffect(() => {
    messagesRef.current.fetchMessages(conversationsRef.current.currentConversationId);
  }, [conversationsHook.currentConversationId]);

  // Fetch artifacts when conversation changes
  useEffect(() => {
    fetchArtifacts(conversationsRef.current.currentConversationId);
  }, [conversationsHook.currentConversationId]);

  // Initialize app state on mount / user change
  useEffect(() => {
    const initialize = async () => {
      if (user) {
        await fetchAvailableModels();
        await knowledgeHook.fetchKnowledgeSpaces();
        const convos = await conversationsHook.fetchConversations();
        if (convos.length > 0) {
          conversationsHook.setCurrentConversationId(currentId => currentId || convos[0].id);
        } else {
          await conversationsHook.handleNewChat();
        }
      } else {
        conversationsHook.setConversations(prev => (prev.length === 0 ? prev : []));
        messagesHook.setMessages(prev => (prev.length === 0 ? prev : []));
        conversationsHook.setCurrentConversationId(prev => (prev === null ? prev : null));
        setArtifacts(prev => (prev.length === 0 ? prev : []));
        knowledgeHook.setKnowledgeSpaces(prev => (prev.length === 0 ? prev : []));
        knowledgeHook.setSelectedKnowledgeSpaceId(prev => (prev === null ? prev : null));
        knowledgeHook.setKnowledgeSpaceDocuments(prev => (prev.length === 0 ? prev : []));
        localStorage.removeItem('selected_knowledge_space_id');
      }
    };
    initialize();
  }, [user]);


  // Keep selected model in sync with policy
  useEffect(() => {
    if (availableModels.length === 0) return;
    setSelectedModel(chooseModelForPolicy(availableModels, modelPolicy, manualModelOverride));
  }, [availableModels, manualModelOverride, modelPolicy]);

  const fetchAvailableModels = useCallback(async () => {
    try {
      const response = await apiService.fetchAvailableModels();
      const models = response.data.models || [];
      setAvailableModels(models);
      if (models.length > 0) {
        setSelectedModel(chooseModelForPolicy(models, modelPolicy, manualModelOverride));
      }
    } catch (error) {
      console.error('Error fetching available models:', error);
    }
  }, [manualModelOverride, modelPolicy]);

  const fetchArtifacts = useCallback(async (conversationId) => {
    if (!user || !conversationId) {
      setArtifacts([]);
      return [];
    }
    try {
      const response = await apiService.fetchArtifactsForConversation(conversationId);
      const nextArtifacts = response.data || [];
      setArtifacts(nextArtifacts);
      return nextArtifacts;
    } catch (error) {
      console.error('Error fetching artifacts:', error);
      setArtifacts([]);
      return [];
    }
  }, [user]);

  const handleModelChange = (model) => {
    setSelectedModel(model);
    localStorage.setItem('selected_model', model);
  };

  const handleModelPolicyChange = (policy) => {
    const nextPolicy = normalizePolicy(policy);
    setModelPolicy(nextPolicy);
    localStorage.setItem('model_policy', nextPolicy);
  };

  const handleManualModelOverrideChange = (model) => {
    setManualModelOverride(model);
    if (model) {
      localStorage.setItem('manual_model_override', model);
    } else {
      localStorage.removeItem('manual_model_override');
    }
  };

  const handleWorkflowChange = (workflowId) => {
    const workflow = getWorkflowById(workflowId);
    setSelectedWorkflowId(workflow.id);
    localStorage.setItem('selected_workflow_id', workflow.id);
  };

  const createArtifact = async (artifactData) => {
    const response = await apiService.createArtifact(artifactData);
    const artifact = response.data;
    setArtifacts(prev => {
      const existingIndex = prev.findIndex(item => item.id === artifact.id);
      if (existingIndex >= 0) {
        return prev.map(item => (item.id === artifact.id ? artifact : item));
      }
      return [artifact, ...prev];
    });
    return artifact;
  };

  const updateArtifact = async (artifactId, artifactData) => {
    const response = await apiService.updateArtifact(artifactId, artifactData);
    const artifact = response.data;
    setArtifacts(prev => prev.map(item => (item.id === artifact.id ? artifact : item)));
    showToast('Saved artifact', 'success');
    return artifact;
  };

  const deleteArtifact = async (artifactId) => {
    await apiService.deleteArtifact(artifactId);
    setArtifacts(prev => prev.filter(item => item.id !== artifactId));
    showToast('Deleted artifact', 'success');
  };

  const uploadDocument = async (file, conversationId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }
    if (knowledgeHook.selectedKnowledgeSpaceId) {
      formData.append('knowledge_space_id', knowledgeHook.selectedKnowledgeSpaceId);
    }
    try {
      const response = await apiService.uploadDocument(formData);
      setDocuments(prev => [...prev, response.data]);
      await knowledgeHook.fetchSelectedKnowledgeSpace(response.data.knowledge_space_id || knowledgeHook.selectedKnowledgeSpaceId);
      return response.data;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  };

  const deleteDocument = async (documentId) => {
    try {
      await apiService.deleteDocument(documentId);
      setDocuments(prev => prev.filter(doc => doc.document_id !== documentId));
      await knowledgeHook.fetchSelectedKnowledgeSpace();
      showToast('Deleted knowledge source', 'success');
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  };

  const fetchDocument = async (documentId) => {
    try {
      const response = await apiService.fetchDocument(documentId);
      return response.data;
    } catch (error) {
      console.error('Error fetching document:', error);
      throw error;
    }
  };

  const chatContextValue = {
    ...messagesHook,
    ...conversationsHook,
    ...knowledgeHook,
    isChatInputFullScreen,
    setIsChatInputFullScreen,
    availableModels,
    selectedModel,
    handleModelChange,
    modelPolicy,
    modelPolicies: MODEL_POLICIES,
    handleModelPolicyChange,
    manualModelOverride,
    handleManualModelOverrideChange,
    workflows: WORKFLOWS,
    selectedWorkflow,
    selectedWorkflowId,
    handleWorkflowChange,
    artifacts,
    fetchArtifacts,
    createArtifact,
    updateArtifact,
    deleteArtifact,
    documents,
    currentDocument,
    setCurrentDocument,
    uploadDocument,
    deleteDocument,
    fetchDocument,
  };

  return (
    <ChatContext.Provider value={chatContextValue}>
      {children}
      <ConfirmDialog
        open={!!conversationsHook.deleteConfirmId}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onConfirm={conversationsHook.confirmDeleteConversation}
        onCancel={() => conversationsHook.setDeleteConfirmId(null)}
      />
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
