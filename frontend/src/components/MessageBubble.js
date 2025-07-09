import React from 'react';

const MessageBubble = ({ message, isThinking = false, isDarkMode }) => {
  const isUser = message.sender === 'user';
  const textContent = message.text || ''; // Ensure message.text is not undefined

  const bubbleClasses = `px-4 py-3 rounded-2xl transition-all duration-300 ease-in-out ${
    isUser
      ? 'bg-orange-600 text-white font-medium'
      : `bg-gray-700 font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`
  } ${isThinking ? 'min-w-[100px] max-w-full' : ''} whitespace-pre-wrap`; // Apply min-width for thinking state and preserve formatting

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-orange-600 ml-3' : 'bg-gray-700 mr-3'
        }`}>
          {isUser ? (
            <span className="text-sm font-bold text-white">U</span>
          ) : (
            <span className="text-sm font-bold text-white">AI</span>
          )}
        </div>
        
        <div className={bubbleClasses}>
          <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            {textContent}
            {isThinking && <span className="animate-pulse">_</span>} {/* Blinking cursor */}
          </p>
          {!isThinking && message.timestamp && (
            <p className="text-xs opacity-70 mt-1" style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
              {message.timestamp}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;