/**
 * Session-scoped image resolution service.
 *
 * This service centralizes subject-image resolution and caches results in-memory
 * for the app session so repeated subject/context requests do not trigger
 * duplicate API calls.
 */

import {
  getImageResolveStatus,
  resolveImage,
  type ResolveImageStatusResponse,
} from '../../utils/api/images';

const POLL_INTERVAL_MS = 1200;
const MAX_POLL_ATTEMPTS = 12;

const PENDING_STATUSES = new Set([
  'accepted',
  'pending',
  'queued',
  'processing',
  'running',
  'in_progress',
]);

const FAILURE_STATUSES = new Set([
  'failed',
  'error',
  'cancelled',
  'not_found',
  'timeout',
]);

export interface ResolveSubjectImageParams {
  subject: string;
  context?: string;
}

export interface ResolveSubjectImageResponse {
  subject: string;
  url: string | null;
  error: string | null;
  source: string | null;
  backendCached: boolean;
  fromMemoryCache: boolean;
}

const MAX_CACHE_SIZE = 100;
const resolvedCache = new Map<string, ResolveSubjectImageResponse>();
const inflightCache = new Map<string, Promise<ResolveSubjectImageResponse>>();

function normalizeStatus(status: string | undefined): string {
  if (!status) {
    return '';
  }
  return status.trim().toLowerCase();
}

function isPendingStatus(status: string): boolean {
  if (!status) {
    return true;
  }
  return PENDING_STATUSES.has(status);
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function createCacheKey({ subject, context }: ResolveSubjectImageParams): string {
  const normalizedSubject = subject.trim().toLowerCase();
  const normalizedContext = context?.trim().toLowerCase() ?? '';
  return `${normalizedSubject}::${normalizedContext}`;
}

function withMemoryCacheFlag(
  value: ResolveSubjectImageResponse,
): ResolveSubjectImageResponse {
  return {
    ...value,
    fromMemoryCache: true,
  };
}

function buildFailureResult(
  subject: string,
  error: string,
): ResolveSubjectImageResponse {
  return {
    subject,
    url: null,
    error,
    source: null,
    backendCached: false,
    fromMemoryCache: false,
  };
}

function readStatusError(
  payload: ResolveImageStatusResponse,
  normalizedStatus: string,
): string | null {
  if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
    return payload.error;
  }

  if (FAILURE_STATUSES.has(normalizedStatus)) {
    return `Image resolve failed with status: ${payload.status}`;
  }

  return null;
}

async function pollForResolvedImage(
  subject: string,
  jobId: string,
): Promise<ResolveSubjectImageResponse> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const statusResult = await getImageResolveStatus(jobId);

    if (!statusResult.success) {
      if (attempt === MAX_POLL_ATTEMPTS - 1) {
        return buildFailureResult(subject, statusResult.error.message);
      }
      await wait(POLL_INTERVAL_MS);
      continue;
    }

    const payload = statusResult.data;
    const status = normalizeStatus(payload.status);
    const statusError = readStatusError(payload, status);

    if (payload.result?.url) {
      return {
        subject: payload.result.subject || subject,
        url: payload.result.url,
        error: null,
        source: payload.result.source,
        backendCached: payload.result.cached,
        fromMemoryCache: false,
      };
    }

    if (statusError && !isPendingStatus(status)) {
      return buildFailureResult(subject, statusError);
    }

    if (!isPendingStatus(status)) {
      return buildFailureResult(
        subject,
        payload.error || 'Image resolve finished without a URL result.',
      );
    }

    await wait(POLL_INTERVAL_MS);
  }

  return buildFailureResult(
    subject,
    'Image resolve timed out. Please try again later.',
  );
}

async function resolveFromApi(
  params: ResolveSubjectImageParams,
): Promise<ResolveSubjectImageResponse> {
  const subject = params.subject.trim();
  const context = params.context?.trim();

  if (!subject) {
    return buildFailureResult('unknown', 'Image subject is required.');
  }

  const resolveResult = await resolveImage({
    subject,
    ...(context ? { context } : {}),
  });

  if (!resolveResult.success) {
    return buildFailureResult(subject, resolveResult.error.message);
  }

  if (resolveResult.data.type === 'resolved') {
    const resolved = resolveResult.data.result;
    return {
      subject: resolved.subject || subject,
      url: resolved.url,
      error: null,
      source: resolved.source,
      backendCached: resolved.cached,
      fromMemoryCache: false,
    };
  }

  return pollForResolvedImage(subject, resolveResult.data.jobId);
}

/**
 * Resolves an image URL for a subject and caches the result in memory.
 */
export async function resolveSubjectImage(
  params: ResolveSubjectImageParams,
): Promise<ResolveSubjectImageResponse> {
  const cacheKey = createCacheKey(params);

  const cached = resolvedCache.get(cacheKey);
  if (cached) {
    return withMemoryCacheFlag(cached);
  }

  const inflight = inflightCache.get(cacheKey);
  if (inflight) {
    const inflightResult = await inflight;
    return withMemoryCacheFlag(inflightResult);
  }

  const requestPromise = resolveFromApi(params)
    .then(result => {
      resolvedCache.set(cacheKey, result);
      // Evict oldest entry when cache exceeds limit
      if (resolvedCache.size > MAX_CACHE_SIZE) {
        const firstKey = resolvedCache.keys().next().value;
        if (firstKey !== undefined) {
          resolvedCache.delete(firstKey);
        }
      }
      return result;
    })
    .finally(() => {
      inflightCache.delete(cacheKey);
    });

  inflightCache.set(cacheKey, requestPromise);

  return requestPromise;
}

/**
 * Read-only helper for immediate cache lookups.
 */
export function getResolvedSubjectImageFromCache(
  params: ResolveSubjectImageParams,
): ResolveSubjectImageResponse | null {
  const cacheKey = createCacheKey(params);
  const cached = resolvedCache.get(cacheKey);
  return cached ? withMemoryCacheFlag(cached) : null;
}

/**
 * Utility for tests/debugging.
 */
export function clearResolvedSubjectImageCache(): void {
  resolvedCache.clear();
  inflightCache.clear();
}
