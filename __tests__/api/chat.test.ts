/**
 * Contract tests for the chat API module — verifies each function
 * hits the expected path/method so backend endpoint renames surface
 * in CI instead of at runtime.
 */

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../src/utils/api/auth', () => ({
  createAuthenticatedClient: () => mockClient,
}));

import {
  createSession,
  deleteSession,
  listMessages,
  listSessions,
} from '../../src/utils/api/chat/Chat';

beforeEach(() => {
  mockClient.get.mockReset();
  mockClient.post.mockReset();
  mockClient.delete.mockReset();
});

test('listSessions hits GET /api/v1/chat/sessions', async () => {
  mockClient.get.mockResolvedValueOnce({ data: [] });
  await listSessions();
  expect(mockClient.get).toHaveBeenCalledWith('/api/v1/chat/sessions');
});

test('createSession posts trimmed title when provided', async () => {
  mockClient.post.mockResolvedValueOnce({ data: { id: '1' } });
  await createSession('  My plan  ');
  expect(mockClient.post).toHaveBeenCalledWith('/api/v1/chat/sessions', { title: 'My plan' });
});

test('createSession posts undefined body when title is blank', async () => {
  mockClient.post.mockResolvedValueOnce({ data: { id: '1' } });
  await createSession('   ');
  expect(mockClient.post).toHaveBeenCalledWith('/api/v1/chat/sessions', undefined);
});

test('deleteSession hits DELETE /api/v1/chat/sessions/:id', async () => {
  mockClient.delete.mockResolvedValueOnce({ data: { deleted: true } });
  await deleteSession('abc-123');
  expect(mockClient.delete).toHaveBeenCalledWith('/api/v1/chat/sessions/abc-123');
});

test('listMessages hits GET /api/v1/chat/sessions/:id/messages', async () => {
  mockClient.get.mockResolvedValueOnce({ data: [] });
  await listMessages('xyz');
  expect(mockClient.get).toHaveBeenCalledWith('/api/v1/chat/sessions/xyz/messages');
});

test('returns success=false on thrown error', async () => {
  mockClient.get.mockRejectedValueOnce(new Error('network'));
  const res = await listSessions();
  expect(res.success).toBe(false);
});
