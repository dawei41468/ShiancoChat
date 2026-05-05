import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../AuthContext', () => {
  const React = require('react');
  const AuthContext = React.createContext({});
  return {
    __esModule: true,
    AuthContext,
    useAuth: () => React.useContext(AuthContext),
  };
});

jest.mock('../components/ShiancoChatHeader', () => () => <div>ShiancoChat</div>);
jest.mock('../components/ThemeToggle', () => () => <button>Theme</button>);
jest.mock('../components/icons/EyeIcon', () => ({ isOpen }) => <span>{isOpen ? 'open' : 'closed'}</span>);

import LoginPage from './LoginPage';
const { AuthContext } = require('../AuthContext');

const renderWithAuth = (loginMock) => {
  return render(
    <AuthContext.Provider value={{ login: loginMock }}>
      <LoginPage />
    </AuthContext.Provider>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login form', () => {
    renderWithAuth(jest.fn());

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  test('submits form with email and password', async () => {
    const mockLogin = jest.fn().mockResolvedValue({});
    renderWithAuth(mockLogin);

    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  test('shows error on login failure', async () => {
    const mockLogin = jest.fn().mockRejectedValue(new Error('Invalid credentials'));
    renderWithAuth(mockLogin);

    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to log in/i)).toBeInTheDocument();
    });
  });

  test('toggles password visibility', async () => {
    renderWithAuth(jest.fn());

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'closed' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
