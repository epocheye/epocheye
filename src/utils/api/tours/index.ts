/**
 * Tours API Module
 * All tour-related API calls go through this module.
 */

import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';
import type {
  ApiResult,
  ConfirmPayload,
  ConfirmResult,
  CouponValidation,
  DiscountCalculation,
  InitiateResult,
  MyTour,
  Tour,
} from './types';

export type { Tour, MyTour, InitiateResult, ConfirmResult, UserAccess, CouponValidation, DiscountCalculation } from './types';

/** GET /api/v1/tours — all active tours with user_access */
export async function getTours(): Promise<ApiResult<Tour[]>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<Tour[]>('/api/v1/tours/');
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** GET /api/v1/tours/{id} — single tour; content_body included if user has access */
export async function getTour(id: string): Promise<ApiResult<Tour>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<Tour>(`/api/v1/tours/${id}`);
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** GET /api/v1/tours/my — user's full purchase history */
export async function getMyTours(): Promise<ApiResult<MyTour[]>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<MyTour[]>('/api/v1/tours/my');
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * POST /api/v1/tours/{id}/purchase/initiate
 * For free tours: returns { access_granted: true, expires_at }.
 * For paid tours: returns { razorpay_order_id, amount_paise, currency }.
 * If couponCode is provided, the backend applies the discount and returns the discounted amount.
 */
export async function initiatePurchase(
  tourId: string,
  couponCode?: string,
): Promise<ApiResult<InitiateResult>> {
  try {
    const client = createAuthenticatedClient();
    const body = couponCode ? { coupon_code: couponCode.toUpperCase().trim() } : undefined;
    const resp = await client.post<InitiateResult>(
      `/api/v1/tours/${tourId}/purchase/initiate`,
      body,
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** GET /api/v1/coupons/validate?code=CODE — validate a coupon code without recording */
export async function validateCoupon(code: string): Promise<ApiResult<CouponValidation>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<CouponValidation>(
      `/api/v1/coupons/validate?code=${encodeURIComponent(code.toUpperCase().trim())}`,
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** GET /api/v1/coupons/calculate?code=CODE&amount=PAISE — get discount breakdown */
export async function calculateDiscount(
  code: string,
  amountPaise: number,
): Promise<ApiResult<DiscountCalculation>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<DiscountCalculation>(
      `/api/v1/coupons/calculate?code=${encodeURIComponent(code.toUpperCase().trim())}&amount=${amountPaise}`,
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * POST /api/v1/tours/{id}/purchase/confirm
 * Verifies the Razorpay payment and grants access.
 */
export async function confirmPurchase(
  tourId: string,
  payload: ConfirmPayload,
): Promise<ApiResult<ConfirmResult>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<ConfirmResult>(
      `/api/v1/tours/${tourId}/purchase/confirm`,
      payload,
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
