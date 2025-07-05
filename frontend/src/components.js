import React, { useState, useRef, useEffect } from 'react';

// Icons and UI Components
const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const MessageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Top Bar Component
const TopBar = ({ onToggleSidebar, selectedModel, models, onModelChange }) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsModelDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="h-14 border-b border-gray-700 flex items-center justify-between px-4 bg-gray-800">
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <MenuIcon />
        </button>
        
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <span className="text-sm font-medium">{selectedModel}</span>
            <ChevronDownIcon />
          </button>

          {isModelDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              {models.map((model) => (
                <button
                  key={model}
                  onClick={() => {
                    onModelChange(model);
                    setIsModelDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 transition-colors ${
                    selectedModel === model ? 'bg-gray-700 text-orange-400' : 'text-gray-300'
                  }`}
                >
                  {model}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
          <SettingsIcon />
        </button>
      </div>
    </div>
  );
};

// Sidebar Component
const Sidebar = ({ isOpen, onToggle, conversations, onNewChat }) => {
  const sidebarItems = [
    { icon: '🏠', label: 'Home', active: true },
    { icon: '🚀', label: 'Getting Started', active: false },
    { icon: '⭐', label: 'Features', active: false },
    { icon: '🔧', label: 'Troubleshooting', active: false },
    { icon: '📚', label: 'Tutorials', active: false },
    { icon: '🔌', label: 'OpenAPI Tool Servers', active: false },
    { icon: '🔄', label: 'Pipelines', active: false },
    { icon: '❓', label: 'FAQ', active: false },
    { icon: '🗺️', label: 'Roadmap', active: false },
    { icon: '🛡️', label: 'Security Policy', active: false },
    { icon: '🤝', label: 'Contributing', active: false },
    { icon: '💖', label: 'Sponsorships', active: false },
    { icon: '📄', label: 'Open WebUI License', active: false },
    { icon: '🏢', label: 'Open WebUI for Enterprises', active: false },
    { icon: '🎯', label: 'Our Mission', active: false },
    { icon: '👥', label: 'Our Team', active: false },
  ];

  return (
    <div className={`${isOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-gray-900 border-r border-gray-700 flex flex-col`}>
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold text-white">OI</span>
            </div>
            <span className="text-lg font-bold">Open WebUI</span>
          </div>
        </div>
        
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
        >
          <PlusIcon />
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Navigation
          </h3>
          <nav className="space-y-1">
            {sidebarItems.map((item, index) => (
              <button
                key={index}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-left ${
                  item.active 
                    ? 'bg-orange-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Recent Conversations
          </h3>
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className="w-full flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-800 transition-colors text-left"
              >
                <MessageIcon />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">
                    {conversation.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {conversation.timestamp}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Message Bubble Component
const MessageBubble = ({ message, isTyping = false }) => {
  const isUser = message.sender === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-orange-600 ml-3' : 'bg-gray-700 mr-3'
        }`}>
          {isUser ? (
            <span className="text-sm font-bold text-white">U</span>
          ) : (
            <span className="text-sm font-bold text-white">AI</span>
          )}
        </div>
        
        <div className={`px-4 py-3 rounded-2xl ${
          isUser 
            ? 'bg-orange-600 text-white' 
            : 'bg-gray-700 text-gray-100'
        }`}>
          <p className="text-sm leading-relaxed">
            {isTyping ? (
              <span className="flex items-center">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse animation-delay-100">●</span>
                <span className="animate-pulse animation-delay-200">●</span>
              </span>
            ) : (
              message.text
            )}
          </p>
          <p className="text-xs opacity-70 mt-1">
            {message.timestamp}
          </p>
        </div>
      </div>
    </div>
  );
};

// Suggested Prompts Component
const SuggestedPrompts = ({ prompts, onPromptClick }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
      {prompts.map((prompt, index) => (
        <button
          key={index}
          onClick={() => onPromptClick(prompt)}
          className="p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-left border border-gray-700"
        >
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{prompt.icon}</span>
            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-1">
                {prompt.title}
              </h3>
              <p className="text-xs text-gray-400">
                {prompt.description}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

// Chat Input Component
const ChatInput = ({ value, onChange, onSend, disabled }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-gray-700 p-4 bg-gray-800">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="flex items-end space-x-4">
          <div className="flex-1 relative">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Send a message..."
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white placeholder-gray-400"
              rows="1"
              disabled={disabled}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          
          <button
            type="submit"
            disabled={!value.trim() || disabled}
            className="p-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl transition-colors"
          >
            <SendIcon />
          </button>
        </form>
        
        <p className="text-xs text-gray-400 mt-2 text-center">
          Open WebUI may generate inaccurate information about people, places, or facts.
        </p>
      </div>
    </div>
  );
};

// Model Selector Component (for future use)
const ModelSelector = ({ models, selectedModel, onModelChange }) => {
  return (
    <div className="relative">
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        className="appearance-none bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white"
      >
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
        <ChevronDownIcon />
      </div>
    </div>
  );
};

// Chat Interface Component (for future use)
const ChatInterface = ({ children }) => {
  return (
    <div className="flex-1 flex flex-col">
      {children}
    </div>
  );
};

export const Components = {
  Sidebar,
  ChatInterface,
  MessageBubble,
  ModelSelector,
  SuggestedPrompts,
  ChatInput,
  TopBar
};