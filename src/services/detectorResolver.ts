/**
 * Detector resolution precedence — "grounded wins, Gemini is fallback-only".
 *
 * The Roboflow detector returns an exact class_id. The class_id rows seeded in
 * the DB ARE the registry. Strict, ordered precedence (truth beats fluency):
 *
 *   1. class_id ≥ commit threshold AND the lookup returns a row WITH a narrative
 *      → GROUNDED card. STOP. Gemini is never called.
 *   2. lookup returns a row but no narrative → MINIMAL grounded label. STOP.
 *      Gemini is never called.
 *   3. no detection above the commit threshold, OR the class_id isn't in the
 *      registry (404) → FALLBACK. This is the ONLY path that may call Gemini
 *      (the caller runs /vision/identify, rendered as a clearly-labelled,
 *      visually distinct "AI guess — not verified" card).
 *
 * The grounded card always wins above the commit threshold, even if Gemini might
 * have produced a "more detailed" answer. The Gemini fallback must never render
 * on the same screen as a grounded card.
 *
 * The class_id lookup is a single indexed GET (no Gemini server-side either).
 */

import axios from 'axios';
import { ROBOFLOW_COMMIT_CONFIDENCE } from '@env';
import { BACKEND_URL } from '../constants/onboarding';
import { getValidAccessToken } from '../utils/api/auth';
import { topPrediction, type RoboflowResult } from './roboflowDetectionService';

/** Grounded data card returned by GET /api/v1/vision/object/{class_id}. */
export interface ObjectCard {
  class_id: string;
  display_name: string;
  period: string;
  dynasty: string;
  material: string;
  origin: string;
  /** 'inferred' → render hedged; 'placard_confirmed' → state as fact. */
  identity_confidence: 'inferred' | 'placard_confirmed' | string;
  narrative: string;
  iconography: string;
  has_reconstruction: boolean;
}

export type DetectorResolution =
  | { kind: 'grounded'; card: ObjectCard; classId: string; confidence: number }
  | { kind: 'minimal'; card: ObjectCard; classId: string; confidence: number }
  | {
      kind: 'fallback';
      reason: 'no_detection' | 'low_confidence' | 'not_in_registry';
      classId?: string;
      confidence?: number;
    };

const OBJECT_URL = `${BACKEND_URL}/api/v1/vision/object`;
const LOOKUP_TIMEOUT_MS = 12_000;

/** Commit threshold for trusting a detection enough to ground/commit to it. */
export function commitThreshold(): number {
  const parsed = parseFloat(ROBOFLOW_COMMIT_CONFIDENCE ?? '');
  return Number.isFinite(parsed) ? parsed : 0.7;
}

/**
 * Fetch the grounded card for a class_id. Returns the card on 200, null on 404
 * (not in registry). Throws (caller treats a transport error as "not grounded"
 * → fallback) on other failures.
 */
export async function fetchObjectCard(classId: string): Promise<ObjectCard | null> {
  const token = await getValidAccessToken();
  try {
    const res = await axios.get<ObjectCard>(
      `${OBJECT_URL}/${encodeURIComponent(classId)}`,
      {
        timeout: LOOKUP_TIMEOUT_MS,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );
    return res.data ?? null;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null; // not in registry
    }
    throw err;
  }
}

/**
 * Apply the precedence rules to a detector result. Never calls Gemini — a
 * `fallback` resolution tells the caller it MAY run the Gemini identify path.
 */
export async function resolveDetection(
  result: RoboflowResult,
): Promise<DetectorResolution> {
  const top = topPrediction(result);
  if (!top) {
    return { kind: 'fallback', reason: 'no_detection' };
  }
  if (top.confidence < commitThreshold()) {
    return {
      kind: 'fallback',
      reason: 'low_confidence',
      classId: top.class,
      confidence: top.confidence,
    };
  }

  let card: ObjectCard | null;
  try {
    card = await fetchObjectCard(top.class);
  } catch {
    // Lookup transport failure → treat as not-grounded so the user still gets
    // the (clearly-labelled) fallback rather than a hard error.
    return {
      kind: 'fallback',
      reason: 'not_in_registry',
      classId: top.class,
      confidence: top.confidence,
    };
  }

  if (!card) {
    return {
      kind: 'fallback',
      reason: 'not_in_registry',
      classId: top.class,
      confidence: top.confidence,
    };
  }

  const hasNarrative = !!card.narrative && card.narrative.trim().length > 0;
  return {
    kind: hasNarrative ? 'grounded' : 'minimal',
    card,
    classId: top.class,
    confidence: top.confidence,
  };
}
