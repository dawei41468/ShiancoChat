import React from 'react';
import { useLanguage } from '@/LanguageContext';
import ChatBubbleIcon from '@/components/icons/ChatBubbleIcon';

const TopBar = ({ onToggleSidebar, selectedModel }) => {
  const { t } = useLanguage();

  return (
    <div className="h-14 border-b border-border bg-background flex items-center justify-between px-4">
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-full bg-purple-gradient hover:opacity-90 transition-colors pointer-events-auto z-50"
          aria-label={t.toggleSidebar || "Toggle Sidebar"}
        >
          <ChatBubbleIcon className="w-6 h-6" stroke="#FFFFFF" />
        </button>
        
        <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-surface">
          <span className="text-sm font-medium text-text-primary">{selectedModel}</span>
        </div>
      </div>
    </div>
  );
};

export default TopBar;