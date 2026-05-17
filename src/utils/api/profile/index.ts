/**
 * Profile API module.
 * Wraps /api/v1/profile/* endpoints on the Go backend.
 *
 * `digest` is a weekly LLM-generated summary of the user's heritage activity.
 */

import {createAuthenticatedClient} from '../auth';
import {createErrorResult} from '../helpers';
import type {ApiResult, ProfileDigest} from './types';

export type {ProfileDigest} from './types';

/** GET /api/v1/profile/digest — weekly summary headline/body + dynasty tags. */
export async function getProfileDigest(): Promise<ApiResult<ProfileDigest>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<ProfileDigest>('/api/v1/profile/digest');
    return {success: true, data: resp.data};
  } catch (error) {
    return createErrorResult(error);
  }
}
