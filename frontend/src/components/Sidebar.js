import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Book, Settings, HelpCircle, Plus, MoreVertical, Pencil, Trash
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useChat } from '../ChatContext';
import { useTheme } from '../ThemeContext'; // Import useTheme
import ChatBubbleIcon from '@/components/icons/ChatBubbleIcon';

// Conversation Actions Dropdown Component
const ConversationActions = ({ conversationId, onRename, onDelete }) => {
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
      e.stopPropagation();
      onRename(conversationId);
      setIsOpen(false);
    };
  
    const handleDeleteClick = (e) => {
      e.stopPropagation();
      onDelete(conversationId);
      setIsOpen(false);
    };
  
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className="p-1 rounded-full hover:bg-hover text-text-secondary"
          aria-label={t.conversationActions || "Conversation actions"}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {isOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-surface border border-border rounded-lg shadow-lg z-10">
            <button
              onClick={handleRenameClick}
              className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-text-primary hover:bg-hover rounded-t-lg"
            >
              <Pencil className="w-4 h-4" />
              <span>{t.rename || "Rename"}</span>
            </button>
            <button
              onClick={handleDeleteClick}
              className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-hover rounded-b-lg"
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
const Sidebar = ({ isOpen }) => {
    const { t } = useLanguage();
    const { conversations, currentConversationId, handleNewChat, handleSelectConversation, handleRenameConversation, handleDeleteConversation } = useChat();
    const location = useLocation();
    const navigate = useNavigate();
    const { theme } = useTheme(); // Get theme from context
  
    const sidebarItems = [
      { icon: Home, label: 'Home', path: '/' },
      { icon: Book, label: 'Tutorials', path: '/tutorials' },
      { icon: Settings, label: 'Settings', path: '/settings' },
      { icon: HelpCircle, label: 'FAQ', path: '/faq' },
    ];
  
    return (
      <div className={`sidebar ${isOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden bg-background border-r border-border flex flex-col`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <ChatBubbleIcon className="w-6 h-6" useGradient={true} isDarkMode={theme === 'dark'} />
              <span className="text-lg font-bold bg-purple-gradient bg-clip-text text-transparent">ShiancoChat</span>
            </div>
          </div>
          
          <button
            onClick={handleNewChat}
            className="w-full flex items-center space-x-2 px-3 py-2 bg-purple-gradient hover:opacity-90 rounded-lg transition-opacity text-white"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">{t.newChat || "New Chat"}</span>
          </button>
        </div>
  
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-text-secondary">
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
                      isActive ? 'bg-purple-gradient text-white' : 'hover:bg-hover text-text-primary'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{t[item.label.toLowerCase().replace(' ', '')] || item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
  
          <div className="p-4 border-t border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-text-secondary">
              {t.recentConversations || "Recent Conversations"}
            </h3>
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`relative group flex items-center w-full rounded-lg transition-colors ${
                    conversation.id === currentConversationId ? 'bg-surface-selected' : 'hover:bg-hover'
                  }`}
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
                    <ChatBubbleIcon className="w-5 h-5" stroke="currentColor" isDarkMode={theme === 'dark'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-text-primary">
                        {t.language === 'CN' ? conversation.title.substring(0, 10) + (conversation.title.length > 10 ? '...' : '') : conversation.title}
                      </p>
                    </div>
                  </button>
                  <div className="absolute right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
                    <ConversationActions
                      conversationId={conversation.id}
                      onRename={handleRenameConversation}
                      onDelete={handleDeleteConversation}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
  
        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-gradient rounded-full flex items-center justify-center flex-shrink-0">
              <ChatBubbleIcon className="w-6 h-6" stroke="#FFFFFF" />
            </div>
            <div className="flex-1 flex items-center space-x-4">
              <p className="text-sm font-semibold mr-4 text-text-primary">{t.userName}</p>
            </div>
          </div>
        </div>
      </div>
    );
};

export default Sidebar;