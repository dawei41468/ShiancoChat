import React, { useRef, useEffect } from 'react';
import { Send, Maximize2, Minimize2, Square } from 'lucide-react';
import { useLanguage } from '@/LanguageContext';
import { useChat } from '@/ChatContext';

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

  useEffect(() => {
    if (textareaRef.current && !isChatInputFullScreen) {
      textareaRef.current.style.height = '120px';
    }
  }, [isChatInputFullScreen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isTyping) {
      handleSendMessage(inputValue);
      if (textareaRef.current) {
        textareaRef.current.style.height = '120px';
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

  const fullScreenChatInputHeight = 'calc(100vh - 76px)';

  return (
    <div
      className="fixed bottom-0 z-10 border-t p-4 transition-all duration-300 ease-in-out flex flex-col bg-background border-border"
      style={{
        left: sidebarOpen ? '288px' : '0px',
        right: '0px',
      }}
    >
      <div className="mx-auto flex-1 flex flex-col w-full max-w-4xl">
        <form onSubmit={handleSubmit} className="relative flex flex-col h-full">
          <div className="relative flex-1 mb-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t.sendMessage || "Send a message..."}
              className={`
                w-full pl-4 pr-12 py-3 rounded-xl resize-none
                focus:outline-none focus:ring-2 focus:ring-purple-gradient-start focus:border-transparent
                font-medium bg-surface border-border placeholder-text-secondary text-text-primary
                ${isChatInputFullScreen ? 'text-base' : 'text-sm'} overscroll-y-contain
              `}
              rows={isChatInputFullScreen ? undefined : 3}
              disabled={isTyping}
              style={{ height: isChatInputFullScreen ? `calc(${fullScreenChatInputHeight} - 86px)` : '120px' }}
            />
            <button
              type="button"
              onClick={handleToggleFullScreen}
              className="absolute right-2 top-2 p-2 rounded-xl hover:bg-hover text-text-secondary"
              aria-label={isChatInputFullScreen ? t.minimize || "Minimize" : t.maximize || "Maximize"}
            >
              {isChatInputFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex justify-end items-center mb-2">
            {isTyping ? (
              <button
                onClick={handleStopGeneration}
                type="button"
                className="p-2 rounded-xl transition-colors bg-red-600 hover:bg-red-700"
                aria-label="Stop generating"
              >
                <Square className="w-5 h-5 text-white" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className={`p-2 rounded-xl transition-all ${
                  inputValue.trim()
                    ? 'bg-purple-gradient hover:opacity-90'
                    : 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
                }`}
              >
                <Send className={`w-5 h-5 ${inputValue.trim() ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
              </button>
            )}
          </div>
          <p className="text-xs text-center text-text-secondary">
            {t.disclaimer || "Shianco Chat may generate inaccurate information about people, places, or facts."}
          </p>
        </form>
      </div>
    </div>
  );
};

export default ChatInput;