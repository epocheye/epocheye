/**
 * Passport API module.
 * Wraps /api/v1/passport/* endpoints on the Go backend.
 *
 * Aggregates over the existing visits table for streak/sites/dynasties,
 * and surfaces active Explorer Passes alongside collected stamps.
 */

import {createAuthenticatedClient} from '../auth';
import {createErrorResult} from '../helpers';
import type {
  ApiResult,
  PassportStampsResponse,
  PassportSummary,
} from './types';

export type {
  PassportSummary,
  PassportStamp,
  PassportStampsResponse,
  LockedSite,
} from './types';

/** GET /api/v1/passport/summary — streak, sites, dynasties, active passes. */
export async function getPassportSummary(): Promise<ApiResult<PassportSummary>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<PassportSummary>('/api/v1/passport/summary');
    return {success: true, data: resp.data};
  } catch (error) {
    return createErrorResult(error);
  }
}

/** GET /api/v1/passport/stamps — unlocked stamps + locked sites. Optional `dynasty` filter. */
export async function getPassportStamps(
  options?: {dynasty?: string},
): Promise<ApiResult<PassportStampsResponse>> {
  try {
    const client = createAuthenticatedClient();
    const params = options?.dynasty
      ? `?dynasty=${encodeURIComponent(options.dynasty)}`
      : '';
    const resp = await client.get<PassportStampsResponse>(
      `/api/v1/passport/stamps${params}`,
    );
    return {success: true, data: resp.data};
  } catch (error) {
    return createErrorResult(error);
  }
}
