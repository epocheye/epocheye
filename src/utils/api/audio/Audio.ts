import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';
import type {
  AudioResult,
  AudioStop,
  AudioStopGroup,
  AudioStopsQuery,
  AudioStopsResponse,
} from './types';

/**
 * List a venue's audio stops (user-auth; NOT scan-quota gated). `monumentId`
 * is the venue SLUG — the same key as viewing stations and the site bundle.
 * The server falls back per stop to 'en' when a clip is missing in `lang`
 * and reports it via `fallback_lang`; stops with nothing recorded at all
 * come back without a `clip`.
 */
export async function listAudioStops(
  monumentId: string,
  query: AudioStopsQuery = {},
): Promise<AudioResult<AudioStopsResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<AudioStopsResponse>('/api/v1/audio/stops', {
      params: {
        monument_id: monumentId,
        ...(query.lang ? { lang: query.lang } : {}),
        ...(query.persona ? { persona: query.persona } : {}),
      },
    });
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Stops in walking order: by sort_order, then stop_key for a stable tie-break.
 * Pure; returns a new array. The server already sorts, but the guide's
 * next/previous arithmetic depends on the order, so it is pinned here too.
 */
export function sortStops(stops: ReadonlyArray<AudioStop>): AudioStop[] {
  return [...stops].sort(
    (a, b) => a.sort_order - b.sort_order || a.stop_key.localeCompare(b.stop_key),
  );
}

/**
 * Group sorted stops by zone, keeping walking order: a zone appears where its
 * first stop does, and a stop whose zone is absent/blank goes into a `null`
 * group of its own at that point. Pure — the guide step renders one section
 * per group and advances through the flattened order.
 */
export function groupStopsByZone(stops: ReadonlyArray<AudioStop>): AudioStopGroup[] {
  const groups: AudioStopGroup[] = [];
  let current: AudioStopGroup | null = null;
  for (const stop of sortStops(stops)) {
    const zone = stop.zone?.trim() ? stop.zone.trim() : null;
    if (!current || current.zone !== zone) {
      current = { zone, stops: [] };
      groups.push(current);
    }
    current.stops.push(stop);
  }
  return groups;
}
