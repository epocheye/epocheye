/**
 * Explorer Pass API module.
 * Wraps the /api/v1/explorer-pass endpoints served by the Go backend.
 */

import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';
import type {
  ApiResult,
  CheckAccessResult,
  ExplorerPass,
  ExplorerPassConfig,
  ExplorerPassConfirmPayload,
  ExplorerPassInitiateResult,
  PriceCalculation,
} from './types';

export type {
  PricingTier,
  ExplorerPassConfig,
  PriceCalculation,
  ExplorerPassInitiateResult,
  ExplorerPassConfirmPayload,
  ExplorerPass,
  CheckAccessResult,
} from './types';

/** GET /api/v1/explorer-pass/config — public pricing tiers. */
export async function getExplorerPassConfig(): Promise<ApiResult<ExplorerPassConfig>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<ExplorerPassConfig>('/api/v1/explorer-pass/config');
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** POST /api/v1/explorer-pass/calculate — price breakdown for selected places. */
export async function calculateExplorerPassPrice(
  placeIds: string[],
  couponCode?: string,
): Promise<ApiResult<PriceCalculation>> {
  try {
    const client = createAuthenticatedClient();
    const body: Record<string, unknown> = { place_ids: placeIds };
    if (couponCode) {
      body.coupon_code = couponCode.toUpperCase().trim();
    }
    const resp = await client.post<PriceCalculation>('/api/v1/explorer-pass/calculate', body);
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** POST /api/v1/explorer-pass/initiate — creates a Razorpay order. */
export async function initiateExplorerPass(
  placeIds: string[],
  couponCode?: string,
): Promise<ApiResult<ExplorerPassInitiateResult>> {
  try {
    const client = createAuthenticatedClient();
    const body: Record<string, unknown> = { place_ids: placeIds };
    if (couponCode) {
      body.coupon_code = couponCode.toUpperCase().trim();
    }
    const resp = await client.post<ExplorerPassInitiateResult>('/api/v1/explorer-pass/initiate', body);
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** POST /api/v1/explorer-pass/confirm — verifies payment and issues the pass. */
export async function confirmExplorerPass(
  payload: ExplorerPassConfirmPayload,
): Promise<ApiResult<{ pass: ExplorerPass }>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<{ pass: ExplorerPass }>('/api/v1/explorer-pass/confirm', payload);
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** GET /api/v1/explorer-pass/my-passes — user's active and past passes. */
export async function getMyExplorerPasses(): Promise<ApiResult<{ passes: ExplorerPass[] }>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<{ passes: ExplorerPass[] }>('/api/v1/explorer-pass/my-passes');
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** GET /api/v1/explorer-pass/check-access?place_id=X — check access for a place. */
export async function checkPlaceAccess(placeId: string): Promise<ApiResult<CheckAccessResult>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<CheckAccessResult>(
      `/api/v1/explorer-pass/check-access?place_id=${encodeURIComponent(placeId)}`,
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
