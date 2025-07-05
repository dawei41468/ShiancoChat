import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Components } from './components';

const {
  Sidebar,
  ChatInterface,
  MessageBubble,
  ModelSelector,
  SuggestedPrompts,
  ChatInput,
  TopBar
} = Components;

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState('OpenAI / GPT-4');
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Mock models data
  const models = [
    'OpenAI / GPT-4',
    'OpenAI / GPT-3.5 Turbo',
    'Anthropic / Claude-3-Opus',
    'Anthropic / Claude-3-Sonnet',
    'Google / Gemini Pro',
    'Meta / Llama-2-70B',
    'Mistral / Mistral-Large',
    'Cohere / Command-R+'
  ];

  // Mock conversations data
  const conversations = [
    { id: 1, title: 'React Best Practices', timestamp: '2 hours ago', active: false },
    { id: 2, title: 'Python Data Analysis', timestamp: '1 day ago', active: false },
    { id: 3, title: 'JavaScript Async/Await', timestamp: '3 days ago', active: false },
    { id: 4, title: 'Machine Learning Basics', timestamp: '1 week ago', active: false },
    { id: 5, title: 'API Design Patterns', timestamp: '2 weeks ago', active: false },
  ];

  // Mock suggested prompts
  const suggestedPrompts = [
    {
      title: 'Help me debug',
      description: 'Help me debug this piece of code',
      icon: 'Lightbulb', // Changed to Lucide icon name
    },
    {
      title: 'Chat with Docs',
      description: 'Upload a document and chat with it',
      icon: 'FileText', // Changed to Lucide icon name
    },
    {
      title: 'Generate artwork',
      description: 'Create beautiful AI-generated artwork',
      icon: 'Sparkles', // Changed to Lucide icon name
    },
    {
      title: 'Tell me a fun fact',
      description: 'Share an interesting fact about science',
      icon: 'Globe', // Changed to Lucide icon name
    }
  ];

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (text) => {
    if (!text.trim()) return;

    const newMessage = {
      id: Date.now(),
      text: text,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "I'd be happy to help you with that! Let me break this down for you...",
        "That's an interesting question. Based on the latest information I have...",
        "Here's what I can tell you about that topic...",
        "I understand what you're asking. Let me provide you with a comprehensive answer...",
        "Great question! Here's my analysis of this situation..."
      ];

      const aiResponse = {
        id: Date.now() + 1,
        text: responses[Math.floor(Math.random() * responses.length)] + 
              " This is a mock response to demonstrate the Open WebUI interface. " +
              "In a real implementation, this would be connected to your local LLM.",
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1000 + Math.random() * 2000);
  };

  const handlePromptClick = (prompt) => {
    handleSendMessage(prompt.description);
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex h-screen bg-dark-background text-dark-text-light font-medium">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={conversations}
        onNewChat={clearChat}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <TopBar 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          selectedModel={selectedModel}
          models={models}
          onModelChange={setSelectedModel}
        />

        {/* Chat Interface */}
        <div className="flex-1 flex flex-col">
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
                  <MessageBubble key={message.id} message={message} />
                ))}
                {isTyping && (
                  <MessageBubble 
                    message={{
                      id: 'typing',
                      sender: 'ai',
                      text: 'Thinking...',
                      timestamp: 'now'
                    }}
                    isTyping={true}
                  />
                )}
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
    </div>
  );
}

export default App;