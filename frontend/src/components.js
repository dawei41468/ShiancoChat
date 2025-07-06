import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, Send, Plus, Settings, Home, Rocket, Star, Zap, Book, HelpCircle, Users, Heart, Shield, Lightbulb, FileText, Sparkles, Globe, Menu, MoreVertical, Pencil, Trash, Maximize2, Minimize2, Sun, Moon
} from 'lucide-react';

// Custom Chat Bubble Icon Component
const ChatBubbleIcon = ({ useGradient, ...props }) => {
  const isDarkMode = props.isDarkMode !== undefined ? props.isDarkMode : true;
  const strokeColor = useGradient ? "url(#chat-bubble-gradient)" : (isDarkMode ? "#FFFFFF" : "#333333");
  return (
    <svg {...props} fill="none" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chat-bubble-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" /> {/* Tailwind's purple-500 */}
          <stop offset="100%" stopColor="#3B82F6" /> {/* Tailwind's blue-500 */}
        </linearGradient>
      </defs>
      <path stroke={strokeColor} strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
};

// Top Bar Component
const TopBar = ({ onToggleSidebar, selectedModel, isDarkMode, toggleTheme }) => {

  return (
    <div className={`h-14 border-b flex items-center justify-between px-4 ${isDarkMode ? 'border-dark-border bg-dark-background' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 border border-dark-border rounded-full bg-purple-gradient hover:bg-dark-card transition-colors pointer-events-auto z-50"
          aria-label="Toggle Sidebar"
        >
          <ChatBubbleIcon className="w-6 h-6" />
        </button>
        
        <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-dark-card' : 'bg-gray-100'}`}>
          <span className={`text-sm font-medium ${isDarkMode ? 'text-dark-text-light' : 'text-gray-700'}`}>{selectedModel}</span>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleTheme}
          className={`p-1 border rounded-full hover:bg-dark-hover transition-colors cursor-pointer z-50 ${isDarkMode ? 'bg-dark-card border-dark-border' : 'bg-gray-100 border-gray-300'}`}
          aria-label="Toggle Light/Dark Mode"
        >
          {!isDarkMode ? <Moon className={`w-4 h-4 ${isDarkMode ? 'text-dark-text-light' : 'text-gray-700'}`} /> : <Sun className="w-4 h-4 text-dark-text-light" />}
        </button>
      </div>
    </div>
  );
};

