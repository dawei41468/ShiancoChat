import React from 'react';
import { useLanguage } from '@/LanguageContext';
import ChatBubbleIcon from '@/components/icons/ChatBubbleIcon';

const TopBar = ({ onToggleSidebar, selectedModel, isDarkMode }) => {
  const { t } = useLanguage();

  return (
    <div className={`h-14 border-b flex items-center justify-between px-4 ${isDarkMode ? 'border-dark-border dark-theme-bg' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-full bg-purple-gradient hover:bg-dark-card transition-colors pointer-events-auto z-50"
          aria-label={t.toggleSidebar || "Toggle Sidebar"}
        >
          <ChatBubbleIcon className="w-6 h-6" stroke="#FFFFFF" />
        </button>
        
        <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-dark-card' : 'bg-gray-100'}`}>
          <span className={`text-sm font-medium ${isDarkMode ? 'text-dark-text-light' : 'text-gray-700'}`}>{selectedModel}</span>
        </div>
      </div>
    </div>
  );
};

export default TopBar;