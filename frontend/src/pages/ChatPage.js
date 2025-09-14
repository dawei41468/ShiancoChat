import React, { useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useChat } from '../ChatContext';
import MessageBubble from '@/components/MessageBubble';
import AIResponseBlock from '@/components/AIResponseBlock';
import ChatInput from '@/components/ChatInput';
import SuggestedPrompts from '@/components/SuggestedPrompts';
import ShiancoChatHeader from '@/components/ShiancoChatHeader';

const DocumentViewer = ({ document, onClose }) => {
  if (!document) return null;
  return (
    <div className="fixed top-0 right-0 w-1/3 h-full bg-white p-4 overflow-auto shadow-lg z-50">
      <button onClick={onClose} className="float-right">Close</button>
      <h3>{document.filename}</h3>
      <pre className="whitespace-pre-wrap">{document.content}</pre>
    </div>
  );
};


const ChatPage = ({ sidebarOpen }) => {
  const {
    messages,
    handlePromptClick,
    chatEndRef,
    conversations,
    currentConversationId,
    currentDocument,
    setCurrentDocument,
  } = useChat();
  const { t } = useLanguage();

  const localSuggestedPrompts = [
    {
      id: 'prompt-1',
      titleKey: 'prompt1Title',
      descriptionKey: 'prompt1Description',
      icon: 'Lightbulb',
    },
    {
      id: 'prompt-2',
      titleKey: 'prompt2Title',
      descriptionKey: 'prompt2Description',
      icon: 'FileText',
    },
    {
      id: 'prompt-3',
      titleKey: 'prompt3Title',
      descriptionKey: 'prompt3Description',
      icon: 'Sparkles',
    },
    {
      id: 'prompt-4',
      titleKey: 'prompt4Title',
      descriptionKey: 'prompt4Description',
      icon: 'Globe',
    }
  ];

  // Conversations are fetched and synced by ChatContext via React Query

  return (
    <div className="flex-1 flex flex-col bg-background">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-36">
          <div className="text-center mb-12">
            <div className="mb-4 mx-auto flex flex-col items-center">
              <ShiancoChatHeader
                iconClassName="w-12 h-12"
                textClassName="text-4xl"
              />
            </div>
            <p className="text-lg text-text-secondary">
              {t.welcomeMessage}
            </p>
          </div>
          
          <SuggestedPrompts
            prompts={localSuggestedPrompts}
            onPromptClick={handlePromptClick}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overscroll-y-contain" style={{ paddingBottom: '236px' }}>
          <div className="max-w-4xl mx-auto p-4 space-y-4">
            {messages.map((message, index) => {
              return message.sender === 'user' ? (
                <MessageBubble key={message.id || `user-${index}`} message={message} />
              ) : (
                <AIResponseBlock
                  key={message.id || `ai-${index}`}
                  response={message}
                />
              );
            })}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}

      <ChatInput sidebarOpen={sidebarOpen} />
      <DocumentViewer
        document={currentDocument}
        onClose={() => setCurrentDocument(null)}
      />
    </div>
  );
};

export default ChatPage;