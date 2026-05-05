import React, { useState } from 'react';
import { Menu, Settings, Zap, Scale, Brain, Shield, Database, Plus } from 'lucide-react';
import { useLanguage } from '@/LanguageContext';
import { useChat } from '@/ChatContext';
import SettingsSheet from '@/components/SettingsSheet';
import PromptDialog from './PromptDialog';

const TopBar = ({ onToggleSidebar }) => {
  const { t } = useLanguage();
  const {
    availableModels,
    selectedModel,
    modelPolicy,
    modelPolicies,
    handleModelPolicyChange,
    manualModelOverride,
    knowledgeSpaces,
    selectedKnowledgeSpace,
    selectedKnowledgeSpaceId,
    knowledgeSpaceDocuments,
    handleKnowledgeSpaceChange,
    createKnowledgeSpace,
  } = useChat();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleCreateKnowledgeSpace = () => {
    setShowPrompt(true);
  };

  const confirmCreateSpace = async (name) => {
    setShowPrompt(false);
    try {
      await createKnowledgeSpace({ name });
    } catch (error) {
      console.error('Failed to create knowledge space:', error);
    }
  };

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
        
        <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
          {Object.entries(modelPolicies).map(([key, policy]) => {
            const Icon = key === 'fast' ? Zap : key === 'deep' ? Brain : key === 'private' ? Shield : Scale;
            const active = modelPolicy === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleModelPolicyChange(key)}
                title={`${policy.label}: ${policy.description}`}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active ? 'bg-purple-gradient text-white' : 'text-text-secondary hover:bg-hover'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{policy.label}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden lg:block text-xs text-text-secondary truncate max-w-64">
          {availableModels.length === 0
            ? (t.loadingModels || 'Loading models...')
            : `${manualModelOverride ? (t.manualModel || 'Manual') : (t.selectedModel || 'Selected')}: ${selectedModel || 'none'}`}
        </div>

        <div className="hidden md:flex items-center gap-1 rounded-lg bg-surface px-2 py-1.5">
          <Database className="w-3.5 h-3.5 text-text-secondary" />
          <select
            value={selectedKnowledgeSpaceId || ''}
            onChange={(event) => handleKnowledgeSpaceChange(event.target.value)}
            className="max-w-44 text-xs font-medium text-text-primary bg-surface border-none focus:outline-none"
            title={selectedKnowledgeSpace ? `${selectedKnowledgeSpace.name}: ${knowledgeSpaceDocuments.length} sources` : 'Knowledge space'}
          >
            {knowledgeSpaces.length === 0 && (
              <option value="">{t.loadingKnowledge || 'Loading knowledge...'}</option>
            )}
            {knowledgeSpaces.map((space) => (
              <option key={space.id} value={space.id}>{space.name}</option>
            ))}
          </select>
          <span className="hidden xl:inline text-[10px] text-text-secondary">
            {knowledgeSpaceDocuments.length} sources
          </span>
          <button
            type="button"
            onClick={handleCreateKnowledgeSpace}
            className="p-1 rounded-md hover:bg-hover text-text-secondary"
            aria-label={t.newKnowledgeSpace || 'New knowledge space'}
            title={t.newKnowledgeSpace || 'New knowledge space'}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
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
