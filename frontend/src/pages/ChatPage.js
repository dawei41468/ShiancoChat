import React, { useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { useChat } from '../ChatContext';
import MessageBubble from '@/components/MessageBubble';
import AIResponseBlock from '@/components/AIResponseBlock';
import ChatInput from '@/components/ChatInput';
import SuggestedPrompts from '@/components/SuggestedPrompts';
import ShiancoChatHeader from '@/components/ShiancoChatHeader';


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