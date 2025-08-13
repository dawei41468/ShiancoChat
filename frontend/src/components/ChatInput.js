import React, { useRef, useEffect, useState } from 'react';
import { Send, Maximize2, Minimize2, Square, Paperclip, FileText, Image, Globe } from 'lucide-react';
import { useLanguage } from '@/LanguageContext';
import { useChat } from '@/ChatContext';

const AttachmentMenu = () => {
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl hover:bg-hover text-text-secondary"
        aria-label="Attach file"
      >
        <Paperclip className="w-5 h-5" />
      </button>
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-40 bg-surface border border-border rounded-lg shadow-lg z-10">
          <button
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
  } = useChat();
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isTyping) {
      handleSendMessage(inputValue, isWebSearchEnabled);
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
        setIsChatInputFullScreen(false);
      }
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
                <AttachmentMenu />
                <button
                  type="button"
                  onClick={handleToggleWebSearch}
                  className={`flex items-center space-x-1 p-1 rounded-lg transition-colors ${
                    isWebSearchEnabled ? 'bg-purple-gradient text-white' : 'hover:bg-hover text-text-secondary'
                  }`}
                  aria-label="Web search"
                >
                  <Globe className="w-4 h-4" />
                  <span className="text-xs font-medium">{t.webSearch || "Web Search"}</span>
                </button>
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