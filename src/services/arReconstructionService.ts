import { reconstructObject, contributeScan } from '../utils/api/ar';
import type {
  QuotaExceededResponse,
  ReconstructResponse,
} from '../utils/api/ar';
import { useArQuotaStore } from '../stores/arQuotaStore';

export type ArReconstructionResult =
  | {
      kind: 'success';
      glbUrl: string;
      thumbnailUrl?: string;
      provider: string;
      cached: boolean;
      scanCount: number;
      quality: string;
      isImproving: boolean;
    }
  | {
      kind: 'quota_exceeded';
      info: QuotaExceededResponse;
    }
  | {
      kind: 'error';
      message: string;
    };

interface ReconstructInput {
  monumentId: string;
  objectLabel: string;
  imageBase64?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Kicks off a reconstruction request. Routes quota-exceeded responses to a
 * discriminated-union variant the caller can use to show the upgrade prompt
 * without inspecting axios internals. On success it optimistically applies
 * the new remaining count to the quota store so the pill updates instantly.
 */
export async function reconstructForLens(
  input: ReconstructInput,
): Promise<ArReconstructionResult> {
  const result = await reconstructObject({
    monument_id: input.monumentId,
    object_label: input.objectLabel,
    image_base64: input.imageBase64,
    image_url: input.imageUrl,
    latitude: input.latitude,
    longitude: input.longitude,
  });

  if (result.success) {
    // Cache hits report quota_remaining=0 but shouldn't touch the store —
    // cached responses bypass the quota entirely on the server side.
    const payload: ReconstructResponse = result.data;
    if (!payload.cached) {
      useArQuotaStore
        .getState()
        .applyReconstructionResult(
          payload.quota_remaining,
          payload.quota_limit,
          payload.scan_count,
          payload.reconstruction_quality,
          payload.is_improving,
        );
    }

    // Cached results skip StoreScan on the backend. Contribute the scan
    // in the background so the monument still accumulates angles.
    if (payload.cached && input.imageBase64) {
      contributeScan({
        monument_id: input.monumentId,
        object_label: input.objectLabel,
        image_base64: input.imageBase64,
      }).catch(() => {}); // fire-and-forget
    }

    return {
      kind: 'success',
      glbUrl: payload.glb_url,
      thumbnailUrl: payload.thumbnail_url,
      provider: payload.provider,
      cached: payload.cached,
      scanCount: payload.scan_count ?? 0,
      quality: payload.reconstruction_quality ?? 'none',
      isImproving: payload.is_improving ?? false,
    };
  }

  if ('quotaExceeded' in result && result.quotaExceeded) {
    // Keep the quota store in sync with the server-side deny so the pill
    // shows 0 remaining until the next refresh.
    const { data } = result;
    useArQuotaStore
      .getState()
      .applyReconstructionResult(0, data.limit);
    return { kind: 'quota_exceeded', info: data };
  }

  const message =
    'error' in result ? result.error.message : 'Reconstruction failed';
  return { kind: 'error', message };
}

