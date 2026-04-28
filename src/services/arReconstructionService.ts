import {
  reconstructObject,
  recognizeObject,
  contributeScan,
  getReconstructionStatus,
} from '../utils/api/ar';
import type {
  HitTestPose,
  PlaceStrategy,
  QuotaExceededResponse,
  RecognizeAsset,
  RecognizePlacement,
  ReconstructPendingResponse,
  ReconstructResponse,
} from '../utils/api/ar';
import { useArQuotaStore } from '../stores/arQuotaStore';
import { cacheGlbUrl, getCachedGlbUri } from './glbCache';

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
      kind: 'pending';
      jobId: string;
      phase: string;
      etaSeconds: number;
      message: string;
    }
  | {
      kind: 'error';
      message: string;
    };

export interface PendingProgress {
  phase: string;
  etaSeconds: number;
  message?: string;
}

interface ReconstructInput {
  monumentId: string;
  objectLabel: string;
  imageBase64?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  /** Gemini bbox [y0, x0, y1, x1] in 0-1000 scale for the tapped object. */
  cropBBox?: [number, number, number, number];
  /** Dev-only: send X-Dev-Bypass header so backend skips site + heritage gates. */
  devBypass?: boolean;
}

// Polling cadence for async cold-start jobs. Caps roughly match the server-
// reported worst-case warmup (~8 min) plus a safety margin for first-ever
// container pull on the inference host.
const DEFAULT_POLL_INTERVAL_MS = 15_000;
const DEFAULT_POLL_TIMEOUT_MS = 12 * 60_000;

export async function reconstructForLens(
  input: ReconstructInput,
): Promise<ArReconstructionResult> {
  const result = await reconstructObject(
    {
      monument_id: input.monumentId,
      object_label: input.objectLabel,
      image_base64: input.imageBase64,
      image_url: input.imageUrl,
      latitude: input.latitude,
      longitude: input.longitude,
      crop_bbox_2d: input.cropBBox,
    },
    { devBypass: input.devBypass },
  );

  if (result.success) {
    if (result.data.kind === 'pending') {
      return mapPending(result.data.data);
    }

    const payload: ReconstructResponse = result.data.data;
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

    if (payload.cached && input.imageBase64) {
      contributeScan({
        monument_id: input.monumentId,
        object_label: input.objectLabel,
        image_base64: input.imageBase64,
      }).catch(() => {});
    }

    const glbUrl = await resolveGlbUri(payload.glb_url);

    return {
      kind: 'success',
      glbUrl,
      thumbnailUrl: payload.thumbnail_url,
      provider: payload.provider,
      cached: payload.cached,
      scanCount: payload.scan_count ?? 0,
      quality: payload.reconstruction_quality ?? 'none',
      isImproving: payload.is_improving ?? false,
    };
  }

  if ('quotaExceeded' in result && result.quotaExceeded) {
    const { data } = result;
    useArQuotaStore.getState().applyReconstructionResult(0, data.limit);
    return { kind: 'quota_exceeded', info: data };
  }

  const message =
    'error' in result ? result.error.message : 'Reconstruction failed';
  return { kind: 'error', message };
}

function mapPending(p: ReconstructPendingResponse): ArReconstructionResult {
  return {
    kind: 'pending',
    jobId: p.job_id,
    phase: p.phase,
    etaSeconds: p.eta_seconds,
    message: p.message,
  };
}

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onProgress?: (p: PendingProgress) => void;
  isAborted?: () => boolean;
}

/**
 * Polls the job status endpoint until the reconstruction finishes, fails, or
 * the timeout elapses. Resolves to the same union the sync path returns so
 * callers can treat both paths uniformly.
 */
