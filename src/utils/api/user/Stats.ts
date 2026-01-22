/**
 * User Stats API Module
 * Handles user statistics operations
 */

import { UserStats, UserResult } from './types';
import { createAuthenticatedClient } from '../auth/Login';
import { createErrorResult } from '../helpers';

/**
 * Fetches the current user's statistics
 */
export async function getUserStats(): Promise<UserResult<UserStats>> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get<UserStats>('/api/user/stats');
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
