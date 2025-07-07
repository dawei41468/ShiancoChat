import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const ChatContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4100';

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [creatingNewChat, setCreatingNewChat] = useState(false);
  const [isChatInputFullScreen, setIsChatInputFullScreen] = useState(false);
  const chatEndRef = useRef(null);

  // Fixed model for now
  const selectedModel = 'deepseek/deepseek-r1-0528-qwen3-8b';

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/chat/conversations`);
      setConversations(response.data);
      if (response.data.length > 0) {
        if (!currentConversationId) {
          setCurrentConversationId(response.data[0].id);
        }
      } else {
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [currentConversationId]);

  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    try {
      const response = await axios.get(`${BACKEND_URL}/api/chat/conversations/${conversationId}/messages`);
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

  useEffect(() => {
    if (!creatingNewChat) {
      fetchConversations();
    }
  }, [fetchConversations, creatingNewChat]);

  useEffect(() => {
    fetchMessages(currentConversationId);
  }, [currentConversationId, fetchMessages]);

  const handleSendMessage = async (text) => {
    if (!text.trim() || !currentConversationId) return;

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

    const currentAIResponseMutable = { ...aiResponsePlaceholder };

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: currentConversationId,
          sender: 'user',
          text: text,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let inThinkingBlock = false;
      let fullThinkingContent = ''; // Accumulate thinking content
      let fullAnswerContent = ''; // Accumulate answer content

      const processTextContent = (text) => {
        // Append raw text to a temporary 'rawText' property for debugging
        currentAIResponseMutable.rawText = (currentAIResponseMutable.rawText || '') + text;

        // Process the incoming text chunk
        let remainingText = text;

        // Check for opening <think> tag
        if (!inThinkingBlock && remainingText.includes('<think>')) {
          inThinkingBlock = true;
          // Add any text before <think> to answer
          const parts = remainingText.split('<think>', 2);
          fullAnswerContent += parts[0];
          remainingText = parts[1];
        }

        // Accumulate thinking content
        if (inThinkingBlock) {
          if (remainingText.includes('</think>')) {
            const parts = remainingText.split('</think>', 2);
            fullThinkingContent += parts[0];
            remainingText = parts[1];
            inThinkingBlock = false; // Thinking block is complete
            currentAIResponseMutable.isThinkingComplete = true;
          } else {
            fullThinkingContent += remainingText;
            remainingText = '';
          }
        }

        // Accumulate answer content after thinking block
        if (!inThinkingBlock && remainingText) {
          fullAnswerContent += remainingText;
        }

        // Update the mutable response object
        currentAIResponseMutable.thinking = fullThinkingContent.trim();
        currentAIResponseMutable.answer = fullAnswerContent.trim();
        currentAIResponseMutable.isThinkingComplete = !inThinkingBlock; // Set to true if not in thinking block

        setMessages(prevMessages => {
          const newMessages = [...prevMessages];
          const index = newMessages.findIndex(msg => msg.id === aiResponseId);
          if (index !== -1) {
            newMessages[index] = { ...currentAIResponseMutable };
          }
          return newMessages;
        });
      };

      while (true) {
        const { value, done } = await reader.read();
        const chunk = decoder.decode(value, { stream: true });

        if (done) {
          // Post-process the fullAnswerContent to convert custom markers to standard markdown
          fullAnswerContent = fullAnswerContent
            .replace(/###\s*/g, '\n\n### ') // Convert ### to markdown heading with newlines
            .replace(/\|\|\s*/g, '\n\n'); // Convert || to double newline for paragraph breaks

          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              processTextContent(line.substring('data: '.length));
            }
          }
          // Ensure thinking is marked complete at the end of stream
          currentAIResponseMutable.isThinkingComplete = true;
          setMessages(prevMessages => {
            const newMessages = [...prevMessages];
            const index = newMessages.findIndex(msg => msg.id === aiResponseId);
            if (index !== -1) {
              newMessages[index] = { ...currentAIResponseMutable };
            }
            return newMessages;
          });
          break;
        }

        buffer += chunk;

        let messageEndIndex;
        while ((messageEndIndex = buffer.indexOf('\n\n')) !== -1) {
          const messageBlock = buffer.substring(0, messageEndIndex);
          buffer = buffer.substring(messageEndIndex + 2);

          const lines = messageBlock.split('\n');
          let currentSSEData = '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              currentSSEData += line.substring('data: '.length);
            }
          }
          processTextContent(currentSSEData);
        }
      }

      // Temporarily comment out fetchConversations to isolate streaming issue
      // fetchConversations();

    } catch (error) {
      console.error('Error during streaming response:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        const index = newMessages.findIndex(msg => msg.id === aiResponseId);
        if (index !== -1) {
          newMessages[index] = {
            ...newMessages[index],
            answer: 'Error: Could not get a response. Please try again.',
            isThinkingComplete: true,
            thinking: newMessages[index].thinking || ''
          };
        } else {
          newMessages.push({
            id: Date.now().toString(),
            sender: 'assistant',
            text: 'Error: Could not get a response. Please try again.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
        return newMessages;
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handlePromptClick = (prompt) => {
    handleSendMessage(prompt.description);
  };

  const handleNewChat = async () => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/chat/new`, { title: "New Chat" });
      setCurrentConversationId(response.data.id);
      setMessages([]);
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setCreatingNewChat(false);
    }
  };

  const handleSelectConversation = (conversationId) => {
    setCurrentConversationId(conversationId);
    setMessages([]);
  };

  const handleRenameConversation = async (conversationId) => {
    const newTitle = prompt("Enter new title for the conversation:");
    if (newTitle && newTitle.trim() !== "") {
      try {
        await axios.put(`${BACKEND_URL}/api/chat/conversations/${conversationId}`, { new_title: newTitle });
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
        await axios.delete(`${BACKEND_URL}/api/chat/conversations/${conversationId}`);
        await fetchConversations();

        if (currentConversationId === conversationId) {
          setMessages([]);
        }
        const updatedConversationsResponse = await axios.get(`${BACKEND_URL}/api/chat/conversations`);
        if (updatedConversationsResponse.data.length === 0) {
          handleNewChat();
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