/**
 * Explorer Pass API module.
 * Wraps the /api/v1/explorer-pass endpoints on the Go backend.
 */

import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';
import type {
  ApiResult,
  CheckAccessResult,
  ExplorerPass,
  ExplorerPassConfirmPayload,
  ExplorerPassInitiateResult,
  ExplorerPassQuote,
  ScanReportPayload,
} from './types';

export type {
  ExplorerPassConfigAdmin,
  ExplorerPassInitiateResult,
  ExplorerPassConfirmPayload,
  ExplorerPass,
  CheckAccessResult,
  ExplorerPassQuote,
  QuoteLineItem,
  ScanReportPayload,
} from './types';

type QuoteBody = {
  place_ids: string[];
  duration_hours?: number;
  coupon_code?: string;
};

/** POST /api/v1/explorer-pass/quote — server-computed per-place line items + optional extension. */
export async function getExplorerPassQuote(
  placeIds: string[],
  options?: { durationHours?: number; couponCode?: string },
): Promise<ApiResult<ExplorerPassQuote>> {
  try {
    const client = createAuthenticatedClient();
    const body: QuoteBody = { place_ids: placeIds };
    if (options?.durationHours) body.duration_hours = options.durationHours;
    if (options?.couponCode) body.coupon_code = options.couponCode.toUpperCase().trim();
    const resp = await client.post<ExplorerPassQuote>('/api/v1/explorer-pass/quote', body);
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/** POST /api/v1/explorer-pass/initiate — creates a Razorpay order. */
export async function initiateExplorerPass(
  placeIds: string[],
  options?: { durationHours?: number; couponCode?: string },
): Promise<ApiResult<ExplorerPassInitiateResult>> {
  try {
    const client = createAuthenticatedClient();
    const body: QuoteBody = { place_ids: placeIds };
    if (options?.durationHours) body.duration_hours = options.durationHours;
    if (options?.couponCode) body.coupon_code = options.couponCode.toUpperCase().trim();
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

/** POST /api/v1/scans/report-issue — user files a bad-scan report. */
export async function reportScanIssue(
  payload: ScanReportPayload,
): Promise<ApiResult<{ report_id: string; status: string }>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<{ report_id: string; status: string }>(
      '/api/v1/scans/report-issue',
      payload,
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
