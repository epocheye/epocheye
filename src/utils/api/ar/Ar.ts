import { createAuthenticatedClient } from '../auth';
import { createErrorResult, isApiError } from '../helpers';
import type {
  ArResult,
  QuotaExceededResponse,
  ReconstructRequest,
  ReconstructResponse,
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
): Promise<ArResult<ReconstructResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<ReconstructResponse>(
      '/api/lens/reconstruct',
      req,
    );
    return { success: true, data: resp.data };
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
