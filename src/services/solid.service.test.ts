import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { SolidCssMcpService } from './solid.service.js';
// Note: `node-fetch` is default export
import fetch from 'node-fetch';


// 👇 This tells Jest to mock node-fetch and to give us a properly typed mock.
jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn()
}));

// 👇 Import the mocked `fetch` AFTER mocking.
const mockedFetch = fetch as unknown as jest.MockedFunction<typeof fetch>;

describe('SolidCssMcpService', () => {
  let service: SolidCssMcpService;

  beforeEach(() => {
    mockedFetch.mockReset();
    service = new SolidCssMcpService();
  });

  it('should authenticate successfully and return a session ID', async () => {
    mockedFetch.mockResolvedValueOnce({
      json: async () => ({
        controls: {
          password: { login: 'http://localhost:3000/.account/login/password' }
        }
      }),
    } as any);

    mockedFetch.mockResolvedValueOnce({
      json: async () => ({
        authorization: 'mock_account_token'
      }),
    } as any);

    mockedFetch.mockResolvedValueOnce({
      json: async () => ({
        controls: {
          account: { clientCredentials: 'http://localhost:3000/.account/my/credentials' }
        }
      }),
    } as any);

    mockedFetch.mockResolvedValueOnce({
      json: async () => ({
        id: 'mock_client_id',
        secret: 'mock_client_secret'
      }),
    } as any);

    mockedFetch.mockResolvedValueOnce({
      json: async () => ({
        access_token: 'mock_access_token'
      }),
    } as any);

    const sessionId = await service.authenticate(
      'test@example.com',
      'password',
      'http://localhost:3000/'
    );

    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
    expect(mockedFetch).toHaveBeenCalledTimes(5);
    expect(mockedFetch.mock.calls[0][0]).toBe('http://localhost:3000/.account/');
    expect(mockedFetch.mock.calls[4][0]).toBe('http://localhost:3000/.oidc/token');
  });

  it('should throw an error if a fetch call fails', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server Error' }),
    } as any);

    await expect(
      service.authenticate(
        'test@example.com',
        'password',
        'http://localhost:3000/'
      )
    ).rejects.toThrow();
  });
});
