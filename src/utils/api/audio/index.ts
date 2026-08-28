/**
 * Audio guide API module. Wraps /api/v1/audio/* on the Go backend.
 *
 * Clips are pre-generated offline and uploaded to the CDN; this endpoint only
 * serves the pointers plus transcripts. It is user-authenticated but carries no
 * scan-quota gating — listening never consumes a recognition scan
 * (apis/audio/routes.go says why in full).
 *
 * TWO CALL SIGNATURES, ONE REQUEST. The audio guide screen wants positional
 * arguments, the journey wants an options object. `listAudioStops` in ./Audio
 * is the only place the request is actually built; `getAudioStops` below is a
 * three-line adapter onto it. Duplicating the axios call instead would give the
 * two screens two ways to drift from the endpoint.
 */

import { listAudioStops } from './Audio';
import type { ApiResult, AudioPersona, AudioStopsResponse } from './types';

export * from './Audio';

export type {
  ApiResult,
  AudioClip,
  AudioClipTier,
  AudioPersona,
  AudioResult,
  AudioStop,
  AudioStopGroup,
  AudioStopsQuery,
  AudioStopsResponse,
  AudioTier,
} from './types';
export { AUDIO_PERSONAS } from './types';

/**
 * GET /api/v1/audio/stops — a venue's active stops in sort order, each with the
 * single clip matching lang + persona.
 *
 * The server falls back to English per stop when the requested language has no
 * clip, and sets `fallback_lang` on the response when any stop did so.
 */
export async function getAudioStops(
  monumentId: string,
  lang: string,
  persona: AudioPersona,
): Promise<ApiResult<AudioStopsResponse>> {
  return listAudioStops(monumentId, { lang, persona });
}
