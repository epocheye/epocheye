/**
 * Contract tests for the premium API module.
 */

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
};

jest.mock('../../src/utils/api/auth', () => ({
  createAuthenticatedClient: () => mockClient,
}));

import {
  getPremiumConfig,
  getMyPremiumPass,
  initiatePremiumPurchase,
  confirmPremiumPurchase,
} from '../../src/utils/api/premium';

beforeEach(() => {
  mockClient.get.mockReset();
  mockClient.post.mockReset();
});

test('getPremiumConfig hits GET /api/v1/premium/config', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { name: 'Premium', enabled: true } });
  await getPremiumConfig();
  expect(mockClient.get).toHaveBeenCalledWith('/api/v1/premium/config');
});

test('getMyPremiumPass hits GET /api/v1/premium/my-pass', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { pass: null } });
  await getMyPremiumPass();
  expect(mockClient.get).toHaveBeenCalledWith('/api/v1/premium/my-pass');
});

test('initiatePremiumPurchase posts without body when no coupon', async () => {
  mockClient.post.mockResolvedValueOnce({ data: { razorpay_order_id: 'x' } });
  await initiatePremiumPurchase();
  expect(mockClient.post).toHaveBeenCalledWith('/api/v1/premium/initiate', undefined);
});

test('initiatePremiumPurchase posts coupon_code when provided', async () => {
  mockClient.post.mockResolvedValueOnce({ data: { razorpay_order_id: 'x' } });
  await initiatePremiumPurchase(' VIP50 ');
  expect(mockClient.post).toHaveBeenCalledWith('/api/v1/premium/initiate', {
    coupon_code: 'VIP50',
  });
});

test('confirmPremiumPurchase posts payload', async () => {
  const payload = {
    razorpay_order_id: 'ord_1',
    razorpay_payment_id: 'pay_1',
    razorpay_signature: 'sig_1',
  };
  mockClient.post.mockResolvedValueOnce({ data: { pass: { id: 'p1' } } });
  await confirmPremiumPurchase(payload);
  expect(mockClient.post).toHaveBeenCalledWith('/api/v1/premium/confirm', payload);
});

test('returns failure on error', async () => {
  mockClient.get.mockRejectedValueOnce(new Error('500'));
  const res = await getPremiumConfig();
  expect(res.success).toBe(false);
});
