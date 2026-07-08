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
const RECOGNIZE_RESULT_URL = `${BACKEND_URL}/api/v1/recognize/result`;
// Recognition is async (submit + poll) so it never depends on finishing inside the
// API Gateway 29s limit. The submit returns fast — either a terminal result (cache
// hit / gate / paywall) or {match:'processing', job_id}. On 'processing' we poll the
// result endpoint until the out-of-band agent finishes.
// Submit just persists + kicks the worker, so 10s is plenty when the async
// worker is deployed. In dev we allow up to 28s (just under API Gateway's 29s
// integration cap) to tolerate a slow/synchronous backend while testing — RN
// surfaces an XHR timeout as ERR_NETWORK, so too-low a value here masks backend
// latency as a fake "network error". Production keeps the tight 10s.
const SUBMIT_TIMEOUT_MS = __DEV__ ? 28_000 : 10_000;
const POLL_TIMEOUT_MS = 8_000; // per poll request
const POLL_INTERVAL_MS = 1_500; // between polls
const POLL_DEADLINE_MS = 45_000; // hard cap → graceful "try again", never an infinite spin

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
/** Submit/poll wire shape: a normal result may instead carry an async job handle. */
type RecognizeWire = Omit<RecognizeResult, 'match'> & {
  match: RecognizeMatch | 'processing' | 'error';
  job_id?: string;
};

const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), ms);
  });

/**
 * Poll GET /api/v1/recognize/result?id= until the out-of-band agent finishes. Resolves
 * with the final result, or throws on a terminal error / once the deadline is hit (the
 * caller turns a throw into the calm "try again" UI — never an infinite spinner).
 */
async function pollResult(
  jobId: string,
  token: string | null,
  signal?: AbortSignal,
): Promise<RecognizeResult> {
  const deadline = Date.now() + POLL_DEADLINE_MS;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('recognition aborted');
    await sleep(POLL_INTERVAL_MS);
    if (signal?.aborted) throw new Error('recognition aborted');
    let data: RecognizeWire;
    try {
      const res = await axios.get<RecognizeWire>(RECOGNIZE_RESULT_URL, {
        params: {id: jobId},
        timeout: POLL_TIMEOUT_MS,
        headers: token ? {Authorization: `Bearer ${token}`} : undefined,
        signal,
      });
      data = res.data;
    } catch {
      // Stop immediately if we were aborted; otherwise treat as a transient blip.
      if (signal?.aborted) throw new Error('recognition aborted');
      continue; // transient poll error — keep trying until the deadline
    }
    if (data.match === 'processing') continue;
    if (data.match === 'error') {
      throw new Error(data.message || 'recognition failed');
    }
    return data as RecognizeResult;
  }
  throw new Error('recognition timed out');
}

export async function recognize(
  params: RecognizeParams,
  signal?: AbortSignal,
): Promise<RecognizeResult> {
  const token = await getValidAccessToken();
  try {
    const res = await axios.post<RecognizeWire>(
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
        timeout: SUBMIT_TIMEOUT_MS,
        headers: token ? {Authorization: `Bearer ${token}`} : undefined,
        signal,
      },
    );
    // Cache miss → the backend queued the agent and returned a job handle. Poll for
    // the final card. Cache hits / gate / out_of_venue come back terminal here.
    if (res.data.match === 'processing' && res.data.job_id) {
      return await pollResult(res.data.job_id, token, signal);
    }
    return res.data as RecognizeResult;
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
