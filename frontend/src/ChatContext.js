import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import * as apiService from '@/services/apiService';
import { AuthContext } from './AuthContext'; // Import AuthContext
import {
  useConversations,
  useMessages,
  useAvailableModels,
  useCreateConversation,
  useRenameConversation,
  useDeleteConversation,
  useSaveMessage,
} from '@/hooks/chatHooks';
import { useUploadDocument, useDeleteDocument, useSaveDocumentRecord } from '@/hooks/documentHooks';
import { useQueryClient } from '@tanstack/react-query';
import { keys } from '@/hooks/queryKeys';

const ChatContext = createContext();

// Helper function to process raw assistant messages into a displayable format
const _processAssistantMessage = (msg) => {
  let thinkingContent = '';
  let answerContent = '';

  if (msg.sender === 'assistant' && msg.text) {
    const thinkMatch = msg.text.match(/<think>((?:.|\n)*?)<\/think>/);
    const answerMatch = msg.text.match(/<answer>((?:.|\n)*?)<\/answer>/);

    thinkingContent = thinkMatch ? thinkMatch[1] : '';
    
    if (answerMatch) {
      answerContent = answerMatch[1];
    } else {
      // If no explicit answer tag, assume all non-thinking text is the answer
      answerContent = msg.text.replace(/<think>.*<\/think>/s, '').trim();
    }
  } else {
    answerContent = msg.text;
  }

  return {
    ...msg,
    timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    thinking: thinkingContent,
    answer: answerContent,
    isThinkingComplete: true,
    thinkingDuration: msg.thinking_duration || 0,
  };
};


