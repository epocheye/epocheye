/**
 * Config-driven GLB delivery.
 *
 * Models are addressed by a stable `modelId` (e.g. "konark_vimana"). The remote
 * fetch URL is built as `{GLB_BASE_URL}/{modelId}.glb`. `GLB_BASE_URL` is read
 * from `@env` and is intended to be a CloudFront distribution domain — never
 * hardcode a bucket/URL in code.
 *
 * When `GLB_BASE_URL` is empty (no CDN provisioned yet), `buildGlbUrl` returns
 * null and the resolver (`src/services/glbSource.ts`) falls back to the GLB
 * bundled in the app, so the experience works offline / before any infra exists.
 *
 * Models are immutable once published (a new version = a new file/modelId), so
 * downloads can be cached forever — see `glbCache.ts`.
 */
import { GLB_BASE_URL, AUDIO_BASE_URL } from '@env';
import { DEFAULT_MONUMENT_SLUG } from './monuments';

/** The marquee object (konark_vimana). Streamed from CloudFront (GLB_BASE_URL);
 *  no longer bundled in-app — prefetched on first use + LRU-cached on device. */
export const MARQUEE_MODEL_ID = 'konark_vimana';

/**
 * Venue (monument id) → the marquee model ids worth prefetching on arrival.
 * Keyed by the `monument_id` a geofence zone carries (backend id or
 * slugify(name)); both observed konark forms are mapped so prefetch fires
 * regardless. Unknown venues return [] (empty-safe: prefetch nothing).
 *
 * As real venues/models land this map grows — or moves server-side into the
 * site bundle. Today it's the static, offline-testable source of truth.
 */
const VENUE_MARQUEE_MODELS: Record<string, string[]> = {
  [DEFAULT_MONUMENT_SLUG]: [MARQUEE_MODEL_ID], // 'konark-sun-temple'
  konark: [MARQUEE_MODEL_ID],
};

/** Marquee model ids to prefetch for a venue, or [] if none are known. */
export function marqueeModelsForVenue(venueId: string): string[] {
  if (!venueId) return [];
  return VENUE_MARQUEE_MODELS[venueId.trim()] ?? [];
}

/**
 * Venues (by slug) that have a trained object detector + class_id-keyed grounded
 * objects, so "View in AR" should open the detector→grounded-card→AR flow
 * (DetectArScreen) rather than generic museum mode. Grows as detectors ship.
 */
const DETECTOR_VENUES = new Set<string>(['indian-museum']);

/** True when a venue has a trained detector (route it to the detect→place AR). */
export function venueHasDetector(slug?: string | null): boolean {
  return !!slug && DETECTOR_VENUES.has(slug.trim());
}

/**
 * Full model id → its low-detail placeholder model id. The placeholder is a
 * tiny, always-bundled GLB shown instantly while the full/CDN model loads
 * (progressive swap). null when a model has no low variant.
 */
const LOW_DETAIL_MODELS: Record<string, string> = {
  konark_vimana: 'konark_vimana_low',
};

export function lowDetailModelId(modelId: string): string | null {
  return LOW_DETAIL_MODELS[modelId] ?? null;
}

/** True when a remote CDN base is configured. */
export function isRemoteGlbConfigured(): boolean {
  return !!GLB_BASE_URL && GLB_BASE_URL.trim().length > 0;
}

/**
 * Pure URL join — exported for testing. Trims trailing slashes off the base and
 * a leading slash / `.glb` suffix off the id so callers can pass either
 * "konark_vimana" or "konark_vimana.glb". Returns null when base is empty.
 */
export function joinGlbUrl(base: string | undefined, modelId: string): string | null {
  const b = (base ?? '').trim().replace(/\/+$/, '');
  if (!b) return null;
  const id = modelId.trim().replace(/^\/+/, '').replace(/\.glb$/i, '');
  if (!id) return null;
  return `${b}/${id}.glb`;
}

/** Remote URL for a model id, or null when no CDN base is configured. */
export function buildGlbUrl(modelId: string): string | null {
  return joinGlbUrl(GLB_BASE_URL, modelId);
}

/* ── Audio guide delivery ─────────────────────────────────────────────────────
 * Narration clips are produced offline and uploaded to the same S3 bucket under
 * an `audio/` prefix, served through the same CloudFront distribution. Same rule
 * as GLB: never hardcode a bucket/domain — `AUDIO_BASE_URL` comes from `@env`.
 *
 * The backend's audio_clips.audio_url may hold EITHER a CDN key
 * ("audio/konark/painted_walls_en_casual.m4a") or a fully qualified URL. Keys are
 * preferred — they keep the CDN domain out of the database, so it can change
 * without rewriting rows — but an absolute URL is passed through untouched so a
 * clip hosted elsewhere still plays.
 */

/** True when a remote audio CDN base is configured. */
export function isRemoteAudioConfigured(): boolean {
  return !!AUDIO_BASE_URL && AUDIO_BASE_URL.trim().length > 0;
}

/**
 * Pure URL resolution — exported for testing. An absolute http(s) value is
 * returned as-is; anything else is treated as a CDN key and joined onto `base`
 * (trailing slash on the base and leading slash on the key are normalised, as in
 * joinGlbUrl). Returns null when the value is empty, or when it is a relative key
 * and no base is configured.
 *
 * Unlike joinGlbUrl this appends no extension: audio containers vary (.m4a/.mp3)
 * and the key carries its own.
 */
export function joinAudioUrl(
  base: string | undefined,
  audioUrl: string,
): string | null {
  const raw = (audioUrl ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const b = (base ?? '').trim().replace(/\/+$/, '');
  if (!b) return null;
  const key = raw.replace(/^\/+/, '');
  if (!key) return null;
  return `${b}/${key}`;
}

/**
 * Playable URL for a clip's `audio_url` as returned by
 * GET /api/v1/audio/stops, or null when it cannot be resolved.
 */
export function buildAudioUrl(audioUrl: string): string | null {
  return joinAudioUrl(AUDIO_BASE_URL, audioUrl);
}
