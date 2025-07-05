import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, Send, Menu, Plus, Settings, Home, Rocket, Star, Zap, Book, HelpCircle, Users, Heart, Shield, Lightbulb, FileText, Sparkles, Globe
} from 'lucide-react';

// Custom Chat Bubble Icon Component
const ChatBubbleIcon = (props) => (
  <svg {...props} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
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
    <div className="h-14 border-b border-dark-border flex items-center justify-between px-4 bg-dark-background">
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-dark-card rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6 text-dark-text-light" />
        </button>
        
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center space-x-2 px-3 py-2 bg-dark-card hover:bg-dark-border rounded-lg transition-colors"
          >
            <span className="text-sm font-medium text-dark-text-light">{selectedModel}</span>
            <ChevronDown className="w-4 h-4 text-dark-text-light" />
          </button>

          {isModelDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-dark-background border border-dark-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              {models.map((model) => (
                <button
                  key={model}
                  onClick={() => {
                    onModelChange(model);
                    setIsModelDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-dark-card transition-colors ${
                    selectedModel === model ? 'bg-dark-border text-purple-gradient-start' : 'text-dark-text-light'
                  }`}
                >
                  {model}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

// Sidebar Component
const Sidebar = ({ isOpen, onToggle, conversations, onNewChat }) => {
  const sidebarItems = [
    { icon: Home, label: 'Home', active: true },
    { icon: Rocket, label: 'Getting Started', active: false },
    { icon: Star, label: 'Features', active: false },
    { icon: Zap, label: 'Troubleshooting', active: false },
    { icon: Book, label: 'Tutorials', active: false },
    { icon: Settings, label: 'Settings', active: false },
    { icon: HelpCircle, label: 'FAQ', active: false },
    { icon: Users, label: 'Community', active: false },
    { icon: Heart, label: 'Sponsorships', active: false },
    { icon: Shield, label: 'Security Policy', active: false },
  ];

  return (
    <div className={`${isOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-dark-background border-r border-dark-border flex flex-col`}>
      <div className="p-4 border-b border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-purple-gradient rounded-xl flex items-center justify-center">
              <ChatBubbleIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-purple-gradient bg-clip-text text-transparent">Shianco Chat</span>
          </div>
        </div>
        
        <button
          onClick={onNewChat}
          className="w-full flex items-center space-x-2 px-3 py-2 bg-purple-gradient hover:opacity-90 rounded-lg transition-opacity"
        >
          <Plus className="w-5 h-5 text-white" />
          <span className="font-medium">New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-xs font-semibold text-dark-text-dark uppercase tracking-wider mb-3">
            Navigation
          </h3>
          <nav className="space-y-1">
            {sidebarItems.map((item, index) => (
              <button
                key={index}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-left ${
                  item.active
                    ? 'bg-purple-gradient text-white'
                    : 'text-dark-text-light hover:bg-dark-card'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-dark-border">
          <h3 className="text-xs font-semibold text-dark-text-dark uppercase tracking-wider mb-3">
            Recent Conversations
          </h3>
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className="w-full flex items-start space-x-3 p-3 rounded-lg hover:bg-dark-card transition-colors text-left"
              >
                <ChatBubbleIcon className="w-5 h-5 text-dark-text-light" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark-text-light truncate">
                    {conversation.title}
                  </p>
                  <p className="text-xs text-dark-text-dark">
                    {conversation.timestamp}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User Profile Section */}
      <div className="p-4 border-t border-dark-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-purple-gradient rounded-full flex items-center justify-center flex-shrink-0">
            <ChatBubbleIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-dark-text-light">Shianco User</p>
            <p className="text-xs text-dark-text-dark">Free Plan</p>
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
            ? 'bg-orange-600 text-white font-medium'
            : 'bg-gray-700 text-gray-100 font-medium'
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
  const LucideIconMap = {
    Lightbulb, FileText, Sparkles, Globe
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
      {prompts.map((prompt, index) => {
        const IconComponent = LucideIconMap[prompt.icon];
        return (
          <button
            key={index}
            onClick={() => onPromptClick(prompt)}
            className="p-4 bg-dark-card hover:bg-dark-border rounded-xl transition-colors text-left border border-dark-border"
          >
            <div className="flex items-center space-x-3">
              {IconComponent && (
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-dark-input-bg">
                  <IconComponent className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-dark-text-light mb-1">
                  {prompt.title}
                </h3>
                <p className="text-xs text-dark-text-dark">
                  {prompt.description}
                </p>
              </div>
            </div>
          </button>
        );
      })}
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
    <div className="border-t border-dark-border p-4 bg-dark-background">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-end">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Send a message..."
              className="w-full pl-4 pr-12 py-3 bg-dark-input-bg border border-dark-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-gradient-start focus:border-transparent text-dark-text-light font-medium placeholder-dark-text-dark"
              rows="1"
              disabled={disabled}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={!value.trim() || disabled}
              className="absolute right-2 bottom-2 p-2 bg-purple-gradient hover:opacity-90 disabled:bg-dark-border disabled:cursor-not-allowed rounded-xl transition-opacity"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        </form>
        
        <p className="text-xs text-dark-text-dark mt-2 text-center">
          Shianco Chat may generate inaccurate information about people, places, or facts.
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
        className="appearance-none bg-dark-card border border-dark-border rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-purple-gradient-start focus:border-transparent text-dark-text-light"
      >
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
        <ChevronDown className="w-4 h-4 text-dark-text-light" />
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