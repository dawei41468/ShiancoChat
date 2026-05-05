import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => jest.fn(),
}));

jest.mock('../ChatContext', () => ({
  useChat: () => ({
    conversations: [],
    currentConversationId: null,
    createNewConversation: jest.fn(),
    selectConversation: jest.fn(),
    deleteConversation: jest.fn(),
    renameConversation: jest.fn(),
  }),
}));

jest.mock('../ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: jest.fn() }),
}));

jest.mock('../LanguageContext', () => ({
  useLanguage: () => ({ t: (key) => key, language: 'en', setLanguage: jest.fn() }),
}));

jest.mock('../AuthContext', () => {
  const React = require('react');
  const AuthContext = React.createContext();
  return {
    __esModule: true,
    AuthContext,
    useAuth: () => React.useContext(AuthContext),
  };
});

const { AuthContext } = require('../AuthContext');

describe('Sidebar admin route visibility', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderWithAuth = (user) => {
    return render(
      <AuthContext.Provider value={{ user, logout: jest.fn(), token: user ? 'token' : null }}>
        <Sidebar isOpen={true} onToggle={jest.fn()} />
      </AuthContext.Provider>
    );
  };

  test('shows Admin Panel link for admin users', async () => {
    renderWithAuth({ id: '1', email: 'admin@example.com', name: 'Admin User', role: 'Admin' });
    // Open the profile dropdown
    const profileButton = screen.getByText('Admin User');
    await userEvent.click(profileButton);
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });

  test('hides Admin Panel link for non-admin users', async () => {
    renderWithAuth({ id: '2', email: 'user@example.com', name: 'Regular User', role: 'User' });
    const profileButton = screen.getByText('Regular User');
    await userEvent.click(profileButton);
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
  });

  test('hides Admin Panel link when not authenticated', async () => {
    renderWithAuth(null);
    // No profile button when not authenticated, just verify it renders
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
  });
});
