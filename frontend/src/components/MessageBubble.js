import React from 'react';

const MessageBubble = ({ message, isThinking = false }) => {
  const isUser = message.sender === 'user';
  const textContent = message.text || '';

  const bubbleClasses = `px-4 py-3 rounded-2xl transition-all duration-300 ease-in-out font-medium whitespace-pre-wrap ${
    isUser
      ? 'bg-user-bubble-background text-user-bubble-text'
      : 'bg-surface text-text-primary'
  } ${isThinking ? 'min-w-[100px] max-w-full' : ''}`;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-user-bubble-background text-user-bubble-text ml-3' : 'bg-surface text-text-primary mr-3'
        }`}>
          {isUser ? (
            <span className="text-sm font-bold">U</span>
          ) : (
            <span className="text-sm font-bold">AI</span>
          )}
        </div>
        
        <div className={bubbleClasses}>
          <p className="text-sm leading-relaxed">
            {textContent}
            {isThinking && <span className="animate-pulse">_</span>}
          </p>
          {!isThinking && message.timestamp && (
            <p className="text-xs text-text-secondary opacity-70 mt-1">
              {message.timestamp}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;