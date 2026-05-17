/**
 * Daily API module.
 * Wraps /api/v1/daily/* endpoints on the Go backend.
 *
 * `today` is LLM-generated per-user per-date (cached 24h). `nudge` controls the
 * 9 AM FCM push scheduled by the backend.
 */

import {createAuthenticatedClient} from '../auth';
import {createErrorResult} from '../helpers';
import type {ApiResult, DailyNudgeState, DailyToday} from './types';

export type {
  DailyToday,
  DailyStreakDay,
  DailyNudgeState,
  Weekday,
} from './types';

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

/** GET /api/v1/daily/nudge — current nudge state for this user. */
export async function getDailyNudge(): Promise<ApiResult<DailyNudgeState>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<DailyNudgeState>('/api/v1/daily/nudge');
    return {success: true, data: resp.data};
  } catch (error) {
    return createErrorResult(error);
  }
}

/** POST /api/v1/daily/nudge — toggle / schedule the daily nudge push. */
export async function setDailyNudge(
  state: DailyNudgeState,
): Promise<ApiResult<DailyNudgeState>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<DailyNudgeState>(
      '/api/v1/daily/nudge',
      state,
    );
    return {success: true, data: resp.data};
  } catch (error) {
    return createErrorResult(error);
  }
}
