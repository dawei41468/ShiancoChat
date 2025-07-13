import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4100';

const apiClient = axios.create({
  baseURL: BACKEND_URL,
});

export const fetchConversations = () => {
  return apiClient.get('/api/chat/conversations');
};

export const fetchMessagesForConversation = (conversationId) => {
  return apiClient.get(`/api/chat/conversations/${conversationId}/messages`);
};

export const createNewChat = (title) => {
  return apiClient.post('/api/chat/new', { title });
};

export const renameConversation = (conversationId, newTitle) => {
  return apiClient.put(`/api/chat/conversations/${conversationId}`, { new_title: newTitle });
};

export const deleteConversation = (conversationId) => {
  return apiClient.delete(`/api/chat/conversations/${conversationId}`);
};
export const fetchAvailableModels = () => {
  return apiClient.get('/api/llm/models');
};

export const streamChatResponse = async (payload, { onData, onComplete, onError, signal }) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let inThinkingBlock = false;
    let thinkingContent = '';
    let answerContent = '';

    const processSSE = (sseData) => {
      let remainingText = sseData;

      if (!inThinkingBlock && remainingText.includes('<think>')) {
        inThinkingBlock = true;
        const parts = remainingText.split('<think>', 2);
        answerContent += parts[0];
        remainingText = parts[1];
      }

      if (inThinkingBlock) {
        if (remainingText.includes('</think>')) {
          const parts = remainingText.split('</think>', 2);
          thinkingContent += parts[0];
          remainingText = parts[1];
          inThinkingBlock = false;
        } else {
          thinkingContent += remainingText;
          remainingText = '';
        }
      }

      if (!inThinkingBlock && remainingText) {
        answerContent += remainingText;
      }

      onData({
        thinking: thinkingContent,
        answer: answerContent,
        isThinkingComplete: !inThinkingBlock,
      });
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        onComplete({ thinking: thinkingContent, answer: answerContent });
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let messageEndIndex;
      while ((messageEndIndex = buffer.indexOf('\n\n')) !== -1) {
        const messageBlock = buffer.substring(0, messageEndIndex);
        buffer = buffer.substring(messageEndIndex + 2);

        const lines = messageBlock.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            processSSE(line.substring('data: '.length));
          }
        }
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      onError(error);
    }
  }
};