export const ChatProvider = ({ children }) => {
  const { user } = useContext(AuthContext); // Get user from AuthContext
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [creatingNewChat, setCreatingNewChat] = useState(false);
  const [isChatInputFullScreen, setIsChatInputFullScreen] = useState(false);
  const chatEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [currentDocument, setCurrentDocument] = useState(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // React Query: conversations, messages, models
  const { data: rqConversations = [], refetch: refetchConversations } = useConversations({
    enabled: !!user,
  });
  const { data: rqMessages = [], refetch: refetchMessages } = useMessages(currentConversationId, {
    enabled: !!currentConversationId,
  });
  const { data: rqModels = [] } = useAvailableModels({
    enabled: !!user,
  });

  // Sync React Query data into local UI state (preserve existing API & streaming behavior)
  useEffect(() => {
    if (user) {
      setConversations(rqConversations);
    } else {
      setConversations([]);
    }
  }, [rqConversations, user]);

  useEffect(() => {
    if (!currentConversationId) {
      setMessages([]);
      return;
    }
    // Only sync fetched messages when not streaming
    if (!isTyping && abortControllerRef.current == null) {
      setMessages(rqMessages.map(msg =>
        msg.sender === 'assistant' ? _processAssistantMessage(msg) : {
          ...msg,
          timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ));
    }
  }, [rqMessages, currentConversationId, isTyping]);

  useEffect(() => {
    setAvailableModels(rqModels);
    if (!selectedModel && rqModels && rqModels.length > 0) {
      setSelectedModel(prev => prev || rqModels[0]);
    }
  }, [rqModels, selectedModel]);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return [];
    }
    const res = await refetchConversations();
    const data = res?.data ?? [];
    setConversations(data);
    return data;
  }, [user, refetchConversations]);

  // Preserve original fetchMessages API but delegate to React Query
  const fetchMessages = useCallback(async (conversationIdParam) => {
    const id = conversationIdParam ?? currentConversationId;
    if (!id) {
      setMessages([]);
      return [];
    }
    const res = await refetchMessages();
    const data = res?.data ?? [];
    const processed = data.map(msg => (
      msg.sender === 'assistant'
        ? _processAssistantMessage(msg)
        : { ...msg, timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ));
    setMessages(processed);
    return processed;
  }, [currentConversationId, refetchMessages]);

  const createConversation = useCreateConversation();
  const renameConversation = useRenameConversation();
  const deleteConversationMutation = useDeleteConversation();
  const saveMessageMutation = useSaveMessage();
  const uploadDocumentMutation = useUploadDocument();
  const deleteDocumentMutation = useDeleteDocument();
  const saveDocumentRecordMutation = useSaveDocumentRecord();
  const queryClient = useQueryClient();

  const handleNewChat = useCallback(async () => {
    if (!user) return; // Prevent creating new chat if no user
    try {
      const newConversation = await createConversation.mutateAsync("New Chat");
      await fetchConversations();
      setCurrentConversationId(newConversation.id);
      setMessages([]);
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  }, [fetchConversations, user, createConversation]);

  const fetchAvailableModels = useCallback(async () => {
    // models are already fetched via React Query and synced in effect
    return rqModels;
  }, [rqModels]);

  useEffect(() => {
    const initialize = async () => {
      if (user) { // Initialize only if user is logged in
        await fetchAvailableModels();
        const convos = await fetchConversations();
        if (convos.length > 0) {
          setCurrentConversationId(currentId => currentId || convos[0].id);
        } else {
          await handleNewChat();
        }
      } else {
        // Clear chat state if no user is logged in
        setConversations([]);
        setMessages([]);
        setCurrentConversationId(null);
      }
    };
    initialize();
  }, [fetchConversations, handleNewChat, fetchAvailableModels, user]);

  useEffect(() => {
    if (currentConversationId) {
      refetchMessages();
    }
  }, [currentConversationId, refetchMessages]);

  const handleSendMessage = async (text, isWebSearchEnabled = false) => {
    if (!text || !text.trim() || !currentConversationId || !selectedModel || !user) return; // Prevent sending message if no user

    // --- 1. Save User Message ---
    const userMessagePayload = {
      conversation_id: currentConversationId,
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString(),
    };
    const savedUserMessageResponse = await apiService.saveMessage(userMessagePayload);
    const savedUserMessage = {
        ...savedUserMessageResponse.data,
        timestamp: new Date(savedUserMessageResponse.data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, savedUserMessage]);
    setInputValue('');
    setIsTyping(true);

    // If this is the first user message, update conversation title immediately
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    const userMessages = messages.filter(m => m.sender === 'user');
    if (userMessages.length === 0) { // This is the first user message
      const firstMessageText = savedUserMessage.text || '';
      const words = firstMessageText.split(/\s+/);
      const summary = words.slice(0, 5).join(' ');
      const newTitle = words.length > 5 ? `${summary}...` : summary;
      
      // Update conversation title immediately, regardless of current title
      apiService.renameConversation(currentConversationId, newTitle)
        .then(() => {
          // Refresh the conversation list to show the new title
          fetchConversations();
        })
        .catch(err => console.error("Error renaming conversation:", err));
    }

    // --- 2. Prepare for AI Response ---
    const aiResponseId = Date.now().toString();
    const aiResponsePlaceholder = {
      id: aiResponseId,
      conversation_id: currentConversationId,
      sender: 'assistant',
      thinking: '',
      answer: '',
      isThinkingComplete: false,
      thinkingStartTime: Date.now(),
      thinkingDuration: 0,
      timestamp: new Date().toISOString() // Use ISO for consistency, format on display
    };
    setMessages(prev => [...prev, aiResponsePlaceholder]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const streamPayload = {
      conversation_id: currentConversationId,
      text: text,
      model: selectedModel,
    };

    const updateAIResponse = (updater) => {
      setMessages(prev =>
        prev.map(msg => (msg.id === aiResponseId ? updater(msg) : msg))
      );
    };

    // --- 3. Stream and Process AI Response ---
    try {
      const finalMessageState = { ...aiResponsePlaceholder };
      const iterator = apiService.streamChatResponse(streamPayload, { signal: controller.signal, webSearchEnabled: isWebSearchEnabled, ragEnabled: true });

      for await (const event of iterator) {
        switch (event.event) {
          case 'thread.run.step.in_progress':
            finalMessageState.thinking += event.data.details;
            updateAIResponse(msg => ({ ...msg, thinking: finalMessageState.thinking }));
            break;
          case 'thread.message.delta':
            if (finalMessageState.thinking && !finalMessageState.isThinkingComplete) {
              finalMessageState.isThinkingComplete = true;
              finalMessageState.thinkingDuration = (Date.now() - finalMessageState.thinkingStartTime) / 1000;
            }
            finalMessageState.answer += event.data.content;
            updateAIResponse(msg => ({ ...msg, answer: finalMessageState.answer, isThinkingComplete: finalMessageState.isThinkingComplete, thinkingDuration: finalMessageState.thinkingDuration }));
            break;
          case 'thread.run.completed':
            if (!finalMessageState.isThinkingComplete) {
              finalMessageState.isThinkingComplete = true;
              finalMessageState.thinkingDuration = (Date.now() - finalMessageState.thinkingStartTime) / 1000;
            }
            
            // --- 4. Save Final AI Message ---
            const messageToSave = {
              conversation_id: finalMessageState.conversation_id,
              sender: 'assistant',
              text: `<think>${finalMessageState.thinking}</think><answer>${finalMessageState.answer}</answer>`,
              thinking_duration: finalMessageState.thinkingDuration,
              timestamp: new Date().toISOString(),
            };

            const savedAssistantMessage = await saveMessageMutation.mutateAsync(messageToSave);
            const processedMessage = _processAssistantMessage(savedAssistantMessage);
            setMessages(prev => prev.map(m => m.id === aiResponseId ? processedMessage : m));

            // Do not overwrite the title if it has already been set based on the first user message
            const currentConversation = conversations.find(c => c.id === currentConversationId);
            if (currentConversation && currentConversation.title === "New Chat") {
              // Only generate a title if no user-based title has been set
              apiService.generateConversationTitle(currentConversationId, selectedModel)
                .then(() => {
                  fetchConversations();
                })
                .catch(err => console.error("Error generating title:", err));
            }
            break;
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error during streaming:', error);
        updateAIResponse(msg => ({
            ...msg,
            answer: 'Error: Could not get a response. Please try again.',
            isThinkingComplete: true,
        }));
      }
    } finally {
        setIsTyping(false);
        abortControllerRef.current = null;
    }
  };

  const handlePromptClick = (prompt) => {
    handleSendMessage(prompt.description);
  };

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsTyping(false);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessageIndex = newMessages.length - 1;
        if (lastMessageIndex >= 0 && newMessages[lastMessageIndex].sender === 'assistant') {
          const lastMessage = newMessages[lastMessageIndex];
          newMessages[lastMessageIndex] = {
            ...lastMessage,
            answer: lastMessage.answer ? lastMessage.answer + ' [Stopped]' : 'Generation stopped.',
            isThinkingComplete: true,
          };
        }
        return newMessages;
      });
    }
  }, []);
  
  const handleSelectConversation = (conversationId) => {
    setCurrentConversationId(conversationId);
    setMessages([]);
  };

  const handleRenameConversation = async (conversationId) => {
    const newTitle = prompt("Enter new title for the conversation:");
    if (newTitle && newTitle.trim() !== "") {
      try {
        await renameConversation.mutateAsync({ conversationId, newTitle });
        fetchConversations();
      } catch (error) {
        console.error('Error renaming conversation:', error);
        alert('Failed to rename conversation.');
      }
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    if (window.confirm("Are you sure you want to delete this conversation? This action cannot be undone.")) {
      try {
        await deleteConversationMutation.mutateAsync(conversationId);
        const remainingConversations = await fetchConversations();

        if (currentConversationId === conversationId) {
          if (remainingConversations.length > 0) {
            setCurrentConversationId(remainingConversations[0].id);
          } else {
            await handleNewChat();
          }
        }
      } catch (error) {
        console.error('Error deleting conversation:', error);
        alert('Failed to delete conversation.');
      }
    }
  };

  const handleModelChange = (model) => {
    setSelectedModel(model);
  };

  const appendMessage = useCallback((message) => {
    setMessages(prev => [...prev, {
      ...message,
      timestamp: new Date().toISOString(),
    }]);
  }, []);

  const chatContextValue = {
    messages,
    setMessages,
    appendMessage,
    inputValue,
    setInputValue,
    isTyping,
    setIsTyping,
    conversations,
    setConversations,
    currentConversationId,
    setCurrentConversationId,
    creatingNewChat,
    setCreatingNewChat,
    isChatInputFullScreen,
    setIsChatInputFullScreen,
    chatEndRef,
    availableModels,
    selectedModel,
    handleModelChange,
    scrollToBottom,
    fetchConversations,
    fetchMessages,
    handleSendMessage,
    handlePromptClick,
    handleNewChat,
    handleStopGeneration,
    handleSelectConversation,
    handleRenameConversation,
    handleDeleteConversation,
    documents,
    currentDocument,
    uploadDocument: async (file, conversationId) => {
      const formData = new FormData();
      formData.append('file', file);
      if (conversationId) {
        formData.append('conversation_id', conversationId);
      }
      const doc = await uploadDocumentMutation.mutateAsync(formData);
      setDocuments(prev => [...prev, doc]);
      return doc;
    },
    deleteDocument: async (documentId) => {
      await deleteDocumentMutation.mutateAsync(documentId);
      setDocuments(prev => prev.filter(doc => doc.document_id !== documentId));
    },
    fetchDocument: async (documentId) => {
      const data = await queryClient.fetchQuery({
        queryKey: keys.documents.item(documentId),
        queryFn: async () => {
          const res = await apiService.fetchDocument(documentId);
          return res.data;
        },
      });
      return data;
    },
    saveDocumentRecord: async (documentData) => {
      const saved = await saveDocumentRecordMutation.mutateAsync(documentData);
      return saved;
    },
  };

  return (
    <ChatContext.Provider value={chatContextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);