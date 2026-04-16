/**
 * Contract tests for the explorer-pass API module.
 */

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
};

jest.mock('../../src/utils/api/auth', () => ({
  createAuthenticatedClient: () => mockClient,
}));

import {
  getExplorerPassConfig,
  calculateExplorerPassPrice,
  initiateExplorerPass,
  confirmExplorerPass,
  getMyExplorerPasses,
  checkPlaceAccess,
} from '../../src/utils/api/explorer-pass';

beforeEach(() => {
  mockClient.get.mockReset();
  mockClient.post.mockReset();
});

test('getExplorerPassConfig hits GET /api/v1/explorer-pass/config', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { tiers: [] } });
  await getExplorerPassConfig();
  expect(mockClient.get).toHaveBeenCalledWith('/api/v1/explorer-pass/config');
});

test('calculateExplorerPassPrice posts place_ids', async () => {
  mockClient.post.mockResolvedValueOnce({ data: { total: 4900 } });
  await calculateExplorerPassPrice(['p1', 'p2']);
  expect(mockClient.post).toHaveBeenCalledWith('/api/v1/explorer-pass/calculate', {
    place_ids: ['p1', 'p2'],
  });
});

test('calculateExplorerPassPrice includes coupon_code when provided', async () => {
  mockClient.post.mockResolvedValueOnce({ data: { total: 3900 } });
  await calculateExplorerPassPrice(['p1'], ' save10 ');
  expect(mockClient.post).toHaveBeenCalledWith('/api/v1/explorer-pass/calculate', {
    place_ids: ['p1'],
    coupon_code: 'SAVE10',
  });
});

test('initiateExplorerPass posts place_ids', async () => {
  mockClient.post.mockResolvedValueOnce({ data: { razorpay_order_id: 'ord' } });
  await initiateExplorerPass(['p1', 'p2']);
  expect(mockClient.post).toHaveBeenCalledWith('/api/v1/explorer-pass/initiate', {
    place_ids: ['p1', 'p2'],
  });
});

test('confirmExplorerPass posts payload', async () => {
  const payload = {
    razorpay_order_id: 'ord_1',
    razorpay_payment_id: 'pay_1',
    razorpay_signature: 'sig_1',
  };
  mockClient.post.mockResolvedValueOnce({ data: { pass: { id: 'ep1' } } });
  await confirmExplorerPass(payload);
  expect(mockClient.post).toHaveBeenCalledWith('/api/v1/explorer-pass/confirm', payload);
});

test('getMyExplorerPasses hits GET /api/v1/explorer-pass/my-passes', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { passes: [] } });
  await getMyExplorerPasses();
  expect(mockClient.get).toHaveBeenCalledWith('/api/v1/explorer-pass/my-passes');
});

test('checkPlaceAccess hits GET with place_id query', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { has_access: false } });
  await checkPlaceAccess('konark');
  expect(mockClient.get).toHaveBeenCalledWith(
    '/api/v1/explorer-pass/check-access?place_id=konark',
  );
});

test('returns failure on thrown error', async () => {
  mockClient.get.mockRejectedValueOnce(new Error('net'));
  const res = await getExplorerPassConfig();
  expect(res.success).toBe(false);
});
