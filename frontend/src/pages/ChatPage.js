import React, { useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useChat } from '../ChatContext';
import MessageBubble from '@/components/MessageBubble';
import AIResponseBlock from '@/components/AIResponseBlock';
import ChatInput from '@/components/ChatInput';
import SuggestedPrompts from '@/components/SuggestedPrompts';


const ChatPage = ({ sidebarOpen }) => {
  const {
    messages,
    handlePromptClick,
    chatEndRef,
    fetchConversations,
    conversations,
    currentConversationId,
  } = useChat();
  const { t } = useLanguage();

  const localSuggestedPrompts = [
    {
      titleKey: 'prompt1Title',
      descriptionKey: 'prompt1Description',
      icon: 'Lightbulb',
    },
    {
      titleKey: 'prompt2Title',
      descriptionKey: 'prompt2Description',
      icon: 'FileText',
    },
    {
      titleKey: 'prompt3Title',
      descriptionKey: 'prompt3Description',
      icon: 'Sparkles',
    },
    {
      titleKey: 'prompt4Title',
      descriptionKey: 'prompt4Description',
      icon: 'Globe',
    }
  ];

  useEffect(() => {
    if (conversations.length === 0 && !currentConversationId) {
      fetchConversations();
    }
  }, [conversations, currentConversationId, fetchConversations]);

  return (
    <div className="flex-1 flex flex-col bg-background">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-24">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-purple-gradient rounded-full flex items-center justify-center mb-4 mx-auto">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-2 bg-purple-gradient bg-clip-text text-transparent">ShiancoChat</h1>
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
            {messages.map((message) => (
              message.sender === 'user' ? (
                <MessageBubble key={message.id} message={message} />
              ) : (
                <AIResponseBlock
                  key={`${message.id}-${message.isThinkingComplete ? 'complete' : 'streaming'}`}
                  response={message}
                />
              )
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}

      <ChatInput sidebarOpen={sidebarOpen} />
    </div>
  );
};

export default ChatPage;