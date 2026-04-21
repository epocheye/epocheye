import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';
import type {
  ApiResult,
  CurrentVisit,
  HistoryResponse,
  PingRequest,
  PingResponse,
} from './types';

export type {
  CurrentVisit,
  HistoryResponse,
  PingRequest,
  PingResponse,
  TourRow,
  VisitRow,
} from './types';

export async function pingVisit(req: PingRequest): Promise<ApiResult<PingResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<PingResponse>('/api/v1/visits/ping', req);
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function getVisitHistory(): Promise<ApiResult<HistoryResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<HistoryResponse>('/api/v1/visits/history');
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function getCurrentVisit(): Promise<ApiResult<CurrentVisit>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<CurrentVisit>('/api/v1/visits/current');
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
