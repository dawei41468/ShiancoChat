import React, { useRef, useEffect, useState } from 'react';
import { uploadDocument } from '@/services/apiService';
import { Send, Maximize2, Minimize2, Square, Paperclip, FileText, Image, Globe } from 'lucide-react';
import { useLanguage } from '@/LanguageContext';
import { useChat } from '@/ChatContext';
import * as apiService from '@/services/apiService';

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
    fileInput.accept = '.pdf,.doc,.docx,.txt';
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
          <button
            className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-text-primary hover:bg-hover rounded-b-lg"
          >
            <Image className="w-4 h-4" />
            <span>{t.image || "Image"}</span>
          </button>
        </div>
      )}
    </div>
  );
};

const ChatInput = ({ sidebarOpen }) => {
  const textareaRef = useRef(null);
  const { t } = useLanguage();
  const {
    inputValue,
    setInputValue,
    handleSendMessage,
    isTyping,
    isChatInputFullScreen,
    setIsChatInputFullScreen,
    handleStopGeneration,
    currentConversationId,
    setMessages
  } = useChat();
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(true);
  const [isRagEnabled, setIsRagEnabled] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentConversationId) {
      console.warn('No file selected or no active conversation');
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);

    console.group('File Upload Process');
    try {
      console.log('Selected file:', file.name, file.size, file.type);
      
      const formData = new FormData();
      formData.append('file', file);
      console.log('FormData prepared');

      console.log('Making API call to /api/documents/upload');
      const startTime = Date.now();
      const response = await uploadDocument(formData);
      const duration = Date.now() - startTime;
      
      console.log(`Upload completed in ${duration}ms`, response);
      
      // Save document reference to backend without creating a message
      await apiService.saveDocument({
        conversation_id: currentConversationId,
        document_id: response.data.document_id,
        filename: response.data.filename,
        content_type: response.data.content_type
      });
    } catch (error) {
      console.error('Upload failed:', error);
      if (error.response) {
        console.error('Server response:', error.response.data);
      }
    } finally {
      setIsUploading(false);
      console.groupEnd();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isTyping) {
      handleSendMessage(inputValue, isWebSearchEnabled, isRagEnabled);
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
        setIsChatInputFullScreen(false);
      }
      // Reset selected file after sending message to clear the UI element
      setSelectedFile(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleToggleFullScreen = () => {
    setIsChatInputFullScreen(prev => !prev);
  };

  const handleToggleWebSearch = () => {
    setIsWebSearchEnabled(prev => !prev);
  };

  const handleToggleRag = () => {
    setIsRagEnabled(prev => !prev);
  };

  return (
    <div
      className={`fixed bottom-0 z-10 border-t p-4 transition-all duration-300 ease-in-out flex flex-col bg-background border-border ${isChatInputFullScreen ? 'h-[94.1vh]' : ''}`}
      style={{
        left: sidebarOpen ? '288px' : '0px',
        right: '0px',
      }}
    >
      <div className="mx-auto flex-1 flex flex-col w-full max-w-4xl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className={`relative flex-1 flex flex-col rounded-xl bg-surface border-border ${isChatInputFullScreen ? 'h-full' : 'h-[100px]'} focus-within:ring-2 focus-within:ring-purple-gradient-start`}>
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
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
                <button
                  type="button"
                  onClick={handleToggleWebSearch}
                  className={`flex items-center space-x-1 p-1 rounded-lg transition-colors ${
                    isWebSearchEnabled ? 'bg-purple-gradient text-white' : 'bg-surface border border-border hover:bg-hover text-text-secondary'
                  }`}
                  aria-label="Web search"
                >
                  <Globe className="w-4 h-4" />
                  <span className="text-xs font-medium">{t.webSearch || "Web Search"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleToggleRag}
                  className={`flex items-center space-x-1 p-1 rounded-lg transition-colors ${
                    isRagEnabled ? 'bg-blue-500 text-white' : 'bg-surface border border-border hover:bg-hover text-text-secondary'
                  }`}
                  aria-label="RAG search"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-xs font-medium">{t.rag || "RAG"}</span>
                </button>
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