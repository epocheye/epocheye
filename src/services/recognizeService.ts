/**
 * Primary recognition client — POST /api/v1/recognize.
 *
 * This replaces Roboflow as the primary recognizer. The app captures ONE frame on
 * intent and posts it (base64) with the active venue; the backend runs the
 * three-layer agent (observe → reason → narrate, two-gate grounding) behind a
 * shared per-venue perceptual-hash cache and returns a single JSON result:
 *
 *   - match: 'grounded'          → a verified/likely museum object (use class_id to
 *                                  fetch the grounded card + place the GLB).
 *   - match: 'ai_interpretation' → no confident grounded match; a clearly-labelled
 *                                  "AI interpretation — not verified" card.
 *   - match: 'out_of_venue'      → no seeded corpus here; caller falls back to the
 *                                  cheap universal /vision/identify museum mode.
 *
 * Recognition is decoupled from GLB delivery: this returns a class_id; the existing
 * glbSource pipeline (CloudFront → cache → bundled) handles the model.
 */

import axios from 'axios';
import {BACKEND_URL} from '../constants/onboarding';
import {getValidAccessToken} from '../utils/api/auth';

const RECOGNIZE_URL = `${BACKEND_URL}/api/v1/recognize`;
// The agent runs ~4 Gemini calls on a cache MISS; give it room. Cache HITs return
// near-instantly. The backend caps its own chain well under this.
const RECOGNIZE_TIMEOUT_MS = 32_000;

export type RecognizeMatch =
  | 'grounded'
  | 'ai_interpretation'
  | 'out_of_venue'
  | 'out_of_scope'
  | 'paywall'
  | 'daily_limit';

/** The agent's Layer-3 card (grounded or AI). Mirrors the backend `Card` shape. */
export interface RecognizeCard {
  source: 'grounded' | 'ai_interpretation' | string;
  verified: boolean;
  hedged: boolean;
  label: string;
  title: string;
  subtitle?: string;
  body: string;
  iconography?: string;
  class_id?: string;
  disclaimer?: string;
}

export interface RecognizeResult {
  match: RecognizeMatch;
  /** Human-readable note (e.g. the polite "not an exhibit here" tip). */
  message?: string;
  source?: string;
  card?: RecognizeCard;
  class_id?: string;
  grounded_eligible: boolean;
  /** Two-gate numbers (for telemetry/debug; the UI keys off `match`). */
  best_similarity: number;
  similarity_floor: number;
  llm_confidence: number;
  confidence_floor: number;
  cached: boolean;
  tier: string;
  /** Free scans left at this venue after this serve (undefined when ungated). */
  remaining?: number;
  /** Present only when match === 'paywall' (HTTP 402). */
  paywall?: {siteId: string; used: number; limit: number};
}

export interface RecognizeParams {
  imageBase64: string;
  venueId: string;
  lat?: number;
  lng?: number;
  question?: string;
  /**
   * Dev-build "scan anything": ask the backend to run the agent on any object,
   * outside a seeded venue and without the paywall. The server only honors this
   * for admins / RECOGNIZE_DEV_UNGROUNDED — production users stay geofenced.
   */
  allowUngrounded?: boolean;
}

/**
 * Run primary recognition on a captured frame. Throws on transport/HTTP failure so
 * the caller can show a calm "try again" message.
 */
export async function recognize(params: RecognizeParams): Promise<RecognizeResult> {
  const token = await getValidAccessToken();
  try {
    const res = await axios.post<RecognizeResult>(
      RECOGNIZE_URL,
      {
        image_base64: params.imageBase64,
        venue_id: params.venueId,
        lat: params.lat,
        lng: params.lng,
        question: params.question,
        allow_ungrounded: params.allowUngrounded === true,
      },
      {
        timeout: RECOGNIZE_TIMEOUT_MS,
        headers: token ? {Authorization: `Bearer ${token}`} : undefined,
      },
    );
    return res.data;
  } catch (err) {
    // HTTP 402 = per-site free-scan allowance spent. Surface as a paywall result
    // (not an error) so the caller can route to the Explorer-Pass purchase.
    if (axios.isAxiosError(err) && err.response?.status === 402) {
      const body = err.response.data as {
        site_id?: string;
        used?: number;
        limit?: number;
      };
      return {
        match: 'paywall',
        grounded_eligible: false,
        best_similarity: 0,
        similarity_floor: 0,
        llm_confidence: 0,
        confidence_floor: 0,
        cached: false,
        tier: 'paywall',
        paywall: {
          siteId: body?.site_id ?? params.venueId,
          used: body?.used ?? 0,
          limit: body?.limit ?? 0,
        },
      };
    }
    throw err;
  }
}