// Sidebar Component
const Sidebar = ({ isOpen, onToggle, conversations, onNewChat, onSelectConversation, currentConversationId, onRenameConversation, onDeleteConversation, isDarkMode }) => {
  const [language, setLanguage] = useState('EN');
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
    <div className={`sidebar ${isOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden ${isDarkMode ? 'bg-dark-background border-r border-dark-border' : 'bg-white border-r border-gray-200'} flex flex-col`}>
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
          <span className="font-medium" style={{ color: '#FFFFFF' }}>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: isDarkMode ? '#CCCCCC' : '#333333' }}>
            Navigation
          </h3>
          <nav className="space-y-1">
            {sidebarItems.map((item, index) => (
              <button
                key={index}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-left ${
                  item.active
                    ? 'bg-purple-gradient text-white'
                    : `hover:bg-dark-card ${isDarkMode ? 'text-dark-text-light' : 'text-black'}`
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-dark-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: isDarkMode ? '#CCCCCC' : '#333333' }}>
            Recent Conversations
          </h3>
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`relative group flex items-center w-full rounded-lg transition-colors
                  ${conversation.id === currentConversationId ? (isDarkMode ? 'bg-dark-card-selected' : 'bg-gray-200') : (isDarkMode ? 'hover:bg-dark-card' : 'hover:bg-gray-100')}`}
              >
                <button
                  onClick={() => onSelectConversation(conversation.id)}
                  className="flex-1 flex items-start space-x-3 p-3 text-left"
                >
                  <ChatBubbleIcon className="w-5 h-5" stroke="currentColor" isDarkMode={isDarkMode} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: isDarkMode ? '#E0E0E0' : '#333333' }}>
                      {conversation.title}
                    </p>
                    {/* Optionally display last updated timestamp if available and desired */}
                    {/* <p className="text-xs" style={{ color: isDarkMode ? '#CCCCCC' : '#333333' }}>
                      {new Date(conversation.last_updated).toLocaleDateString()}
                    </p> */}
                  </div>
                </button>
                <div className="absolute right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
                  <ConversationActions
                    conversationId={conversation.id}
                    onRename={onRenameConversation}
                    onDelete={onDeleteConversation}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>
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
          <div className="flex-1 flex items-center space-x-4">
            <p className="text-sm font-semibold" style={{ color: isDarkMode ? '#E0E0E0' : '#333333' }}>Shianco User</p>
            <button className="text-xs font-medium px-1 py-0.5 border-none rounded-md transition-colors overflow-hidden" style={{ color: isDarkMode ? '#E0E0E0' : '#333333' }} onClick={() => setLanguage(language === 'EN' ? 'CN' : 'EN')}>
              <div className="flex items-center">
                <span className={`px-0.5 py-0.5 ${language === 'EN' ? 'bg-purple-gradient text-white font-extrabold rounded-md' : ''}`}>
                  EN
                </span>
                <span style={{ fontWeight: 900 }}>|</span>
                <span className={`px-0.5 py-0.5 ${language === 'CN' ? 'bg-purple-gradient text-white font-extrabold rounded-md' : ''}`}>
                  中文
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Message Bubble Component
const MessageBubble = ({ message, isThinking = false, isDarkMode }) => {
  const isUser = message.sender === 'user';
  const textContent = message.text || ''; // Ensure message.text is not undefined

  const bubbleClasses = `px-4 py-3 rounded-2xl transition-all duration-300 ease-in-out ${
    isUser
      ? 'bg-orange-600 text-white font-medium'
      : `bg-gray-700 font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`
  } ${isThinking ? 'min-w-[100px] max-w-full' : ''} whitespace-pre-wrap`; // Apply min-width for thinking state and preserve formatting

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-orange-600 ml-3' : 'bg-gray-700 mr-3'
        }`}>
          {isUser ? (
            <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>U</span>
          ) : (
            <span className="text-sm font-bold text-white">AI</span>
          )}
        </div>
        
        <div className={bubbleClasses}>
          <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            {textContent}
            {isThinking && <span className="animate-pulse">_</span>} {/* Blinking cursor */}
          </p>
          {!isThinking && message.timestamp && (
            <p className="text-xs opacity-70 mt-1" style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
              {message.timestamp}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// AIResponseBlock Component
const AIResponseBlock = ({ response, isDarkMode }) => {
  const { thinking, answer, isThinkingComplete } = response;
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);

  useEffect(() => {
    if (thinking && !isThinkingComplete) {
      setIsThinkingOpen(true); // Automatically open when thinking starts
    } else if (isThinkingComplete) {
      setIsThinkingOpen(false); // Auto collapse when thinking is complete
    }
  }, [thinking, isThinkingComplete]);

  return (
    <div className="flex justify-start mb-4">
      <div className="flex max-w-3xl flex-row">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>AI</span>
        </div>
        <div className="flex-1 min-w-0">
          {thinking && (
            <div className="mb-2"> {/* Margin between thinking box and answer */}
              <div className={`p-4 rounded-lg shadow-md max-w-full ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsThinkingOpen(!isThinkingOpen)}>
                  <h3 className="text-sm font-semibold" style={{ color: isDarkMode ? '#E0E0E0' : '#333333' }}>
                    {isThinkingComplete ? 'Thinking Complete' : 'Thinking...'}
                  </h3>
                  <ChevronDown className={`w-5 h-5 transition-transform ${isThinkingOpen ? 'rotate-0' : '-rotate-90'}`} style={{ color: isDarkMode ? '#E0E0E0' : '#333333' }} />
                </div>
                <div className={`overflow-y-auto transition-all duration-300 ease-in-out ${isThinkingOpen ? 'max-h-72 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words pl-5 italic" style={{ color: isDarkMode ? '#888888' : '#999999' }}>
                    {thinking}
                    {!isThinkingComplete && <span className="animate-pulse">_</span>} {/* Blinking cursor only during thinking */}
                  </p>
                </div>
              </div>
            </div>
          )}
          {answer && (
            <div className={`px-4 py-3 rounded-2xl font-semibold whitespace-pre-wrap ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-800'}`}>
              <p className="text-sm leading-relaxed">{answer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Suggested Prompts Component
const SuggestedPrompts = ({ prompts, onPromptClick, isDarkMode }) => {
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
            className={`p-4 rounded-xl transition-colors text-left border ${isDarkMode ? 'bg-dark-card border-dark-border hover:bg-dark-border' : 'bg-gray-100 border-gray-200 hover:bg-gray-200'}`}
          >
            <div className="flex items-center space-x-3">
              {IconComponent && (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-dark-input-bg' : 'bg-gray-200'}`}>
                  <IconComponent className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-black'}`} />
                </div>
              )}
              <div>
                <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-dark-text-light' : 'text-gray-700'}`}>
                  {prompt.title}
                </h3>
                <p className={`text-xs ${isDarkMode ? 'text-dark-text-dark' : 'text-gray-700'}`}>
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
const ChatInput = ({ value, onChange, onSend, disabled, onFullScreenToggle, sidebarOpen, isDarkMode }) => {
  const textareaRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Notify parent about full screen state
  useEffect(() => {
    if (onFullScreenToggle) {
      onFullScreenToggle(isFullScreen);
    }
  }, [isFullScreen, onFullScreenToggle]);

  useEffect(() => {
    // When entering/exiting full screen, ensure textarea height is recalculated
    if (textareaRef.current && !isFullScreen) {
      textareaRef.current.style.height = '120px'; // Fixed 3-row height
    }
  }, [isFullScreen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value);
      if (textareaRef.current) {
        textareaRef.current.style.height = '120px'; // Reset height after sending to 3 rows
        setIsFullScreen(false); // Exit full screen if active
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleToggleFullScreen = () => {
    setIsFullScreen(prev => !prev);
    // When entering/exiting full screen, ensure textarea height is recalculated
    if (textareaRef.current) {
      // No longer needed as height is controlled by style prop
    }
  };

  // Calculate the overall height of the ChatInput container
  // Calculate the overall height of the ChatInput container
  // Default height for 3 lines of text + button row + disclaimer + padding
  const defaultChatInputHeight = '236px'; // Approx. 120px (textarea) + 48px (button row) + 20px (disclaimer) + 48px (p-4)
  const fullScreenChatInputHeight = 'calc(100vh - 76px)'; // Adjusted for slightly less height in full screen

  return (
    <div className={`
      fixed bottom-0 z-10
      border-t p-4
      transition-all duration-300 ease-in-out flex flex-col
      ${isDarkMode ? 'border-dark-border bg-dark-background' : 'border-gray-200 bg-white'}
    `} style={{
      left: sidebarOpen ? '288px' : '0px', // Adjust left based on sidebar state (updated for w-72)
      right: '0px' // Ensure it always extends to the right edge
    }}>
      <div className={`mx-auto flex-1 flex flex-col w-full max-w-4xl`}>
        <form onSubmit={handleSubmit} className={`relative flex flex-col h-full`}>
          <div className="relative flex-1 mb-2"> {/* Added mb-2 for consistent spacing */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Send a message..."
              className={`
                w-full pl-4 pr-12 py-3 rounded-xl resize-none
                focus:outline-none focus:ring-2 focus:ring-purple-gradient-start focus:border-transparent
                font-medium
                ${isDarkMode ? 'bg-dark-input-bg border-dark-border placeholder-dark-text-dark' : 'bg-gray-100 border-gray-300 placeholder-gray-500'}
                ${isFullScreen ? 'text-base' : 'text-sm'} overscroll-y-contain
              `}
              rows={isFullScreen ? undefined : 3}
              disabled={disabled}
              style={{ height: isFullScreen ? `calc(${fullScreenChatInputHeight} - 86px)` : '120px', color: isDarkMode ? '#E0E0E0' : '#333333' }} // Explicitly control textarea height
            />
            <button
                type="button"
                onClick={handleToggleFullScreen}
                className={`absolute right-2 top-2 p-2 rounded-xl ${isDarkMode ? 'hover:bg-dark-input-bg text-dark-text-dark' : 'hover:bg-gray-200 text-gray-700'}`}
                aria-label={isFullScreen ? "Minimize" : "Maximize"}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
          </div>
          <div className="flex justify-end items-center mb-2"> {/* Changed mt-2 to mb-2 for consistent spacing */}
            <button
              type="submit"
              disabled={!value.trim() || disabled}
              className="p-2 bg-purple-gradient hover:opacity-90 disabled:bg-dark-border disabled:cursor-not-allowed rounded-xl transition-opacity"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
          {/* Moved inside form to be part of the flex column, but still at the bottom */}
          <p className="text-xs text-center" style={{ color: isDarkMode ? '#CCCCCC' : '#333333' }}>
            Shianco Chat may generate inaccurate information about people, places, or facts.
          </p>
        </form>
      </div>
    </div>
  );
};

// Conversation Actions Dropdown Component
const ConversationActions = ({ conversationId, onRename, onDelete, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleRenameClick = (e) => {
    e.stopPropagation(); // Prevent selecting conversation
    onRename(conversationId);
    setIsOpen(false);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation(); // Prevent selecting conversation
    onDelete(conversationId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-dark-input-bg' : 'hover:bg-transparent'} text-dark-text-dark`}
        aria-label="Conversation actions"
      >
        <MoreVertical className="w-4 h-4" style={{ color: isDarkMode ? '#CCCCCC' : '#333333' }} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-dark-card border border-dark-border rounded-lg shadow-lg z-10">
          <button
            onClick={handleRenameClick}
            className="flex items-center space-x-2 w-full px-4 py-2 text-sm hover:bg-dark-input-bg rounded-t-lg"
            style={{ color: isDarkMode ? '#E0E0E0' : '#333333' }}
          >
            <Pencil className="w-4 h-4" />
            <span>Rename</span>
          </button>
          <button
            onClick={handleDeleteClick}
            className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-dark-input-bg rounded-b-lg"
          >
            <Trash className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      )}
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
  AIResponseBlock, // Export the new component
  ConversationActions // Export the new component
};