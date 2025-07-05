import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, Send, Plus, Settings, Home, Rocket, Star, Zap, Book, HelpCircle, Users, Heart, Shield, Lightbulb, FileText, Sparkles, Globe, Menu
} from 'lucide-react';

// Custom Chat Bubble Icon Component
const ChatBubbleIcon = (props) => (
  <svg {...props} fill="none" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="chat-bubble-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8B5CF6" /> {/* Tailwind's purple-500 */}
        <stop offset="100%" stopColor="#3B82F6" /> {/* Tailwind's blue-500 */}
      </linearGradient>
    </defs>
    <path stroke={props.useGradient ? "url(#chat-bubble-gradient)" : "currentColor"} strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
  </svg>
);

// Top Bar Component
const TopBar = ({ onToggleSidebar, selectedModel }) => {
  return (
    <div className="h-14 border-b border-dark-border flex items-center justify-between px-4 bg-dark-background">
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 border border-dark-border rounded-full bg-purple-gradient hover:bg-dark-card transition-colors"
          aria-label="Toggle Sidebar"
        >
          <ChatBubbleIcon className="w-6 h-6"/>
        </button>
        
        <div className="flex items-center space-x-2 px-3 py-2 bg-dark-card rounded-lg">
          <span className="text-sm font-medium text-dark-text-light">{selectedModel}</span>
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
    { icon: Book, label: 'Tutorials', active: false },
    { icon: Settings, label: 'Settings', active: false },
    { icon: HelpCircle, label: 'FAQ', active: false },
    { icon: Users, label: 'Community', active: false },
    { icon: Shield, label: 'Security Policy', active: false },
  ];

  return (
    <div className={`${isOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-dark-background border-r border-dark-border flex flex-col`}>
      <div className="p-4 border-b border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <ChatBubbleIcon className="w-6 h-6" useGradient={true} />
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
                <ChatBubbleIcon className="w-5 h-5" stroke="currentColor" />
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
            <ChatBubbleIcon className="w-6 h-6" stroke="currentColor" />
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
const MessageBubble = ({ message, isThinking = false }) => {
  const isUser = message.sender === 'user';
  const textContent = message.text || ''; // Ensure message.text is not undefined

  const bubbleClasses = `px-4 py-3 rounded-2xl transition-all duration-300 ease-in-out ${
    isUser
      ? 'bg-orange-600 text-white font-medium'
      : 'bg-gray-700 text-gray-100 font-medium'
  } ${isThinking ? 'min-w-[100px] max-w-full' : ''} whitespace-pre-wrap`; // Apply min-width for thinking state and preserve formatting

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
        
        <div className={bubbleClasses}>
          <p className="text-sm leading-relaxed">
            {textContent}
            {isThinking && <span className="animate-pulse">_</span>} {/* Blinking cursor */}
          </p>
          {!isThinking && message.timestamp && (
            <p className="text-xs opacity-70 mt-1">
              {message.timestamp}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// AIResponseBlock Component
const AIResponseBlock = ({ response }) => {
  const { thinking, answer, isThinkingComplete } = response;
  const [isThinkingOpen, setIsThinkingOpen] = useState(false); // Start collapsed

  return (
    <div className="flex justify-start mb-4">
      <div className="flex max-w-3xl flex-row">
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-700 mr-3">
          <span className="text-sm font-bold text-white">AI</span>
        </div>
        <div className="flex-1">
          {thinking && (
            <div className="mb-2"> {/* Margin between thinking box and answer */}
              <div className="bg-gray-800 p-4 rounded-lg shadow-md">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsThinkingOpen(!isThinkingOpen)}>
                  <h3 className="text-sm font-semibold text-dark-text-light">
                    {isThinkingComplete ? 'Thinking Complete' : 'Thinking...'}
                  </h3>
                  <ChevronDown className={`w-5 h-5 text-dark-text-light transition-transform ${isThinkingOpen ? 'rotate-0' : '-rotate-90'}`} />
                </div>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isThinkingOpen ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {thinking}
                    {!isThinkingComplete && <span className="animate-pulse">_</span>} {/* Blinking cursor only during thinking */}
                  </p>
                </div>
              </div>
            </div>
          )}
          {answer && (
            <div className="px-4 py-3 rounded-2xl bg-gray-700 text-gray-100 font-medium whitespace-pre-wrap">
              <p className="text-sm leading-relaxed">{answer}</p>
            </div>
          )}
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
  SuggestedPrompts,
  ChatInput,
  TopBar,
  AIResponseBlock // Export the new component
};