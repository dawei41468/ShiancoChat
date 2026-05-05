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

import RegisterPage from './RegisterPage';
const { AuthContext } = require('../AuthContext');

const renderWithAuth = (registerMock) => {
  return render(
    <AuthContext.Provider value={{ register: registerMock }}>
      <RegisterPage />
    </AuthContext.Provider>
  );
};

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders registration form', () => {
    renderWithAuth(jest.fn());

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/department/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  test('validates email format', async () => {
    renderWithAuth(jest.fn());

    const emailInput = screen.getByLabelText(/email/i);
    await userEvent.type(emailInput, 'invalid-email');
    await userEvent.tab();

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  test('validates password requirements', async () => {
    renderWithAuth(jest.fn());

    const passwordInput = screen.getByLabelText(/password/i);
    await userEvent.type(passwordInput, 'short');
    await userEvent.tab();

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 12 characters/i)).toBeInTheDocument();
    });
  });

  test('submits form with valid data', async () => {
    const mockRegister = jest.fn().mockResolvedValue({});
    renderWithAuth(mockRegister);

    await userEvent.type(screen.getByLabelText(/name/i), 'Test User');
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'TestPassword123!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPassword123!',
        department: 'senior_management',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  test('shows error on registration failure', async () => {
    const error = new Error('Registration failed');
    error.response = { data: { detail: 'Email already exists' } };
    const mockRegister = jest.fn().mockRejectedValue(error);
    renderWithAuth(mockRegister);

    await userEvent.type(screen.getByLabelText(/name/i), 'Test User');
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'TestPassword123!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });
});
