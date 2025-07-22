import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SolidCssMcpService, SolidToolError } from './solid.service.js';
import fetch from 'node-fetch';

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn()
}));
const mockedFetch = fetch as unknown as jest.MockedFunction<typeof fetch>;

const generateDpopKeyPair = jest.fn(() => Promise.resolve('mockDpopKey'));
const createDpopHeader = jest.fn(() => Promise.resolve('mockDpopHeader'));
const buildAuthenticatedFetch = jest.fn(() => Promise.resolve('mockAuthFetch'));

jest.mock('@inrupt/solid-client-authn-core', () => ({
  generateDpopKeyPair,
  createDpopHeader,
  buildAuthenticatedFetch,
}));

const mockSolidClient: any = {
  getSolidDataset: jest.fn(),
  getThing: jest.fn(),
  getUrl: jest.fn(),
  getFile: jest.fn(),
  overwriteFile: jest.fn(),
  getContainedResourceUrlAll: jest.fn(),
  deleteFile: jest.fn(),
  createThing: jest.fn(),
  setStringNoLocale: jest.fn(),
  setThing: jest.fn(),
  saveSolidDatasetAt: jest.fn(),
  universalAccess: { setAgentAccess: jest.fn() },
};
jest.mock('@inrupt/solid-client', () => mockSolidClient);

jest.mock('crypto', () => ({ randomUUID: jest.fn(() => 'mock-uuid') }));

