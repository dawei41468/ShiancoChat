import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import * as apiService from '@/services/apiService';

const ChatContext = createContext();

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

  // Fixed model for now
  const selectedModel = 'deepseek/deepseek-r1-0528-qwen3-8b';

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
      setMessages(response.data.map(msg => {
        let thinkingContent = '';
        let answerContent = msg.text;
        let isThinkingComplete = true; // Assume complete unless parsing indicates otherwise

        if (msg.sender === 'assistant') {
          const thinkingMatch = msg.text.match(/<think>(.*?)<\/think>/s);
          if (thinkingMatch && thinkingMatch[1]) {
            thinkingContent = thinkingMatch[1].trim();
            answerContent = msg.text.replace(/<think>.*?<\/think>/s, '').trim();
          } else {
            // If no thinking block, the whole text is the answer
            answerContent = msg.text;
            thinkingContent = '';
          }
        }

        return {
          ...msg,
          timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          rawText: msg.text, // Store raw text for debugging
          ...(msg.sender === 'assistant' ? { thinking: thinkingContent, answer: answerContent, isThinkingComplete: isThinkingComplete } : {})
        };
      }));
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
      await fetchConversations(); // Refetch the list to ensure it's sorted correctly
      setCurrentConversationId(newConversation.id);
      setMessages([]);
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  }, [fetchConversations]);

  useEffect(() => {
    const initialize = async () => {
      const convos = await fetchConversations();
      if (convos.length > 0) {
        // Set currentConversationId only if it's not already set.
        // This prevents resetting the view on hot-reloads.
        setCurrentConversationId(currentId => currentId || convos[0].id);
      } else {
        // If there are no conversations, create a new one.
        await handleNewChat();
      }
    };
    initialize();
  }, [fetchConversations, handleNewChat]);

  useEffect(() => {
    fetchMessages(currentConversationId);
  }, [currentConversationId, fetchMessages]);

  const handleSendMessage = async (text) => {
    if (!text || !text.trim() || !currentConversationId) return;

    const userMessage = {
      id: Date.now().toString(),
      conversation_id: currentConversationId,
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const aiResponseId = Date.now().toString() + '-ai';
    const aiResponsePlaceholder = {
      id: aiResponseId,
      conversation_id: currentConversationId,
      sender: 'assistant',
      thinking: '',
      answer: '',
      isThinkingComplete: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage, aiResponsePlaceholder]);
    setInputValue('');
    setIsTyping(true);

    // Create and store a new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentAIResponseMutable = { ...aiResponsePlaceholder };
    const payload = {
      conversation_id: currentConversationId,
      sender: 'user',
      text: text,
      model: selectedModel,
    };

    const updateAIResponse = (updates) => {
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        const index = newMessages.findIndex(msg => msg.id === aiResponseId);
        if (index !== -1) {
          newMessages[index] = { ...newMessages[index], ...updates };
        }
        return newMessages;
      });
    };

    await apiService.streamChatResponse(payload, {
      signal: abortControllerRef.current.signal,
      onData: (data) => {
        updateAIResponse({
          thinking: data.thinking.trim(),
          answer: data.answer.trim(),
        });
      },
      onComplete: (finalData) => {
        abortControllerRef.current = null;
        setIsTyping(false);
        const finalAnswer = finalData.answer
          .replace(/###\s*/g, '\n\n### ')
          .replace(/\|\|\s*/g, '\n\n');
        
        updateAIResponse({ 
            answer: finalAnswer.trim(),
            thinking: finalData.thinking.trim(),
            isThinkingComplete: true 
        });
        // fetchConversations(); // Re-enable if you want to refresh conversations list after each message
      },
      onError: (error) => {
        abortControllerRef.current = null;
        console.error('Error during streaming response:', error);
        setIsTyping(false);
        updateAIResponse({
          answer: 'Error: Could not get a response. Please try again.',
          isThinkingComplete: true,
        });
      },
    });
  };

  const handlePromptClick = (prompt) => {
    handleSendMessage(prompt.description);
  };

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsTyping(false);
      // Update the last message to indicate it was stopped
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
            // If other conversations exist, switch to the first one
            setCurrentConversationId(remainingConversations[0].id);
          } else {
            // If no conversations are left, create a new one
            await handleNewChat();
          }
        }
      } catch (error) {
        console.error('Error deleting conversation:', error);
        alert('Failed to delete conversation.');
      }
    }
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
    selectedModel,
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