/**
 * Single entry point for "give me a loadable GLB URI for this model id".
 *
 * Resolution order:
 *   1. If GLB_BASE_URL is configured → {GLB_BASE_URL}/{modelId}.glb, run through
 *      the on-device cache (`getOrFetchGlb`) so repeat views are instant/offline.
 *   2. Otherwise → the GLB bundled in the app (`getBundledGlbUri`), so the app
 *      works today with no CDN/bucket provisioned.
 *
 * Returns null only when neither a remote base nor a bundled copy exists for the
 * id (caller shows an error / "model unavailable").
 */
import {
  buildGlbUrl,
  lowDetailModelId,
  marqueeModelsForVenue,
} from '../config/glbDelivery';
import { getOrFetchGlb } from './glbCache';
import { getBundledGlbUri } from './localGlbAssets';

export type GlbSourceKind = 'remote' | 'bundled' | 'none';

export interface GlbResolution {
  uri: string | null;
  /** Where the URI came from — useful for logging and the progressive path. */
  kind: GlbSourceKind;
}

/** Resolve a model id to a loadable URI plus its source. */
export async function resolveModelGlbDetailed(
  modelId: string,
): Promise<GlbResolution> {
  if (!modelId) return { uri: null, kind: 'none' };

  const remote = buildGlbUrl(modelId);
  if (remote) {
    // getOrFetchGlb returns a cached file:// when warm, downloads when cold, and
    // degrades to the remote URL if the download fails — all loadable by SceneView.
    const uri = await getOrFetchGlb(remote);
    return { uri, kind: 'remote' };
  }

  const bundled = await getBundledGlbUri(modelId);
  if (bundled) return { uri: bundled, kind: 'bundled' };

  return { uri: null, kind: 'none' };
}

/** Convenience: just the URI (or null). */
export async function resolveModelGlb(modelId: string): Promise<string | null> {
  return (await resolveModelGlbDetailed(modelId)).uri;
}

/**
 * Background-warm a set of models. For remote models this downloads+caches; for
 * bundled models it copies the asset out to a cache file. Fire-and-forget and
 * best-effort — never throws, so callers can `void` it on a hot path.
 */
export function prefetchModels(modelIds: string[]): void {
  for (const id of modelIds) {
    if (!id) continue;
    void resolveModelGlbDetailed(id).catch(() => {
      // silent — prefetch is best-effort
    });
  }
}

/**
 * Prefetch a venue's marquee models on arrival, so the GLB is on-device before
 * the user points at anything. Empty-safe: unknown venues prefetch nothing.
 */
export function prefetchVenueMarquee(venueId: string): void {
  prefetchModels(marqueeModelsForVenue(venueId));
}

export interface ProgressiveGlb {
  /**
   * Low-detail, always-bundled placeholder to show instantly. Null when the
   * model has no low variant (caller just waits for `full`).
   */
  placeholder: string | null;
  /** Full-detail model (CDN→cache, else bundled). Resolves async. */
  full: Promise<string | null>;
}

/**
 * Progressive resolution: a tiny bundled placeholder that's ready (nearly)
 * instantly, plus a promise for the full model. The screen renders the
 * placeholder first, then swaps to `full` when it resolves — never a blank
 * spinner. The placeholder is bundled-only (never fetched remotely) so it
 * stays instant and offline-safe.
 */
export async function resolveModelProgressive(
  modelId: string,
): Promise<ProgressiveGlb> {
  const lowId = lowDetailModelId(modelId);
  const placeholder = lowId ? await getBundledGlbUri(lowId) : null;
  return { placeholder, full: resolveModelGlb(modelId) };
}
