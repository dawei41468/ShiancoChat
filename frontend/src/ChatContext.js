import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import * as apiService from '@/services/apiService';

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

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    try {
      const response = await apiService.fetchMessagesForConversation(conversationId);
      setMessages(response.data.map(msg => 
        msg.sender === 'assistant' ? _processAssistantMessage(msg) : {
          ...msg,
          timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ));
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await apiService.fetchConversations();
      setConversations(response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
      return [];
    }
  }, []);

  const handleNewChat = useCallback(async () => {
    try {
      const response = await apiService.createNewChat("New Chat");
      const newConversation = response.data;
      await fetchConversations();
      setCurrentConversationId(newConversation.id);
      setMessages([]);
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  }, [fetchConversations]);

  const fetchAvailableModels = useCallback(async () => {
    try {
      const response = await apiService.fetchAvailableModels();
      setAvailableModels(response.data.models);
      if (response.data.models.length > 0) {
        setSelectedModel(response.data.models[0]);
      }
    } catch (error) {
      console.error('Error fetching available models:', error);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await fetchAvailableModels();
      const convos = await fetchConversations();
      if (convos.length > 0) {
        setCurrentConversationId(currentId => currentId || convos[0].id);
      } else {
        await handleNewChat();
      }
    };
    initialize();
  }, [fetchConversations, handleNewChat, fetchAvailableModels]);

  useEffect(() => {
    fetchMessages(currentConversationId);
  }, [currentConversationId, fetchMessages]);

  const handleSendMessage = async (text) => {
    if (!text || !text.trim() || !currentConversationId || !selectedModel) return;

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
      const iterator = apiService.streamChatResponse(streamPayload, { signal: controller.signal });

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

            const savedAssistantMessage = await apiService.saveMessage(messageToSave);
            
            const processedMessage = _processAssistantMessage(savedAssistantMessage.data);
            setMessages(prev => prev.map(m => m.id === aiResponseId ? processedMessage : m));

            // If the conversation title is still "New Chat", generate a new one.
            const currentConversation = conversations.find(c => c.id === currentConversationId);
            if (currentConversation && currentConversation.title === "New Chat") {
              apiService.generateConversationTitle(currentConversationId, selectedModel)
                .then(() => {
                  // Refresh the conversation list to show the new title
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
        await apiService.renameConversation(conversationId, newTitle);
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
        await apiService.deleteConversation(conversationId);
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

  const chatContextValue = {
    messages,
    setMessages,
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
  };

  return (
    <ChatContext.Provider value={chatContextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);