export async function pollReconstructionJob(
  jobId: string,
  opts: PollOptions = {},
): Promise<ArReconstructionResult> {
  const interval = opts.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeout = opts.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (opts.isAborted?.()) {
      return { kind: 'error', message: 'Cancelled' };
    }

    const res = await getReconstructionStatus(jobId);
    if (!res.success) {
      const message = 'error' in res ? res.error.message : 'Status check failed';
      return { kind: 'error', message };
    }

    const job = res.data;
    if (job.status === 'succeeded' && job.glb_url) {
      const glbUrl = await resolveGlbUri(job.glb_url);
      return {
        kind: 'success',
        glbUrl,
        thumbnailUrl: job.thumbnail_url,
        provider: job.provider ?? 'sagemaker',
        cached: false,
        scanCount: 0,
        quality: 'single_view',
        isImproving: false,
      };
    }
    if (job.status === 'failed') {
      return {
        kind: 'error',
        message: job.error || 'Reconstruction failed',
      };
    }

    opts.onProgress?.({
      phase: job.phase ?? job.status,
      etaSeconds: job.eta_seconds ?? 0,
    });

    await wait(interval);
  }

  return {
    kind: 'error',
    message:
      "We're still preparing the 3D engine. Try again in a minute — your scan will be faster next time.",
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Catalog-mode recognition. Sends GPS + image to /api/v1/ar/recognize and
 * returns a discriminated union the AR screen branches on. The shape mirrors
 * the backend's place_strategy field:
 *
 *   - 'curated' / 'runtime_persisted' → render `placement` in AR
 *   - 'pose_fallback'                 → mobile creates a Geospatial anchor itself
 *   - 'viewer_only'                   → ARCore unavailable, open 3D viewer
 *   - 'unknown'                       → show "Help us add this" sheet
 *   - 'error'                         → network/server failure
 */
export type RecognizeOutcome =
  | {
      kind: 'placed';
      strategy: 'curated' | 'runtime_persisted';
      asset: RecognizeAsset & { glbUri: string };
      placement: RecognizePlacement;
      confidence: number;
      knowledgeText?: string;
    }
  | {
      kind: 'pose_fallback';
      asset: RecognizeAsset & { glbUri: string };
      confidence: number;
      knowledgeText?: string;
    }
  | {
      kind: 'viewer_only';
      asset: RecognizeAsset & { glbUri: string };
      confidence: number;
      knowledgeText?: string;
    }
  | {
      kind: 'unknown';
      knowledgeText?: string;
      confidence: number;
    }
  | {
      kind: 'error';
      message: string;
    };

interface RecognizeInput {
  monumentId: string;
  lat: number;
  lng: number;
  imageBase64: string;
  hitTestPose?: HitTestPose;
  arSupported?: boolean;
}

export async function recognizeForLens(
  input: RecognizeInput,
): Promise<RecognizeOutcome> {
  const result = await recognizeObject({
    monument_id: input.monumentId,
    lat: input.lat,
    lng: input.lng,
    image_base64: input.imageBase64,
    hit_test_pose: input.hitTestPose,
    ar_supported: input.arSupported,
  });
  if (!result.success) {
    const message =
      'error' in result ? result.error.message : 'Recognition failed';
    return { kind: 'error', message };
  }
  const data = result.data;
  if (data.match === 'unknown') {
    return {
      kind: 'unknown',
      knowledgeText: data.knowledge_text,
      confidence: data.confidence,
    };
  }
  if (!data.asset || !data.asset.glb_url) {
    return { kind: 'error', message: 'Catalog match returned no asset' };
  }

  const glbUri = await resolveGlbUri(data.asset.glb_url);
  const enrichedAsset = { ...data.asset, glbUri };

  const strategy: PlaceStrategy = data.place_strategy ?? 'pose_fallback';
  if (strategy === 'viewer_only') {
    return {
      kind: 'viewer_only',
      asset: enrichedAsset,
      confidence: data.confidence,
      knowledgeText: data.knowledge_text,
    };
  }
  if (strategy === 'pose_fallback') {
    return {
      kind: 'pose_fallback',
      asset: enrichedAsset,
      confidence: data.confidence,
      knowledgeText: data.knowledge_text,
    };
  }
  if (!data.placement) {
    return { kind: 'error', message: 'Catalog match returned no placement' };
  }
  return {
    kind: 'placed',
    strategy,
    asset: enrichedAsset,
    placement: data.placement,
    confidence: data.confidence,
    knowledgeText: data.knowledge_text,
  };
}

/**
 * Returns a local file:// URI when the GLB is already cached on-device,
 * otherwise returns the remote URL and kicks off a background download so
 * the next request for the same model resolves instantly.
 */
async function resolveGlbUri(remoteUrl: string): Promise<string> {
  if (!remoteUrl) return remoteUrl;
  const cached = await getCachedGlbUri(remoteUrl).catch(() => null);
  if (cached) return cached;
  cacheGlbUrl(remoteUrl).catch(() => {
    // best-effort prefetch — render proceeds with the remote URL
  });
  return remoteUrl;
}
