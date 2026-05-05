import React, { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { useChat } from '../ChatContext';
import MessageBubble from '@/components/MessageBubble';
import AIResponseBlock from '@/components/AIResponseBlock';
import ChatInput from '@/components/ChatInput';
import SuggestedPrompts from '@/components/SuggestedPrompts';
import ShiancoChatHeader from '@/components/ShiancoChatHeader';
import { ThinkingSkeleton } from '@/components/MessageSkeleton';
import ArtifactPanel from '@/components/ArtifactPanel';
import { buildArtifactFromMessage } from '@/utils/artifacts';

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
    fetchConversations,
    conversations,
    currentConversationId,
    currentDocument,
    setCurrentDocument,
    isTyping,
    artifacts,
    createArtifact,
    updateArtifact,
    deleteArtifact,
  } = useChat();
  const { t } = useLanguage();
  const [activeArtifact, setActiveArtifact] = useState(null);

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
      workflowId: 'summary',
    },
    {
      id: 'prompt-3',
      titleKey: 'prompt3Title',
      descriptionKey: 'prompt3Description',
      icon: 'Sparkles',
      workflowId: 'report',
    },
    {
      id: 'prompt-4',
      titleKey: 'prompt4Title',
      descriptionKey: 'prompt4Description',
      icon: 'Globe',
      workflowId: 'translation',
    }
  ];

  const handleOpenArtifact = async (message) => {
    const existingArtifact = artifacts.find((artifact) => artifact.source_message_id === message.id);
    if (existingArtifact) {
      setActiveArtifact(existingArtifact);
      return;
    }

    const draftArtifact = buildArtifactFromMessage(message);
    if (!draftArtifact || !currentConversationId) return;

    const artifact = await createArtifact({
      conversation_id: currentConversationId,
      source_message_id: message.id,
      type: draftArtifact.type,
      title: draftArtifact.title,
      content: draftArtifact.content,
    });
    setActiveArtifact(artifact);
  };

  const handleSaveArtifact = async (artifactId, artifactData) => {
    const artifact = await updateArtifact(artifactId, artifactData);
    setActiveArtifact(artifact);
  };

  const handleDeleteArtifact = async (artifactId) => {
    await deleteArtifact(artifactId);
    setActiveArtifact(null);
  };

  useEffect(() => {
    if (conversations.length === 0 && !currentConversationId) {
      fetchConversations();
    }
  }, [conversations, currentConversationId, fetchConversations]);

  return (
    <div className="flex-1 flex min-w-0 bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
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
          <div className="flex-1 overflow-y-auto overscroll-y-contain">
            <div className="max-w-4xl mx-auto p-4 space-y-4">
              {messages.map((message, index) => {
                return message.sender === 'user' ? (
                  <MessageBubble key={message.id || `user-${index}`} message={message} />
                ) : (
                  <AIResponseBlock
                    key={message.id || `ai-${index}`}
                    response={message}
                    onOpenArtifact={handleOpenArtifact}
                  />
                );
              })}
              {/* Show thinking skeleton when AI is preparing a response */}
              {isTyping && messages.length > 0 && messages[messages.length - 1].sender === 'user' && (
                <ThinkingSkeleton />
              )}
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
      <ArtifactPanel
        artifact={activeArtifact}
        onClose={() => setActiveArtifact(null)}
        onSave={handleSaveArtifact}
        onDelete={handleDeleteArtifact}
      />
    </div>
  );
};

export default ChatPage;
