import React, { useState, useRef, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Book, Settings, HelpCircle, Plus, MoreVertical, Pencil, Trash, LogOut, User
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useChat } from '../ChatContext';
import { useTheme } from '../ThemeContext';
import { AuthContext } from '../AuthContext';
import ShiancoChatHeader from './ShiancoChatHeader';
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

const ProfileDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { user, logout } = useContext(AuthContext);
    const { t } = useLanguage();
    const navigate = useNavigate();
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
  
    return (
      <div className="relative" ref={menuRef}>
        <button onClick={() => setIsOpen(!isOpen)} className="flex items-center space-x-3 w-full">
          <div className="w-10 h-10 bg-purple-gradient rounded-full flex items-center justify-center flex-shrink-0">
            <ChatBubbleIcon className="w-6 h-6" stroke="#FFFFFF" />
          </div>
          <div className="flex-1 flex items-center space-x-4">
            <p className="text-sm font-semibold mr-4 text-text-primary">{user ? user.name : t.userName}</p>
          </div>
        </button>
        {isOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-surface border border-border rounded-lg shadow-lg z-10">
            <button
              onClick={() => {
                navigate('/settings');
                setIsOpen(false);
              }}
              className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-text-primary hover:bg-hover rounded-t-lg"
            >
              <Settings className="w-4 h-4" />
              <span>{t.settings || "Settings"}</span>
            </button>
            {user && user.role === 'Admin' && (
              <button
                onClick={() => {
                  navigate('/admin');
                  setIsOpen(false);
                }}
                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-text-primary hover:bg-hover"
              >
                <User className="w-4 h-4" />
                <span>{t.adminPanel || "Admin Panel"}</span>
              </button>
            )}
            <hr className="border-border" />
            <button
              onClick={logout}
              className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-hover rounded-b-lg"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.signOut || "Sign Out"}</span>
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
      { icon: HelpCircle, label: 'FAQ', path: '/faq' },
    ];
  
    return (
      <div className={`sidebar ${isOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden bg-background border-r border-border flex flex-col`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <ShiancoChatHeader />
          </div>
          
          <button
            onClick={handleNewChat}
            className="w-full flex items-center space-x-2 px-3 py-2 bg-purple-gradient hover:opacity-90 rounded-lg transition-opacity text-white"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">{t.newChat || "New Chat"}</span>
          </button>
        </div>
  
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 text-text-secondary">
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
  
          <div className="flex-1 flex flex-col p-4 border-t border-border overflow-hidden">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 text-text-secondary flex-shrink-0">
              {t.recentConversations || "Recent Conversations"}
            </h3>
            <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
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
                    className="flex-1 flex items-start space-x-3 p-3 pr-10 text-left overflow-hidden"
                  >
                    <div className={`flex-1 min-w-0 no-scrollbar ${conversation.id === currentConversationId ? 'scroll-on-overflow' : 'group-hover:scroll-on-overflow'}`}>
                      <p className={`text-sm font-medium text-text-primary ${conversation.id !== currentConversationId ? 'truncate' : ''}`}>
                        {conversation.title}
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
          <ProfileDropdown />
        </div>
      </div>
    );
};

export default Sidebar;