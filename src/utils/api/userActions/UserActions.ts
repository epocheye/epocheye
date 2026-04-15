/**
 * User Actions API Module
 * POST /api/user/visit, GET /api/user/visit-history
 */

import { createAuthenticatedClient } from '../auth/Login';
import { createErrorResult } from '../helpers';
import {
  LogVisitRequest,
  LogVisitResponse,
  UserActionsResult,
  VisitHistoryResponse,
} from './types';

export async function logVisit(
  placeId: string,
): Promise<UserActionsResult<LogVisitResponse>> {
  try {
    const client = await createAuthenticatedClient();
    const body: LogVisitRequest = { place_id: placeId };
    const response = await client.post<LogVisitResponse>(
      '/api/user/visit',
      body,
    );
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function getVisitHistory(): Promise<
  UserActionsResult<VisitHistoryResponse>
> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get<VisitHistoryResponse>(
      '/api/user/visit-history',
    );
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
