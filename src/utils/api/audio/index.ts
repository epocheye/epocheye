/**
 * Audio guide API module.
 * Wraps /api/v1/audio/* on the Go backend.
 *
 * Clips are pre-generated offline and uploaded to the CDN; this endpoint only
 * serves the pointers plus transcripts. It is user-authenticated but carries no
 * scan-quota gating — listening never consumes a recognition scan.
 */

import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';
import type { ApiResult, AudioPersona, AudioStopsResponse } from './types';

export type {
  ApiResult,
  AudioClip,
  AudioPersona,
  AudioStop,
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
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<AudioStopsResponse>('/api/v1/audio/stops', {
      params: { monument_id: monumentId, lang, persona },
    });
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
