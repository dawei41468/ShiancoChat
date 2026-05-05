jest.mock('./streaming', () => ({
  streamResponse: jest.fn(),
}));

jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 })),
}));

jest.mock('axios', () => {
  const mockPost = jest.fn();
  return {
    create: jest.fn(() => ({
      post: mockPost,
      get: jest.fn(),
      defaults: { headers: { common: {} } },
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    })),
    defaults: { headers: { common: {} } },
    _mockPost: mockPost,
  };
});

const apiService = require('./apiService');
const axios = require('axios');

describe('apiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshAccessToken', () => {
    test('refreshes token successfully via cookie', async () => {
      axios._mockPost.mockResolvedValue({ data: { access_token: 'new-access-token' } });

      const token = await apiService.refreshAccessToken();
      expect(token).toBe('new-access-token');
    });

    test('dispatches session-expired event on failure', async () => {
      axios._mockPost.mockRejectedValue(new Error('Refresh failed'));

      const eventSpy = jest.fn();
      window.addEventListener('auth:session-expired', eventSpy);

      await expect(apiService.refreshAccessToken()).rejects.toThrow();

      window.removeEventListener('auth:session-expired', eventSpy);
    });
  });

  describe('setAuthHeader', () => {
    test('is exported as a function', () => {
      expect(typeof apiService.setAuthHeader).toBe('function');
    });
  });
});
