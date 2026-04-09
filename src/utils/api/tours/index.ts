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
  InitiateResult,
  MyTour,
  Tour,
} from './types';

export type { Tour, MyTour, InitiateResult, ConfirmResult, UserAccess } from './types';

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
 */
export async function initiatePurchase(
  tourId: string,
): Promise<ApiResult<InitiateResult>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<InitiateResult>(
      `/api/v1/tours/${tourId}/purchase/initiate`,
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
