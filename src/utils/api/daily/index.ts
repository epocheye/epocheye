/**
 * Daily API module.
 * Wraps /api/v1/daily/* endpoints on the Go backend.
 *
 * `today` is LLM-generated per-user per-date (cached 24h).
 */

import {createAuthenticatedClient} from '../auth';
import {createErrorResult} from '../helpers';
import type {ApiResult, DailyToday} from './types';

export type {DailyToday, DailyStreakDay, Weekday} from './types';

/** GET /api/v1/daily/today — personalized "on this day" + weekly streak. */
export async function getDailyToday(): Promise<ApiResult<DailyToday>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<DailyToday>('/api/v1/daily/today');
    return {success: true, data: resp.data};
  } catch (error) {
    return createErrorResult(error);
  }
}
