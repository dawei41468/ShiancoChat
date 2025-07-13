import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Book, Settings, HelpCircle, Plus, MoreVertical, Pencil, Trash
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useChat } from '../ChatContext';
import ChatBubbleIcon from '@/components/icons/ChatBubbleIcon';

// Conversation Actions Dropdown Component
const ConversationActions = ({ conversationId, onRename, onDelete, isDarkMode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    const { t } = useLanguage();
  
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
          aria-label={t.conversationActions || "Conversation actions"}
        >
          <MoreVertical className="w-4 h-4" style={{ color: isDarkMode ? '#CCCCCC' : '#333333' }} />
        </button>
        {isOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-dark-card border border-dark-border rounded-lg shadow-lg z-10">
            <button
              onClick={handleRenameClick}
              className={`flex items-center space-x-2 w-full px-4 py-2 text-sm rounded-t-lg transition-colors ${
                isDarkMode ? 'hover:bg-dark-input-bg' : 'hover:bg-gray-200'
              }`}
              style={{ color: isDarkMode ? '#E0E0E0' : '#333333' }}
            >
              <Pencil className="w-4 h-4" />
              <span>{t.rename || "Rename"}</span>
            </button>
            <button
              onClick={handleDeleteClick}
              className={`flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-500 rounded-b-lg transition-colors ${
                isDarkMode ? 'hover:bg-dark-input-bg' : 'hover:bg-gray-200'
              }`}
            >
              <Trash className="w-4 h-4" />
              <span>{t.delete || "Delete"}</span>
            </button>
          </div>
        )}
      </div>
    );
};

// Sidebar Component
const Sidebar = ({ isOpen, isDarkMode }) => {
    const { t } = useLanguage();
    const { conversations, currentConversationId, handleNewChat, handleSelectConversation, handleRenameConversation, handleDeleteConversation } = useChat();
    const location = useLocation();
    const navigate = useNavigate();
  
    const sidebarItems = [
      { icon: Home, label: 'Home', path: '/' },
      { icon: Book, label: 'Tutorials', path: '/tutorials' },
      { icon: Settings, label: 'Settings', path: '/settings' },
      { icon: HelpCircle, label: 'FAQ', path: '/faq' },
    ];
  
    return (
      <div className={`sidebar ${isOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden ${isDarkMode ? 'dark-theme-bg border-r border-dark-border' : 'bg-white border-r border-gray-200'} flex flex-col`}>
        <div className="p-4 border-b border-dark-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <ChatBubbleIcon className="w-6 h-6" useGradient={true} isDarkMode={isDarkMode} />
              <span className="text-lg font-bold bg-purple-gradient bg-clip-text text-transparent">ShiancoChat</span>
            </div>
          </div>
          
          <button
            onClick={handleNewChat}
            className="w-full flex items-center space-x-2 px-3 py-2 bg-purple-gradient hover:opacity-90 rounded-lg transition-opacity"
          >
            <Plus className="w-5 h-5 text-white" />
            <span className="font-medium" style={{ color: '#FFFFFF' }}>{t.newChat || "New Chat"}</span>
          </button>
        </div>
  
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: isDarkMode ? '#CCCCCC' : '#333333' }}>
              {t.navigation || "Navigation"}
            </h3>
            <nav className="space-y-1">
              {sidebarItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-left ${
                      isActive
                        ? 'bg-purple-gradient text-white'
                        : `${isDarkMode ? 'hover:bg-dark-card text-dark-text-light' : 'hover:bg-gray-100 text-black'}`
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{t[item.label.toLowerCase().replace(' ', '')] || item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
  
          <div className="p-4 border-t border-dark-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: isDarkMode ? '#CCCCCC' : '#333333' }}>
              {t.recentConversations || "Recent Conversations"}
            </h3>
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`relative group flex items-center w-full rounded-lg transition-colors
                    ${conversation.id === currentConversationId ? (isDarkMode ? 'bg-dark-card-selected' : 'bg-gray-200') : (isDarkMode ? 'hover:bg-dark-card' : 'hover:bg-gray-100')}`}
                >
                  <button
                    onClick={() => {
                      if (conversation.id !== currentConversationId) {
                        handleSelectConversation(conversation.id);
                        navigate('/');
                      }
                    }}
                    className="flex-1 flex items-start space-x-3 p-3 text-left"
                  >
                    <ChatBubbleIcon className="w-5 h-5" stroke="currentColor" isDarkMode={isDarkMode} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: isDarkMode ? '#E0E0E0' : '#333333' }}>
                        {t.language === 'CN' ? conversation.title.substring(0, 10) + (conversation.title.length > 10 ? '...' : '') : conversation.title}
                      </p>
                    </div>
                  </button>
                  <div className="absolute right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
                    <ConversationActions
                      conversationId={conversation.id}
                      onRename={handleRenameConversation}
                      onDelete={handleDeleteConversation}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
  
        <div className="p-4 border-t border-dark-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-gradient rounded-full flex items-center justify-center flex-shrink-0">
              <ChatBubbleIcon className="w-6 h-6" stroke="#FFFFFF" />
            </div>
            <div className="flex-1 flex items-center space-x-4">
              <p className="text-sm font-semibold mr-4" style={{ color: isDarkMode ? '#E0E0E0' : '#333333' }}>{t.userName}</p>
            </div>
          </div>
        </div>
      </div>
    );
};

export default Sidebar;