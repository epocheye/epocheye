import { createAuthenticatedClient } from '../auth';
import { createErrorResult, isApiError } from '../helpers';
import type {
  AnchorCaptureRequest,
  AnchorsResponse,
  ArAnchor,
  ArResult,
  JobStatusResponse,
  QuotaExceededResponse,
  RecognizeRequest,
  RecognizeResponse,
  ReconstructOutcome,
  ReconstructPendingResponse,
  ReconstructRequest,
  ReconstructResponse,
  ScanContributeRequest,
  ScanContributeResponse,
  SiteBundleResponse,
  SubmitUnknownScanRequest,
  SubmitUnknownScanResponse,
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

/**
 * Fetch the geo-anchors curated for a monument. Used by the AR client to
 * place 3D objects at known lat/lng/altitude positions (geospatial mode) or
 * relative to a reference landmark (compass-fallback mode).
 */
export async function getAnchors(
  monumentId: string,
): Promise<ArResult<AnchorsResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<AnchorsResponse>('/api/v1/ar/anchors', {
      params: { monument_id: monumentId },
    });
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Fetch the full curated catalog for a monument: anchors + GLB URLs +
 * thumbnails in a single call. Drives the AR site mode + on-device GLB
 * prefetch on zone entry.
 */
export async function getSiteBundle(
  monumentId: string,
): Promise<ArResult<SiteBundleResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<SiteBundleResponse>('/api/v1/ar/site-bundle', {
      params: { monument_id: monumentId },
    });
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Catalog-mode recognition. Sends GPS + image; server runs Gemini against the
 * monument's full asset catalog, then resolves a placement (curated nearby /
 * runtime-persisted from HitTest pose / pose_fallback for mobile to handle).
 * If `ar_supported=false` is set, server returns `place_strategy:'viewer_only'`
 * so the mobile opens ThreeJsViewerScreen instead of the AR view.
 */
export async function recognizeObject(
  req: RecognizeRequest,
): Promise<ArResult<RecognizeResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<RecognizeResponse>('/api/v1/ar/recognize', req);
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * "Help us add this": visitor submits a photo of an unknown object so admin
 * (or the Meshy auto-fill tick) can curate it later. Server uploads to
 * Cloudinary and dedups against pending rows by perceptual-hash similarity.
 */
export async function submitUnknownScan(
  req: SubmitUnknownScanRequest,
): Promise<ArResult<SubmitUnknownScanResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<SubmitUnknownScanResponse>(
      '/api/v1/ar/unknown-scan',
      req,
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Admin-only anchor capture. Backend re-checks the is_admin claim on the
 * user JWT — the mobile UI hides the entry point for non-admins, but this
 * is the authoritative gate.
 */
export async function captureAnchor(
  req: AnchorCaptureRequest,
): Promise<ArResult<ArAnchor>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<ArAnchor>('/api/v1/ar/anchor-capture', req);
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
