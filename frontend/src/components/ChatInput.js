import React, { useRef, useEffect, useState } from 'react';
import { uploadDocument, fetchTools } from '@/services/apiService';
import { Send, Maximize2, Minimize2, Square, Paperclip, FileText, Globe, Workflow, Bot, X } from 'lucide-react';
import { useLanguage } from '@/LanguageContext';
import { useChat } from '@/ChatContext';
import * as apiService from '@/services/apiService';
import { getDepartmentLabel } from '@/utils/departments';

const AttachmentMenu = ({ onFileSelect }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  const { t } = useLanguage();

  React.useEffect(() => {
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

  const triggerFileInput = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.docx,.txt,.xlsx';
    fileInput.onchange = onFileSelect;
    fileInput.click();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-xl hover:bg-hover text-text-secondary"
          aria-label="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>
      </div>
      
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-40 bg-surface border border-border rounded-lg shadow-lg z-10">
          <button
            onClick={triggerFileInput}
            className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-text-primary hover:bg-hover rounded-t-lg"
          >
            <FileText className="w-4 h-4" />
            <span>{t.document || "Document"}</span>
          </button>
        </div>
      )}
    </div>
  );
};

const ChatInput = ({ sidebarOpen }) => {
  const textareaRef = useRef(null);
  const { t, language } = useLanguage();
  const {
    inputValue,
    setInputValue,
    handleSendMessage,
    isTyping,
    isChatInputFullScreen,
    setIsChatInputFullScreen,
    handleStopGeneration,
    workflows,
    selectedWorkflowId,
    handleWorkflowChange,
    currentConversationId,
    selectedKnowledgeSpace,
    selectedKnowledgeSpaceId,
    knowledgeSpaceDocuments,
    fetchSelectedKnowledgeSpace,
    selectedAssistant,
    handleAssistantChange,
    assistants
  } = useChat();
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [isRagEnabled, setIsRagEnabled] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toolConfigs, setToolConfigs] = useState([]);
  const [toolsLoading, setToolsLoading] = useState(true);

  // Fetch tool configs from backend and initialize toggles from default_enabled
  useEffect(() => {
    const loadTools = async () => {
      try {
        const response = await fetchTools();
        const tools = response.data || [];
        setToolConfigs(tools);

        const webSearchTool = tools.find(t => t.id === 'web_search');
        const fileSearchTool = tools.find(t => t.id === 'file_search');

        const savedWeb = localStorage.getItem('default_web_search');
        const savedRag = localStorage.getItem('default_rag');

        if (webSearchTool) {
          const initial = savedWeb !== null ? savedWeb === 'true' : !!webSearchTool.default_enabled;
          setIsWebSearchEnabled(initial);
        } else {
          setIsWebSearchEnabled(false);
        }

        if (fileSearchTool) {
          const initial = savedRag !== null ? savedRag === 'true' : !!fileSearchTool.default_enabled;
          setIsRagEnabled(initial);
        } else {
          setIsRagEnabled(false);
        }
      } catch (error) {
        console.error('Failed to fetch tools:', error);
        const w = localStorage.getItem('default_web_search');
        const r = localStorage.getItem('default_rag');
        if (w !== null) setIsWebSearchEnabled(w === 'true');
        if (r !== null) setIsRagEnabled(r === 'true');
      } finally {
        setToolsLoading(false);
      }
    };
    loadTools();
  }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentConversationId) {
      console.warn('No file selected or no active conversation');
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversation_id', currentConversationId);
      if (selectedKnowledgeSpaceId) {
        formData.append('knowledge_space_id', selectedKnowledgeSpaceId);
      }

      const response = await uploadDocument(formData);

      // Save document reference to backend without creating a message
      await apiService.saveDocument({
        conversation_id: currentConversationId,
        document_id: response.data.document_id,
        filename: response.data.filename,
        content_type: response.data.content_type,
        knowledge_space_id: response.data.knowledge_space_id
      });
      await fetchSelectedKnowledgeSpace(response.data.knowledge_space_id || selectedKnowledgeSpaceId);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isTyping) {
      const sent = await handleSendMessage(inputValue, isWebSearchEnabled, isRagEnabled);
      if (!sent) return;
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
        setIsChatInputFullScreen(false);
      }
      // Reset selected file after sending message to clear the UI element
      setSelectedFile(null);
    }
  };

  const handleKeyDown = (e) => {
    if (slashOpen && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault();
      pickAssistant(slashCandidates[0]);
      return;
    }
    if (slashOpen && e.key === 'Escape') {
      e.preventDefault();
      setSlashDismissed(true);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleToggleFullScreen = () => {
    setIsChatInputFullScreen(prev => !prev);
  };

  const handleToggleWebSearch = () => {
    setIsWebSearchEnabled(prev => {
      const next = !prev;
      localStorage.setItem('default_web_search', String(next));
      return next;
    });
  };

  const handleToggleRag = () => {
    setIsRagEnabled(prev => {
      const next = !prev;
      localStorage.setItem('default_rag', String(next));
      return next;
    });
  };

  const [slashDismissed, setSlashDismissed] = useState(false);

  const slashToken = inputValue.startsWith('/') && !inputValue.includes(' ')
    ? inputValue.slice(1).toLowerCase()
    : null;
  const slashCandidates = slashToken !== null
    ? (assistants || []).filter((assistant) => {
        const nameEn = (assistant.name || '').toLowerCase();
        const nameZh = assistant.name_zh || '';
        return !slashToken || nameEn.startsWith(slashToken) || nameZh.includes(slashToken);
      })
    : [];
  const slashOpen = slashToken !== null && !slashDismissed && slashCandidates.length > 0;

  const pickAssistant = (assistant) => {
    handleAssistantChange(assistant.id);
    setInputValue('');
    setSlashDismissed(false);
    textareaRef.current?.focus();
  };

  const knowledgeSourceCount = knowledgeSpaceDocuments.length;
  const activeKnowledgeName = selectedKnowledgeSpace?.name || 'No knowledge space';

  return (
    <div
      className={`border-t p-4 transition-all duration-300 ease-in-out flex flex-col bg-background border-border ${isChatInputFullScreen ? 'fixed inset-0 z-50 h-screen' : ''}`}
    >
      <div className="mx-auto flex-1 flex flex-col w-full max-w-4xl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className={`relative flex-1 flex flex-col rounded-xl bg-surface border-border ${isChatInputFullScreen ? 'h-full' : 'h-[100px]'} focus-within:ring-2 focus-within:ring-purple-gradient-start`}>
            <div className="relative flex-1">
              {slashOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-surface border border-border rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto">
                  {slashCandidates.map((assistant) => (
                    <button
                      key={assistant.id}
                      type="button"
                      onClick={() => pickAssistant(assistant)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-primary hover:bg-hover"
                    >
                      <Bot className="w-4 h-4 text-text-secondary flex-shrink-0" />
                      <span className="truncate">
                        {language === 'CN' ? (assistant.name_zh || assistant.name) : assistant.name}
                      </span>
                      {assistant.department && (
                        <span className="ml-auto text-[10px] text-text-secondary flex-shrink-0">
                          {getDepartmentLabel(assistant.department, language)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => { setSlashDismissed(false); setInputValue(e.target.value); }}
                onKeyDown={handleKeyDown}
                placeholder={t.sendMessage || "Send a message..."}
                className={`
                  w-full h-full pl-4 pr-12 py-3 rounded-t-xl resize-none no-scrollbar
                  focus:outline-none
                  font-medium bg-transparent placeholder-text-secondary text-text-primary
                  ${isChatInputFullScreen ? 'text-base' : 'text-sm'}
                `}
                disabled={isTyping}
              />
              <button
                type="button"
                onClick={handleToggleFullScreen}
                className="absolute top-2 right-2 p-2 rounded-xl hover:bg-hover text-text-secondary"
                aria-label={isChatInputFullScreen ? t.minimize || "Minimize" : t.maximize || "Maximize"}
              >
                {isChatInputFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex justify-between items-center p-0.5 rounded-b-xl">
              <div className="flex items-center space-x-2">
                <AttachmentMenu onFileSelect={handleFileSelect} />
                <div className="hidden sm:flex items-center gap-1 rounded-lg bg-surface border border-border px-1 py-1">
                  <Workflow className="w-4 h-4 text-text-secondary" />
                  <select
                    value={selectedWorkflowId}
                    onChange={(event) => handleWorkflowChange(event.target.value)}
                    className="max-w-28 bg-transparent text-xs font-medium text-text-primary focus:outline-none"
                    aria-label="Workflow"
                    title="Workflow"
                  >
                    {workflows.map((workflow) => (
                      <option key={workflow.id} value={workflow.id}>{workflow.shortLabel}</option>
                    ))}
                  </select>
                </div>
                {toolConfigs.some(t => t.id === 'web_search') && (
                  <button
                    type="button"
                    onClick={handleToggleWebSearch}
                    disabled={!toolConfigs.find(t => t.id === 'web_search')?.enabled}
                    className={`flex items-center space-x-1 p-1 rounded-lg transition-colors ${
                      isWebSearchEnabled
                        ? 'bg-purple-gradient text-white'
                        : 'bg-surface border border-border hover:bg-hover text-text-secondary'
                    } ${!toolConfigs.find(t => t.id === 'web_search')?.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    aria-label="Web search"
                    title={!toolConfigs.find(t => t.id === 'web_search')?.enabled ? 'Web Search is disabled' : ''}
                  >
                    <Globe className="w-4 h-4" />
                    <span className="text-xs font-medium">{t.webSearch || "Web Search"}</span>
                  </button>
                )}
                {toolConfigs.some(t => t.id === 'file_search') && (
                  <button
                    type="button"
                    onClick={handleToggleRag}
                    disabled={!toolConfigs.find(t => t.id === 'file_search')?.enabled}
                    className={`flex items-center space-x-1 p-1 rounded-lg transition-colors ${
                      isRagEnabled
                        ? 'bg-blue-500 text-white'
                        : 'bg-surface border border-border hover:bg-hover text-text-secondary'
                    } ${!toolConfigs.find(t => t.id === 'file_search')?.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    aria-label="RAG search"
                    title={!toolConfigs.find(t => t.id === 'file_search')?.enabled ? 'File Search is disabled' : `${activeKnowledgeName}: ${knowledgeSourceCount} sources`}
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-xs font-medium">{t.rag || "RAG"}</span>
                  </button>
                )}
                {selectedAssistant && (
                  <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-purple-600 dark:text-purple-300 bg-purple-500/10 border border-purple-500/30">
                    <Bot className="w-3 h-3" />
                    <span className="truncate max-w-[140px]">
                      {language === 'CN' ? (selectedAssistant.name_zh || selectedAssistant.name) : selectedAssistant.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAssistantChange('')}
                      aria-label={t.clearAssistant || 'Clear assistant'}
                      title={t.clearAssistant || 'Clear assistant'}
                      className="hover:text-purple-800 dark:hover:text-purple-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {isRagEnabled && (
                  <div className={`hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${
                    knowledgeSourceCount > 0
                      ? 'text-text-secondary bg-hover'
                      : 'text-amber-600 bg-amber-500/10 border border-amber-500/30'
                  }`}>
                    <FileText className="w-3 h-3" />
                    <span className="truncate max-w-[140px]">{activeKnowledgeName}</span>
                    <span>{knowledgeSourceCount}</span>
                  </div>
                )}
                {(selectedFile || isUploading) && (
                  <div className="flex items-center gap-1 text-xs text-text-secondary bg-hover px-2 py-1 rounded-lg">
                    <FileText className="w-3 h-3" />
                    <span className="truncate max-w-[80px]">{selectedFile?.name}</span>
                    {isUploading ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center">
                {isTyping ? (
                  <button
                    onClick={handleStopGeneration}
                    type="button"
                    className="p-2 rounded-xl transition-colors bg-red-600 hover:bg-red-700"
                    aria-label="Stop generating"
                  >
                    <Square className="w-4 h-4 text-white" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className={`p-2 mx-0.5 rounded-xl transition-all ${
                      inputValue.trim()
                        ? 'bg-purple-gradient hover:opacity-90'
                        : 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
                    }`}
                  >
                    <Send className={`w-4 h-4 ${inputValue.trim() ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-center text-text-secondary mt-2">
            {t.disclaimer || "Shianco Chat may generate inaccurate information about people, places, or facts."}
          </p>
        </form>
      </div>
    </div>
  );
};

export default ChatInput;
