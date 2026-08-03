/**
 * Pure helpers for the audio guide screen — grouping, formatting and the
 * entry-point gate. Kept out of the screen so they can be unit-tested without
 * rendering (see __tests__/services/audioGuide.test.ts).
 */

import type { AudioPersona, AudioStop } from '../../utils/api/audio/types';

/**
 * i18n key per persona. Lives here rather than in either screen because both
 * the audio guide's switcher and the Settings control render the same three
 * labels — two copies would drift the moment one is reworded.
 */
export const PERSONA_LABEL_KEY: Record<AudioPersona, string> = {
  casual: 'audioGuide.personaCasual',
  history_buff: 'audioGuide.personaHistoryBuff',
  child: 'audioGuide.personaChild',
};

/** One zone's worth of stops. `zone` is null for the ungrouped bucket. */
export interface AudioZoneGroup {
  zone: string | null;
  stops: AudioStop[];
}

/**
 * Formats a clip duration as m:ss. Negative, NaN and missing values collapse to
 * "0:00" rather than rendering "NaN:aN" — duration_ms is NOT NULL server-side,
 * but a stale cached payload should not be able to break the row.
 */
export function formatClipDuration(ms: number | undefined | null): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
    return '0:00';
  }
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Groups stops by `zone`, preserving the server's ordering.
 *
 * Two rules the screen depends on:
 *  - Ungrouped stops (no `zone`) form a single bucket that comes FIRST, so a
 *    venue that never bothered with zones reads as one plain list.
 *  - Named zones follow in first-appearance order. The server already returns
 *    stops ordered by (sort_order, stop_key), so first-appearance IS sort order
 *    and no re-sorting is needed — re-sorting here would silently override an
 *    editor's chosen sequence.
 */
export function groupStopsByZone(stops: AudioStop[]): AudioZoneGroup[] {
  const ungrouped: AudioStop[] = [];
  const named = new Map<string, AudioStop[]>();

  for (const stop of stops) {
    const zone = stop.zone?.trim();
    if (!zone) {
      ungrouped.push(stop);
      continue;
    }
    const bucket = named.get(zone);
    if (bucket) {
      bucket.push(stop);
    } else {
      named.set(zone, [stop]);
    }
  }

  const groups: AudioZoneGroup[] = [];
  if (ungrouped.length > 0) {
    groups.push({ zone: null, stops: ungrouped });
  }
  for (const [zone, zoneStops] of named) {
    groups.push({ zone, stops: zoneStops });
  }
  return groups;
}

/** True when a stop has a clip that can actually be played. */
export function isPlayable(stop: AudioStop): boolean {
  return !!stop.clip?.audio_url;
}

/**
 * True when a stop has a restoration to reveal. Gates the "See it restored"
 * entry point. Deliberately keyed on the IMAGE only: a caption without an image
 * has nothing to caption, while an image without a caption is merely
 * uncaptioned — still worth showing.
 */
export function hasRestoration(stop: AudioStop): boolean {
  return !!stop.restoration_image_url?.trim();
}

/**
 * Where the wipe divides the frame, in pixels, for a handle at `fraction`
 * across a `width`-wide image. Shared by the on-screen wipe and the saved
 * composite so the exported file matches what the user was looking at — the
 * whole point of exporting "the wipe as you left it".
 *
 * Clamped to [0,1]: a drag can overshoot the track, and a split outside the
 * image would render one side blank.
 */
export function wipeSplitX(fraction: number, width: number): number {
  if (!Number.isFinite(fraction) || !Number.isFinite(width) || width <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, fraction)) * width;
}

/**
 * Whether the "Listen — audio guide" CTA shows on a site page.
 *
 * The product rule is on-site only: the guide is meant to be used while
 * standing in the venue, so the geofence must have resolved THIS site.
 * `adminBypass` lifts that for internal accounts so the screen is reachable for
 * testing from anywhere — a UI affordance only, since the endpoint itself is
 * plain user-auth and returns identical data to everyone.
 *
 * ADMIN-HARNESS: drop the bypass argument when the Konark-era internal tools go.
 */
export function shouldShowAudioCta(args: {
  hasStops: boolean;
  atThisVenue: boolean;
  adminBypass: boolean;
}): boolean {
  const { hasStops, atThisVenue, adminBypass } = args;
  return hasStops && (atThisVenue || adminBypass);
}
