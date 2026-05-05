import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/services/apiService', () => ({
  fetchConversations: jest.fn(),
  createNewChat: jest.fn(),
  fetchMessagesForConversation: jest.fn(),
  saveMessage: jest.fn(),
  fetchAvailableModels: jest.fn(),
  fetchKnowledgeSpaces: jest.fn(),
  fetchKnowledgeSpace: jest.fn(),
  fetchArtifactsForConversation: jest.fn(),
}));

jest.mock('@/services/streaming', () => ({
  streamResponse: jest.fn(),
}));

jest.mock('@/components/ToastNotification', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

import * as apiService from '@/services/apiService';
import { AuthContext } from './AuthContext';
import { ChatProvider, useChat } from './ChatContext';

const mockUser = { email: 'test@example.com', name: 'Test User' };

const TestChatComponent = () => {
  const {
    messages,
    conversations,
    currentConversationId,
    isTyping,
    handleNewChat,
    handleSendMessage,
    inputValue,
    setInputValue,
    availableModels,
    selectedModel,
  } = useChat();

  return (
    <div>
      <div data-testid="conversation-count">{conversations.length}</div>
      <div data-testid="message-count">{messages.length}</div>
      <div data-testid="current-conv">{currentConversationId || 'none'}</div>
      <div data-testid="is-typing">{isTyping ? 'yes' : 'no'}</div>
      <div data-testid="models">{availableModels.join(',')}</div>
      <div data-testid="selected-model">{selectedModel || 'none'}</div>
      <input
        data-testid="input"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      <button onClick={() => handleNewChat()}>New Chat</button>
      <button onClick={() => handleSendMessage(inputValue)}>Send</button>
    </div>
  );
};

const renderWithProviders = (ui, { user = mockUser } = {}) => {
  return render(
    <AuthContext.Provider value={{ user, token: 'test-token' }}>
      <ChatProvider>{ui}</ChatProvider>
    </AuthContext.Provider>
  );
};

describe('ChatContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('initializes and fetches conversations on mount', async () => {
    apiService.fetchConversations.mockResolvedValue({ data: [{ id: 'conv-1', title: 'Chat 1' }] });
    apiService.fetchAvailableModels.mockResolvedValue({ data: { models: ['model-a'] } });
    apiService.fetchKnowledgeSpaces.mockResolvedValue({ data: [] });
    apiService.fetchMessagesForConversation.mockResolvedValue({ data: [] });
    apiService.fetchArtifactsForConversation.mockResolvedValue({ data: [] });

    renderWithProviders(<TestChatComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('conversation-count')).toHaveTextContent('1');
      expect(screen.getByTestId('models')).toHaveTextContent('model-a');
    });
  });

  test('creates new chat when no conversations exist', async () => {
    apiService.fetchConversations.mockResolvedValue({ data: [] });
    apiService.fetchAvailableModels.mockResolvedValue({ data: { models: [] } });
    apiService.fetchKnowledgeSpaces.mockResolvedValue({ data: [] });
    apiService.fetchMessagesForConversation.mockResolvedValue({ data: [] });
    apiService.fetchArtifactsForConversation.mockResolvedValue({ data: [] });
    apiService.createNewChat.mockResolvedValue({ data: { id: 'conv-new', title: 'New Chat' } });

    renderWithProviders(<TestChatComponent />);

    await waitFor(() => {
      expect(apiService.createNewChat).toHaveBeenCalled();
    });
  });

  test('handleSendMessage requires text', async () => {
    apiService.fetchConversations.mockResolvedValue({ data: [{ id: 'conv-1', title: 'Chat 1' }] });
    apiService.fetchAvailableModels.mockResolvedValue({ data: { models: ['model-a'] } });
    apiService.fetchKnowledgeSpaces.mockResolvedValue({ data: [] });
    apiService.fetchMessagesForConversation.mockResolvedValue({ data: [] });
    apiService.fetchArtifactsForConversation.mockResolvedValue({ data: [] });

    renderWithProviders(<TestChatComponent />);

    await waitFor(() => expect(screen.getByTestId('current-conv')).not.toHaveTextContent('none'));

    await userEvent.click(screen.getByText('Send'));
    expect(apiService.saveMessage).not.toHaveBeenCalled();
  });

  test('clears state when no user is present', async () => {
    apiService.fetchConversations.mockResolvedValue({ data: [] });
    apiService.fetchAvailableModels.mockResolvedValue({ data: { models: [] } });
    apiService.fetchKnowledgeSpaces.mockResolvedValue({ data: [] });
    apiService.fetchMessagesForConversation.mockResolvedValue({ data: [] });
    apiService.fetchArtifactsForConversation.mockResolvedValue({ data: [] });

    render(
      <AuthContext.Provider value={{ user: null, token: null }}>
        <ChatProvider><TestChatComponent /></ChatProvider>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('conversation-count')).toHaveTextContent('0');
      expect(screen.getByTestId('current-conv')).toHaveTextContent('none');
    });
  });
});

describe('chooseModelForPolicy', () => {
  const models = [
    'deepseek/deepseek-r1-0528-qwen3-8b',
    'qwen3-32b',
    'gpt-5.2',
    'local-small-fast',
  ];

  it('uses a valid manual override first', () => {
    const { chooseModelForPolicy } = require('./utils/modelPolicy');
    expect(chooseModelForPolicy(models, 'fast', 'qwen3-32b')).toBe('qwen3-32b');
  });

  it('prefers fast models for fast policy', () => {
    const { chooseModelForPolicy } = require('./utils/modelPolicy');
    expect(chooseModelForPolicy(models, 'fast', '')).toBe('local-small-fast');
  });

  it('prefers reasoning-capable models for deep policy', () => {
    const { chooseModelForPolicy } = require('./utils/modelPolicy');
    expect(chooseModelForPolicy(models, 'deep', '')).toBe('deepseek/deepseek-r1-0528-qwen3-8b');
  });
});
