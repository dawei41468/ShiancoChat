import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { Components } from './components';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4100';

const {
  Sidebar,
  ChatInterface,
  MessageBubble,
  ModelSelector,
  SuggestedPrompts,
  ChatInput,
  TopBar,
  AIResponseBlock // Import the new component
} = Components;

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState('deepseek/deepseek-r1-0528-qwen3-8b'); // Fixed model
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const chatEndRef = useRef(null);

  // Suggested prompts (can remain static or be fetched)
  const suggestedPrompts = [
    {
      title: 'Help me debug',
      description: 'Help me debug this piece of code',
      icon: 'Lightbulb',
    },
    {
      title: 'Chat with Docs',
      description: 'Upload a document and chat with it',
      icon: 'FileText',
    },
    {
      title: 'Generate artwork',
      description: 'Create beautiful AI-generated artwork',
      icon: 'Sparkles',
    },
    {
      title: 'Tell me a fun fact',
      description: 'Share an interesting fact about science',
      icon: 'Globe',
    }
  ];

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  useEffect(() => {
    scrollToBottom();
  }, [messages]); // Scroll only when new messages are added

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/chat/conversations`);
      setConversations(response.data);
      if (response.data.length > 0 && !currentConversationId) {
        setCurrentConversationId(response.data[0].id); // Select the most recent conversation
      } else if (response.data.length === 0) {
        // If no conversations exist, create a new one automatically
        handleNewChat();
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [currentConversationId]);

  // Fetch messages for the current conversation
  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    try {
      const response = await axios.get(`${BACKEND_URL}/api/chat/conversations/${conversationId}/messages`);
      setMessages(response.data.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })));
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

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

    // Create a placeholder for the AI's response that will be updated during streaming
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

    // Use a mutable object to hold the current state of the AI response during streaming
    // This allows the processTextContent helper to update it by reference
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

      // Helper function to process text chunks for <think> tags and update the mutable AI response object
      const processTextContent = (text) => {
        let tempText = text;
        while (tempText.length > 0) {
          const thinkStart = tempText.indexOf('<think>');
          const thinkEnd = tempText.indexOf('</think>');

          if (inThinkingBlock) {
            if (thinkEnd !== -1) {
              // End of thinking block found
              currentAIResponseMutable.thinking += tempText.substring(0, thinkEnd);
              currentAIResponseMutable.isThinkingComplete = true;
              currentAIResponseMutable.answer += tempText.substring(thinkEnd + '</think>'.length);
              tempText = ''; // Clear tempText after processing
              inThinkingBlock = false;
            } else {
              // Still in thinking block, accumulate content
              currentAIResponseMutable.thinking += tempText;
              tempText = ''; // Clear tempText after accumulating
            }
          } else {
            if (thinkStart !== -1) {
              // Start of thinking block found
              currentAIResponseMutable.answer += tempText.substring(0, thinkStart); // Content before <think> is part of answer
              inThinkingBlock = true;
              currentAIResponseMutable.thinking = ''; // Reset thinking content for new block
              tempText = tempText.substring(thinkStart + '<think>'.length); // Keep content after <think> in tempText
            } else {
              // Not in thinking block and no new <think> tag, accumulate to full answer
              currentAIResponseMutable.answer += tempText;
              tempText = ''; // Clear tempText after accumulating
            }
          }
        }
        // Update the messages state to trigger re-render of the AIResponseBlock
        setMessages(prevMessages => {
          const newMessages = [...prevMessages];
          const index = newMessages.findIndex(msg => msg.id === aiResponseId);
          if (index !== -1) {
            newMessages[index] = { ...currentAIResponseMutable }; // Create a new object to trigger re-render
          }
          return newMessages;
        });
      };

      while (true) {
        const { value, done } = await reader.read();
        const chunk = decoder.decode(value, { stream: true });

        if (done) {
          // Process any remaining content in buffer after stream ends
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              processTextContent(line.substring('data: '.length));
            }
          }
          // Ensure final state is correct after stream ends
          if (inThinkingBlock) {
            currentAIResponseMutable.isThinkingComplete = true;
            // Final update to messages to ensure the complete state is reflected
            setMessages(prevMessages => {
              const newMessages = [...prevMessages];
              const index = newMessages.findIndex(msg => msg.id === aiResponseId);
              if (index !== -1) {
                newMessages[index] = { ...currentAIResponseMutable };
              }
              return newMessages;
            });
          }
          break;
        }

        buffer += chunk;

        // Process buffer for complete SSE messages
        let messageEndIndex;
        while ((messageEndIndex = buffer.indexOf('\n\n')) !== -1) {
          const messageBlock = buffer.substring(0, messageEndIndex);
          buffer = buffer.substring(messageEndIndex + 2); // +2 for '\n\n'

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

      fetchConversations(); // Refresh conversations

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
            thinking: newMessages[index].thinking || '' // Keep thinking content if any
          };
        } else {
          // Fallback if placeholder wasn't added for some reason
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
      // No need to set isThinkingPhase to false here, as it's managed by isThinkingComplete within the AI response object
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
      fetchConversations(); // Refresh conversations list
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  const handleSelectConversation = (conversationId) => {
    setCurrentConversationId(conversationId);
    setMessages([]); // Clear messages while new ones are fetched
  };

  return (
    <div className="flex h-screen bg-dark-background text-dark-text-light font-medium">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={conversations}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        currentConversationId={currentConversationId}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <TopBar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          selectedModel={selectedModel}
        />

        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="text-center mb-12">
              <div className="w-20 h-20 bg-purple-gradient rounded-full flex items-center justify-center mb-4 mx-auto">
                {/* Replaced 'OI' text with SVG icon */}
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold mb-2 bg-purple-gradient bg-clip-text text-transparent">Shianco Chat</h1>
              <p className="text-dark-text-dark text-lg">
                How can I help you today? Choose a starter below or ask me anything.
              </p>
            </div>
            
            <SuggestedPrompts
              prompts={suggestedPrompts}
              onPromptClick={handlePromptClick}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-4 space-y-4">
              {messages.map((message) => (
                message.sender === 'user' ? (
                  <MessageBubble key={message.id} message={message} />
                ) : (
                  <AIResponseBlock key={message.id} response={message} />
                )
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}

        {/* Chat Input */}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          disabled={isTyping}
        />
      </div>
    </div>
  );
}

export default App;