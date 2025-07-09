import React, { useRef, useEffect } from 'react';
import { Send, Maximize2, Minimize2, Square } from 'lucide-react';
import { useLanguage } from '@/LanguageContext';
import { useChat } from '@/ChatContext';

const ChatInput = ({ sidebarOpen, isDarkMode }) => {
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
    // When entering/exiting full screen, ensure textarea height is recalculated
    if (textareaRef.current && !isChatInputFullScreen) {
      textareaRef.current.style.height = '120px'; // Fixed 3-row height
    }
  }, [isChatInputFullScreen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isTyping) {
      handleSendMessage(inputValue);
      if (textareaRef.current) {
        textareaRef.current.style.height = '120px'; // Reset height after sending to 3 rows
        setIsChatInputFullScreen(false); // Exit full screen if active
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

  const fullScreenChatInputHeight = 'calc(100vh - 76px)'; // Adjusted for slightly less height in full screen

  return (
    <div className={`
     fixed bottom-0 z-10
     border-t p-4
     transition-all duration-300 ease-in-out flex flex-col
     ${isDarkMode ? 'border-dark-border dark-theme-bg' : 'border-gray-200 bg-white'}
   `} style={{
      left: sidebarOpen ? '288px' : '0px', // Adjust left based on sidebar state (updated for w-72)
      right: '0px' // Ensure it always extends to the right edge
    }}>
      <div className={`mx-auto flex-1 flex flex-col w-full max-w-4xl`}>
        {isTyping && (
          <div className="flex justify-center mb-2">
            <button
              onClick={handleStopGeneration}
              type="button"
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${isDarkMode ? 'bg-dark-card border-dark-border hover:bg-dark-input-bg text-dark-text-light' : 'bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-800'}`}
            >
              <Square className="w-4 h-4" />
              <span>Stop generating</span>
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className={`relative flex flex-col h-full`}>
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
                font-medium
                ${isDarkMode ? 'bg-dark-input-bg border-dark-border placeholder-dark-text-dark' : 'bg-gray-100 border-gray-300 placeholder-gray-500'}
                ${isChatInputFullScreen ? 'text-base' : 'text-sm'} overscroll-y-contain
              `}
              rows={isChatInputFullScreen ? undefined : 3}
              disabled={isTyping}
              style={{ height: isChatInputFullScreen ? `calc(${fullScreenChatInputHeight} - 86px)` : '120px', color: isDarkMode ? '#E0E0E0' : '#333333' }}
            />
            <button
                type="button"
                onClick={handleToggleFullScreen}
                className={`absolute right-2 top-2 p-2 rounded-xl ${isDarkMode ? 'hover:bg-dark-input-bg text-dark-text-dark' : 'hover:bg-gray-200 text-gray-700'}`}
                aria-label={isChatInputFullScreen ? t.minimize || "Minimize" : t.maximize || "Maximize"}
              >
                {isChatInputFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
          </div>
          <div className="flex justify-end items-center mb-2">
            <button type="submit" disabled={!inputValue.trim() || isTyping} className="p-2 bg-purple-gradient hover:opacity-90 disabled:bg-dark-border disabled:cursor-not-allowed rounded-xl transition-opacity">
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
          <p className="text-xs text-center" style={{ color: isDarkMode ? '#CCCCCC' : '#333333' }}>
            {t.disclaimer || "Shianco Chat may generate inaccurate information about people, places, or facts."}
          </p>
        </form>
      </div>
    </div>
  );
};

export default ChatInput;