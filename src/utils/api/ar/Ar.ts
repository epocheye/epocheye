import { createAuthenticatedClient } from '../auth';
import { createErrorResult, isApiError } from '../helpers';
import type {
  ArResult,
  JobStatusResponse,
  QuotaExceededResponse,
  ReconstructOutcome,
  ReconstructPendingResponse,
  ReconstructRequest,
  ReconstructResponse,
  ScanContributeRequest,
  ScanContributeResponse,
  UserArConfig,
} from './types';

export async function getArConfig(): Promise<ArResult<UserArConfig>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<UserArConfig>('/api/v1/ar/config');
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function reconstructObject(
  req: ReconstructRequest,
  options?: { devBypass?: boolean },
): Promise<ArResult<ReconstructOutcome>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<ReconstructResponse | ReconstructPendingResponse>(
      '/api/lens/reconstruct',
      req,
      options?.devBypass
        ? { headers: { 'X-Dev-Bypass': 'true' } }
        : undefined,
    );
    if (resp.status === 202) {
      return {
        success: true,
        data: { kind: 'pending', data: resp.data as ReconstructPendingResponse },
      };
    }
    return {
      success: true,
      data: { kind: 'ready', data: resp.data as ReconstructResponse },
    };
  } catch (error) {
    // 402 means the server accepted the request but refused on quota.
    // Surface this as a discriminated-union success=false variant so the
    // LensScreen can route to the upgrade prompt without reading raw axios.
    if (isApiError(error) && error.response?.status === 402) {
      return {
        success: false,
        quotaExceeded: true,
        data: error.response.data as QuotaExceededResponse,
      };
    }
    return createErrorResult(error);
  }
}

export async function getReconstructionStatus(
  jobId: string,
): Promise<ArResult<JobStatusResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<JobStatusResponse>(
      `/api/lens/reconstruct/status/${encodeURIComponent(jobId)}`,
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function contributeScan(
  req: ScanContributeRequest,
): Promise<ArResult<ScanContributeResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<ScanContributeResponse>(
      '/api/lens/scan-contribute',
      req,
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
