import { useState, useRef, useCallback, useEffect } from 'react';
import * as apiService from '@/services/apiService';
import { processAssistantMessage } from '@/utils/messages';
import { applyWorkflowInstruction } from '@/utils/workflows';

export function useMessages({
  user,
  currentConversationId,
  conversations,
  selectedModel,
  selectedKnowledgeSpaceId,
  showToast,
  fetchConversations,
}) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const lastMessageCountRef = useRef(0);
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    try {
      const response = await apiService.fetchMessagesForConversation(conversationId);
      setMessages(response.data.map(msg =>
        msg.sender === 'assistant' ? processAssistantMessage(msg) : {
          ...msg,
          timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ));
    } catch (error) {
      console.error('Error fetching messages:', error);
      showToastRef.current('Failed to load messages', 'error');
      setMessages([]);
    }
  }, []);

  const handleSendMessage = async (text, isWebSearchEnabled = false, isRagEnabled = true, workflowId = null) => {
    if (!text || !text.trim()) return false;
    if (!user) {
      showToast('Please log in before sending a message', 'error');
      return false;
    }
    if (!currentConversationId) {
      showToast('No active conversation is ready yet', 'error');
      return false;
    }
    if (!selectedModel) {
      showToast('No model is available. Check that the LLM server is running.', 'error');
      return false;
    }

    // Save user message
    const userMessagePayload = {
      conversation_id: currentConversationId,
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString(),
    };
    const savedUserMessageResponse = await apiService.saveMessage(userMessagePayload);
    const savedUserMessage = {
      ...savedUserMessageResponse.data,
      timestamp: new Date(savedUserMessageResponse.data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, savedUserMessage]);
    setInputValue('');
    setIsTyping(true);

    // Update title on first message
    const userMessages = messages.filter(m => m.sender === 'user');
    if (userMessages.length === 0) {
      const words = savedUserMessage.text.split(/\s+/);
      const summary = words.slice(0, 5).join(' ');
      const newTitle = words.length > 5 ? `${summary}...` : summary;
      apiService.renameConversation(currentConversationId, newTitle)
        .then(() => fetchConversations())
        .catch(err => console.error('Error renaming conversation:', err));
    }

    // Prepare AI response placeholder
    const aiResponseId = Date.now().toString();
    const aiResponsePlaceholder = {
      id: aiResponseId,
      conversation_id: currentConversationId,
      sender: 'assistant',
      thinking: '',
      answer: '',
      isThinkingComplete: false,
      thinkingStartTime: Date.now(),
      thinkingDuration: 0,
      webSearchState: undefined,
      ragState: undefined,
      isPreparing: true,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, aiResponsePlaceholder]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const streamPayload = {
      conversation_id: currentConversationId,
      text: applyWorkflowInstruction(text, workflowId),
      model: selectedModel,
      knowledge_space_id: selectedKnowledgeSpaceId,
    };

    const updateAIResponse = (updater) => {
      setMessages(prev => prev.map(msg => (msg.id === aiResponseId ? updater(msg) : msg)));
    };

    // Stream and process AI response
    try {
      const finalMessageState = { ...aiResponsePlaceholder };
      const iterator = apiService.streamChatResponse(streamPayload, {
        signal: controller.signal,
        webSearchEnabled: isWebSearchEnabled,
        ragEnabled: isRagEnabled,
      });

      for await (const event of iterator) {
        switch (event.event) {
          case 'thread.run.step.in_progress':
            if (finalMessageState.isPreparing) {
              finalMessageState.isPreparing = false;
              updateAIResponse(msg => ({ ...msg, isPreparing: false }));
            }
            finalMessageState.thinking += event.data.details;
            updateAIResponse(msg => ({ ...msg, thinking: finalMessageState.thinking }));
            break;
          case 'thread.message.delta':
            if (finalMessageState.isPreparing) {
              finalMessageState.isPreparing = false;
              updateAIResponse(msg => ({ ...msg, isPreparing: false }));
            }
            if (finalMessageState.thinking && !finalMessageState.isThinkingComplete) {
              finalMessageState.isThinkingComplete = true;
              finalMessageState.thinkingDuration = (Date.now() - finalMessageState.thinkingStartTime) / 1000;
            }
            finalMessageState.answer += event.data.content;
            updateAIResponse(msg => ({
              ...msg,
              answer: finalMessageState.answer,
              isThinkingComplete: finalMessageState.isThinkingComplete,
              thinkingDuration: finalMessageState.thinkingDuration,
            }));
            break;
          case 'status.websearch': {
            const val = event.data?.value;
            if (val === 'false' && (finalMessageState.webSearchState === 'results' || finalMessageState.webSearchState === 'no_results')) {
              break;
            }
            finalMessageState.webSearchState = val;
            updateAIResponse(msg => ({ ...msg, webSearchState: finalMessageState.webSearchState }));
            break;
          }
          case 'status.rag': {
            const val = event.data?.value;
            if (val === 'false' && (finalMessageState.ragState === 'results' || finalMessageState.ragState === 'no_results')) {
              break;
            }
            finalMessageState.ragState = val;
            updateAIResponse(msg => ({ ...msg, ragState: finalMessageState.ragState }));
            break;
          }
          case 'citations':
            finalMessageState.citations = event.data?.items || [];
            updateAIResponse(msg => ({ ...msg, citations: finalMessageState.citations }));
            break;
          case 'thread.run.completed':
            if (finalMessageState.isPreparing) {
              finalMessageState.isPreparing = false;
              updateAIResponse(msg => ({ ...msg, isPreparing: false }));
            }
            if (!finalMessageState.isThinkingComplete) {
              finalMessageState.isThinkingComplete = true;
              finalMessageState.thinkingDuration = (Date.now() - finalMessageState.thinkingStartTime) / 1000;
            }

            const messageToSave = {
              conversation_id: finalMessageState.conversation_id,
              sender: 'assistant',
              text: `<think>${finalMessageState.thinking}</think><answer>${finalMessageState.answer}</answer>`,
              thinking_duration: finalMessageState.thinkingDuration,
              timestamp: new Date().toISOString(),
              citations: finalMessageState.citations || [],
              web_search_state: finalMessageState.webSearchState === 'false' ? undefined : finalMessageState.webSearchState,
              rag_state: finalMessageState.ragState,
            };

            const savedAssistantMessage = await apiService.saveMessage(messageToSave);
            const processedMessage = processAssistantMessage(savedAssistantMessage.data);
            const mergedMessage = {
              ...processedMessage,
              citations: finalMessageState.citations || [],
              webSearchState: finalMessageState.webSearchState === 'false' ? undefined : finalMessageState.webSearchState,
              ragState: finalMessageState.ragState,
              isPreparing: false,
            };
            setMessages(prev => prev.map(m => (m.id === aiResponseId ? mergedMessage : m)));

            const currentConversation = conversations.find(c => c.id === currentConversationId);
            if (currentConversation && currentConversation.title === 'New Chat') {
              apiService.generateConversationTitle(currentConversationId, selectedModel)
                .then(() => fetchConversations())
                .catch(err => console.error('Error generating title:', err));
            }
            break;
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error during streaming:', error);
        let errorMessage;
        if (error.name === 'ToolForbiddenError' || error.status === 403 || error.message?.includes('disabled for your role')) {
          errorMessage = error.message || 'This tool is disabled for your role';
          showToast(errorMessage, 'warning');
        } else if (error.message?.includes('Session expired')) {
          errorMessage = 'Session expired. Please log in again.';
          showToast(errorMessage, 'error');
        } else {
          errorMessage = 'Error: Could not get a response. Please try again.';
          showToast(errorMessage, 'error');
        }
        updateAIResponse(msg => ({ ...msg, answer: errorMessage, isThinkingComplete: true }));
      }
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
    return true;
  };

  const handlePromptClick = (prompt) => {
    handleSendMessage(prompt.description, false, true, prompt.workflowId || null);
  };

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsTyping(false);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessageIndex = newMessages.length - 1;
        if (lastMessageIndex >= 0 && newMessages[lastMessageIndex].sender === 'assistant') {
          const lastMessage = newMessages[lastMessageIndex];
          newMessages[lastMessageIndex] = {
            ...lastMessage,
            answer: lastMessage.answer ? lastMessage.answer + ' [Stopped]' : 'Generation stopped.',
            isThinkingComplete: true,
          };
        }
        return newMessages;
      });
    }
  }, []);

  const appendMessage = useCallback((message) => {
    setMessages(prev => [...prev, { ...message, timestamp: new Date().toISOString() }]);
  }, []);

  return {
    messages,
    setMessages,
    isTyping,
    setIsTyping,
    inputValue,
    setInputValue,
    chatEndRef,
    lastMessageCountRef,
    scrollToBottom,
    fetchMessages,
    handleSendMessage,
    handlePromptClick,
    handleStopGeneration,
    appendMessage,
  };
}
