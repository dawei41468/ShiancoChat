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
      icon: '🐛'
    },
    {
      title: 'Chat with Docs',
      description: 'Upload a document and chat with it',
      icon: '📄'
    },
    {
      title: 'Generate artwork',
      description: 'Create beautiful AI-generated artwork',
      icon: '🎨'
    },
    {
      title: 'Tell me a fun fact',
      description: 'Share an interesting fact about science',
      icon: '🔬'
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
    <div className="flex h-screen bg-gray-900 text-white">
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
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <span className="text-2xl font-bold text-white">OI</span>
                </div>
                <h1 className="text-3xl font-bold mb-2">Open WebUI</h1>
                <p className="text-gray-400 text-lg">
                  How can I help you today?
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