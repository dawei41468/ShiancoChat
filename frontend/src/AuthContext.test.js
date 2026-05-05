import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('./services/apiService', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  register: jest.fn(),
  getCurrentUser: jest.fn(),
  refreshAccessToken: jest.fn(),
  setAuthHeader: jest.fn(),
}));

import * as apiService from './services/apiService';
import { AuthProvider, useAuth } from './AuthContext';

const TestComponent = () => {
  const { user, token, login, logout, isLoading } = useAuth();
  if (isLoading) return <div>Loading</div>;
  return (
    <div>
      <div data-testid="user">{user?.email || 'no-user'}</div>
      <div data-testid="token">{token || 'no-token'}</div>
      <button onClick={() => login('test@example.com', 'password123')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('login stores token and user', async () => {
    apiService.login.mockResolvedValue({
      data: { access_token: 'acc-token', refresh_token: 'ref-token' }
    });
    apiService.getCurrentUser.mockResolvedValue({
      data: { email: 'test@example.com', name: 'Test User' }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading')).not.toBeInTheDocument());

    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('token')).toHaveTextContent('acc-token');
    });
  });

  test('logout clears auth state', async () => {
    apiService.getCurrentUser.mockResolvedValue({
      data: { email: 'test@example.com', name: 'Test User' }
    });
    apiService.logout.mockResolvedValue({});

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading')).not.toBeInTheDocument());

    await userEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      expect(screen.getByTestId('token')).toHaveTextContent('no-token');
    });
  });

  test('session-expired event clears auth state', async () => {
    apiService.getCurrentUser.mockResolvedValue({
      data: { email: 'test@example.com', name: 'Test User' }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.queryByText('Loading')).not.toBeInTheDocument());
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');

    await act(async () => {
      window.dispatchEvent(new Event('auth:session-expired'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('token')).toHaveTextContent('no-token');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });
  });
});
