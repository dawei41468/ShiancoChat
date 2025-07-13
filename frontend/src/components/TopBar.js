import React from 'react';
import { useLanguage } from '@/LanguageContext';
import { useChat } from '@/ChatContext';
import ChatBubbleIcon from '@/components/icons/ChatBubbleIcon';

const TopBar = ({ onToggleSidebar }) => {
  const { t } = useLanguage();
  const { availableModels, selectedModel, handleModelChange } = useChat();

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
          <select
            value={selectedModel || ''}
            onChange={(e) => handleModelChange(e.target.value)}
            className="text-sm font-medium text-text-primary bg-surface border-none focus:ring-0"
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default TopBar;