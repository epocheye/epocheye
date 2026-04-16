/**
 * Contract tests for userActions API — logVisit + getVisitHistory.
 */

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
};

jest.mock('../../src/utils/api/auth/Login', () => ({
  createAuthenticatedClient: () => mockClient,
}));

import {
  logVisit,
  getVisitHistory,
} from '../../src/utils/api/userActions/UserActions';

beforeEach(() => {
  mockClient.get.mockReset();
  mockClient.post.mockReset();
});

test('logVisit posts to /api/user/visit with place_id body', async () => {
  mockClient.post.mockResolvedValueOnce({ data: { logged: true } });
  const res = await logVisit('konark-sun-temple');
  expect(mockClient.post).toHaveBeenCalledWith('/api/user/visit', {
    place_id: 'konark-sun-temple',
  });
  expect(res.success).toBe(true);
});

test('getVisitHistory hits GET /api/user/visit-history', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { visits: [] } });
  const res = await getVisitHistory();
  expect(mockClient.get).toHaveBeenCalledWith('/api/user/visit-history');
  expect(res.success).toBe(true);
});

test('logVisit returns failure on error', async () => {
  mockClient.post.mockRejectedValueOnce(new Error('offline'));
  const res = await logVisit('x');
  expect(res.success).toBe(false);
});

test('getVisitHistory returns failure on error', async () => {
  mockClient.get.mockRejectedValueOnce(new Error('offline'));
  const res = await getVisitHistory();
  expect(res.success).toBe(false);
});
