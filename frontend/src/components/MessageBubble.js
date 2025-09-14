import React from 'react';
import { useChat } from '@/ChatContext';

const MessageBubble = ({ message, isThinking = false }) => {
  const isUser = message.sender === 'user';
  let displayContent = message.text || '';
  let ragIndicator = null;
  
  if (message.is_file_upload) {
    return null; // Don't render anything for file uploads
  }
  
  // Check for RAG indicators in message metadata if available
  if (!isUser && message.metadata) {
    if (message.metadata.rag === 'true') {
      ragIndicator = <span className="text-xs text-blue-400 mr-1">RAG Active</span>;
    } else if (message.metadata.rag === 'results') {
      ragIndicator = <span className="text-xs text-blue-400 mr-1">RAG Results Used</span>;
    }
  }

  const bubbleClasses = `px-4 py-3 rounded-2xl transition-all duration-300 ease-in-out font-medium whitespace-pre-wrap ${
    isUser
      ? 'bg-user-bubble-background text-user-bubble-text'
      : 'bg-surface text-text-primary'
  } ${isThinking ? 'min-w-[100px] max-w-full' : ''}`;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
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
            {displayContent}
            {isThinking && <span className="animate-pulse">_</span>}
          </p>
          {ragIndicator && (
            <div className="mt-1 flex items-center">
              {ragIndicator}
            </div>
          )}
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