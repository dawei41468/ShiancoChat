import React, { useState } from 'react';
import { Menu, Settings } from 'lucide-react';
import { useLanguage } from '@/LanguageContext';
import { useChat } from '@/ChatContext';
import SettingsSheet from '@/components/SettingsSheet';

const TopBar = ({ onToggleSidebar }) => {
  const { t } = useLanguage();
  const { availableModels, selectedModel, handleModelChange } = useChat();

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="h-14 border-b border-border bg-background flex items-center justify-between px-4">
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md bg-purple-gradient hover:opacity-90 transition-colors pointer-events-auto z-50"
          aria-label={t.toggleSidebar || "Toggle Sidebar"}
        >
          <Menu className="w-4 h-4 text-white" />
        </button>
        
        <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-surface">
          <select
            value={selectedModel || ''}
            onChange={(e) => handleModelChange(e.target.value)}
            className="text-sm font-medium text-text-primary bg-surface border-none"
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-md hover:bg-hover text-text-primary"
          aria-label={t.settings || 'Settings'}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
;

export default TopBar;