/**
 * Contract tests for the tours API module.
 */

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
};

jest.mock('../../src/utils/api/auth', () => ({
  createAuthenticatedClient: () => mockClient,
}));

import {
  getTours,
  getTour,
  getMyTours,
  initiatePurchase,
  confirmPurchase,
  validateCoupon,
  calculateDiscount,
} from '../../src/utils/api/tours';

beforeEach(() => {
  mockClient.get.mockReset();
  mockClient.post.mockReset();
});

test('getTours hits GET /api/v1/tours/', async () => {
  mockClient.get.mockResolvedValueOnce({ data: [] });
  await getTours();
  expect(mockClient.get).toHaveBeenCalledWith('/api/v1/tours/');
});

test('getTour hits GET /api/v1/tours/:id', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { id: 't1' } });
  await getTour('t1');
  expect(mockClient.get).toHaveBeenCalledWith('/api/v1/tours/t1');
});

test('getMyTours hits GET /api/v1/tours/my', async () => {
  mockClient.get.mockResolvedValueOnce({ data: [] });
  await getMyTours();
  expect(mockClient.get).toHaveBeenCalledWith('/api/v1/tours/my');
});

test('initiatePurchase posts without body when no coupon', async () => {
  mockClient.post.mockResolvedValueOnce({ data: { razorpay_order_id: 'ord_1' } });
  await initiatePurchase('t1');
  expect(mockClient.post).toHaveBeenCalledWith(
    '/api/v1/tours/t1/purchase/initiate',
    undefined,
  );
});

test('initiatePurchase posts coupon_code when provided', async () => {
  mockClient.post.mockResolvedValueOnce({ data: { razorpay_order_id: 'ord_1' } });
  await initiatePurchase('t1', ' welcome10 ');
  expect(mockClient.post).toHaveBeenCalledWith(
    '/api/v1/tours/t1/purchase/initiate',
    { coupon_code: 'WELCOME10' },
  );
});

test('confirmPurchase posts payload', async () => {
  const payload = {
    razorpay_order_id: 'ord_1',
    razorpay_payment_id: 'pay_1',
    razorpay_signature: 'sig_1',
  };
  mockClient.post.mockResolvedValueOnce({ data: { access_granted: true } });
  await confirmPurchase('t1', payload);
  expect(mockClient.post).toHaveBeenCalledWith(
    '/api/v1/tours/t1/purchase/confirm',
    payload,
  );
});

test('validateCoupon hits the correct URL with encoded code', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { valid: true } });
  await validateCoupon('save20');
  expect(mockClient.get).toHaveBeenCalledWith(
    '/api/v1/coupons/validate?code=SAVE20',
  );
});

test('calculateDiscount hits the correct URL', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { discount: 200 } });
  await calculateDiscount('SAVE20', 1000);
  expect(mockClient.get).toHaveBeenCalledWith(
    '/api/v1/coupons/calculate?code=SAVE20&amount=1000',
  );
});

test('returns failure on thrown error', async () => {
  mockClient.get.mockRejectedValueOnce(new Error('boom'));
  const res = await getTours();
  expect(res.success).toBe(false);
});