describe('SolidCssMcpService', () => {
  let service: SolidCssMcpService;
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, SOLID_EMAIL: 'test@example.com', SOLID_PASSWORD: 'pw' };
    service = new SolidCssMcpService();
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  describe('authenticate', () => {
    it('should authenticate successfully and return a session ID', async () => {
      mockedFetch.mockResolvedValueOnce({ json: async () => ({ controls: { password: { login: 'login-url' } } }) } as any);
      mockedFetch.mockResolvedValueOnce({ json: async () => ({ authorization: 'auth-token' }) } as any);
      mockedFetch.mockResolvedValueOnce({ json: async () => ({ controls: { account: { clientCredentials: 'cred-url' } } }) } as any);
      mockedFetch.mockResolvedValueOnce({ json: async () => ({ id: 'cid', secret: 'csecret' }) } as any);
      mockedFetch.mockResolvedValueOnce({ json: async () => ({ access_token: 'atoken' }) } as any);
      const sessionId = await service.authenticate('http://localhost:3000/');
      expect(sessionId).toBe('mock-uuid');
    });
    it('should throw if env vars are missing', async () => {
      process.env.SOLID_EMAIL = '';
      await expect(service.authenticate('http://localhost:3000/')).rejects.toThrow('SOLID_EMAIL and SOLID_PASSWORD environment variables must be set.');
    });
    it('should throw if fetch fails', async () => {
      mockedFetch.mockRejectedValueOnce(new Error('fail'));
      await expect(service.authenticate('http://localhost:3000/')).rejects.toThrow('fail');
    });
  });

  describe('getAuthFetch', () => {
    it('should throw if sessionId is missing', () => {
      expect(() => service.getAuthFetch('')).toThrow("A 'sessionId' is required for this operation.");
    });
    it('should throw if sessionId is invalid', () => {
      expect(() => service.getAuthFetch('invalid')).toThrow('Invalid or expired session. Please login again.');
    });
    it('should return authFetch if sessionId is valid', async () => {
      // Simulate login
      mockedFetch.mockResolvedValue({ json: async () => ({ controls: { password: { login: 'login-url' } } }) } as any);
      mockedFetch.mockResolvedValue({ json: async () => ({ authorization: 'auth-token' }) } as any);
      mockedFetch.mockResolvedValue({ json: async () => ({ controls: { account: { clientCredentials: 'cred-url' } } }) } as any);
      mockedFetch.mockResolvedValue({ json: async () => ({ id: 'cid', secret: 'csecret' }) } as any);
      mockedFetch.mockResolvedValue({ json: async () => ({ access_token: 'atoken' }) } as any);
      const sessionId = await service.authenticate('http://localhost:3000/');
      expect(service.getAuthFetch(sessionId)).toBe('mockAuthFetch');
    });
  });

  describe('discoverPod', () => {
    it('should discover pod storage successfully', async () => {
      mockSolidClient.getSolidDataset.mockResolvedValue('mockDataset');
      mockSolidClient.getThing.mockReturnValue('mockThing');
      mockSolidClient.getUrl.mockReturnValue('podUrl');
      const podUrl = await service.discoverPod('webId', 'sessionId');
      expect(podUrl).toBe('podUrl');
    });
    it('should throw if profile Thing is missing', async () => {
      mockSolidClient.getSolidDataset.mockResolvedValue('mockDataset');
      mockSolidClient.getThing.mockReturnValue(undefined);
      await expect(service.discoverPod('webId', 'sessionId')).rejects.toThrow('Could not find a valid profile Thing');
    });
    it('should throw if podUrl is missing', async () => {
      mockSolidClient.getSolidDataset.mockResolvedValue('mockDataset');
      mockSolidClient.getThing.mockReturnValue('mockThing');
      mockSolidClient.getUrl.mockReturnValue(undefined);
      await expect(service.discoverPod('webId', 'sessionId')).rejects.toThrow('Could not find the Pod storage location');
    });
    it('should log and rethrow errors', async () => {
      mockSolidClient.getSolidDataset.mockRejectedValue(new Error('fail'));
      await expect(service.discoverPod('webId', 'sessionId')).rejects.toThrow('fail');
    });
  });

  describe('readResource', () => {
    it('should read resource content', async () => {
      const mockFile = { text: jest.fn(() => Promise.resolve('file-content')) };
      mockSolidClient.getFile.mockResolvedValue(mockFile);
      (service as any).sessions.set('sid', 'mockAuthFetch');
      const content = await service.readResource('sid', 'url');
      expect(content).toBe('file-content');
    });
  });

  describe('writeResource', () => {
    it('should write resource content', async () => {
      mockSolidClient.overwriteFile.mockResolvedValue(undefined);
      (service as any).sessions.set('sid', 'mockAuthFetch');
      const msg = await service.writeResource('sid', 'url', 'data', 'text/plain');
      expect(msg).toMatch('Successfully wrote');
    });
  });

  describe('listContainer', () => {
    it('should list contained resources', async () => {
      mockSolidClient.getSolidDataset.mockResolvedValue('mockDataset');
      mockSolidClient.getContainedResourceUrlAll.mockReturnValue(['a', 'b']);
      (service as any).sessions.set('sid', 'mockAuthFetch');
      const result = await service.listContainer('sid', 'containerUrl');
      expect(result).toEqual(['a', 'b']);
    });
  });

  describe('deleteResource', () => {
    it('should delete a resource', async () => {
      mockSolidClient.deleteFile.mockResolvedValue(undefined);
      (service as any).sessions.set('sid', 'mockAuthFetch');
      const msg = await service.deleteResource('sid', 'url');
      expect(msg).toMatch('Successfully deleted');
    });
  });

  describe('updateRdfResource', () => {
    it('should update an RDF resource', async () => {
      mockSolidClient.getSolidDataset.mockResolvedValue('dataset');
      mockSolidClient.getThing.mockReturnValue(undefined);
      mockSolidClient.createThing.mockReturnValue('thing');
      mockSolidClient.setStringNoLocale.mockReturnValue('thing2');
      mockSolidClient.setThing.mockReturnValue('dataset2');
      mockSolidClient.saveSolidDatasetAt.mockResolvedValue(undefined);
      (service as any).sessions.set('sid', 'mockAuthFetch');
      const msg = await service.updateRdfResource('sid', 'resUrl', 'thingUrl', 'pred', 'val');
      expect(msg).toMatch('Successfully updated property');
    });
  });

  describe('grantAccess', () => {
    it('should grant access to a resource', async () => {
      mockSolidClient.universalAccess.setAgentAccess.mockResolvedValue(undefined);
      (service as any).sessions.set('sid', 'mockAuthFetch');
      const msg = await service.grantAccess('sid', 'resUrl', 'agentWebId', { read: true, write: false, append: false });
      expect(msg).toMatch('Access permissions updated');
    });
  });
});
