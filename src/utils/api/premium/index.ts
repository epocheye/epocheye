/**
 * Epocheye Premium API module.
 * Wraps the /api/v1/premium endpoints served by the Go backend.
 */

import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';
import type {
  ApiResult,
  PremiumConfirmPayload,
  PremiumInitiateResult,
  PremiumPass,
  PremiumProductConfig,
} from './types';

export type {
  PremiumProductConfig,
  PremiumPass,
  PremiumInitiateResult,
  PremiumConfirmPayload,
} from './types';

/** GET /api/v1/premium/config — public product info (name, price, validity, enabled). */
export async function getPremiumConfig(): Promise<ApiResult<PremiumProductConfig>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<PremiumProductConfig>('/api/v1/premium/config');
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** GET /api/v1/premium/my-pass — returns the user's most recent pass, or null. */
export async function getMyPremiumPass(): Promise<ApiResult<{ pass: PremiumPass | null }>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<{ pass: PremiumPass | null }>('/api/v1/premium/my-pass');
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** POST /api/v1/premium/initiate — creates a Razorpay order server-side. */
export async function initiatePremiumPurchase(
  couponCode?: string,
): Promise<ApiResult<PremiumInitiateResult>> {
  try {
    const client = createAuthenticatedClient();
    const body = couponCode ? { coupon_code: couponCode.toUpperCase().trim() } : undefined;
    const resp = await client.post<PremiumInitiateResult>('/api/v1/premium/initiate', body);
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** POST /api/v1/premium/confirm — verifies Razorpay signature and issues the pass. */
export async function confirmPremiumPurchase(
  payload: PremiumConfirmPayload,
): Promise<ApiResult<{ pass: PremiumPass }>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<{ pass: PremiumPass }>('/api/v1/premium/confirm', payload);
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
