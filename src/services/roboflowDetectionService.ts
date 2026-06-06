/**
 * Roboflow hosted-inference object detection.
 *
 * The trained detector is served by Roboflow as a hosted inference URL (the
 * model file itself is NOT downloadable — only this remote endpoint). We POST a
 * base64 JPEG and parse class + confidence + 2D box.
 *
 * Config-driven (never hardcode the URL/key) via `@env`:
 *   ROBOFLOW_DETECT_URL     full POST endpoint, e.g.
 *                           https://detect.roboflow.com/<model>/<version>
 *   ROBOFLOW_API_KEY        the workspace API key (passed as ?api_key=)
 *   ROBOFLOW_MODEL          informational label only
 *   ROBOFLOW_MIN_CONFIDENCE confidence gate, 0..1 (default 0.5)
 *   ROBOFLOW_MOCK_CLASS     class label used by the mock provider
 *
 * If ROBOFLOW_DETECT_URL is empty the service returns a single canned, centered
 * prediction (the MOCK provider) so the rest of the detect->place chain is
 * testable before the real model ships. Setting the URL switches to live HTTP
 * with no other code change.
 *
 * NOTE on coordinates: Roboflow returns box `x,y` as the box CENTER in
 * source-image pixels (not top-left). For floor placement we also expose the
 * box BASE-CENTER (bottom-middle), which is the point that should be hit-tested
 * against the floor plane.
 */

import axios from 'axios';
import {
  ROBOFLOW_DETECT_URL,
  ROBOFLOW_API_KEY,
  ROBOFLOW_MODEL,
  ROBOFLOW_MIN_CONFIDENCE,
  ROBOFLOW_MOCK_CLASS,
} from '@env';

export interface RoboflowPrediction {
  class: string;
  classId: number;
  confidence: number;
  /** Box center + size, in SOURCE-IMAGE pixels. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Box base-center (bottom-middle), in SOURCE-IMAGE pixels. */
  baseX: number;
  baseY: number;
  /** Same points normalized 0..1 against the source image (resolution-agnostic). */
  nCx: number;
  nCy: number;
  nBaseX: number;
  nBaseY: number;
  /** Source-image dimensions the box is expressed against. */
  imageW: number;
  imageH: number;
}

interface DetectSuccess {
  success: true;
  data: RoboflowPrediction[];
  /** True when the canned mock provider produced this (no live URL configured). */
  mock: boolean;
}
interface DetectFailure {
  success: false;
  error: string;
}
export type RoboflowResult = DetectSuccess | DetectFailure;

const TIMEOUT_MS = 15_000;

function minConfidence(): number {
  const parsed = parseFloat(ROBOFLOW_MIN_CONFIDENCE ?? '');
  return Number.isFinite(parsed) ? parsed : 0.5;
}

/** Whether a live hosted endpoint is configured (vs. the mock provider). */
export function isRoboflowConfigured(): boolean {
  return !!ROBOFLOW_DETECT_URL && ROBOFLOW_DETECT_URL.trim().length > 0;
}

/** Raw Roboflow prediction shape (classic hosted inference response). */
interface RawPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id?: number;
}

function toPrediction(
  p: RawPrediction,
  imageW: number,
  imageH: number,
): RoboflowPrediction {
  const baseX = p.x;
  const baseY = p.y + p.height / 2;
  const safeW = imageW || 1;
  const safeH = imageH || 1;
  return {
    class: p.class,
    classId: p.class_id ?? 0,
    confidence: p.confidence,
    cx: p.x,
    cy: p.y,
    w: p.width,
    h: p.height,
    baseX,
    baseY,
    nCx: p.x / safeW,
    nCy: p.y / safeH,
    nBaseX: baseX / safeW,
    nBaseY: baseY / safeH,
    imageW: safeW,
    imageH: safeH,
  };
}

/**
 * Mock provider: one centered box covering the middle ~40% of a nominal frame,
 * with its base-center near the lower third — a realistic "object on the floor"
 * stand-in so the AR hit-test path can be exercised end-to-end.
 */
function mockResult(): DetectSuccess {
  const imageW = 1000;
  const imageH = 1000;
  const w = 400;
  const h = 400;
  const cx = 500;
  const cy = 520;
  const raw: RawPrediction = {
    x: cx,
    y: cy,
    width: w,
    height: h,
    confidence: 0.9,
    class: (ROBOFLOW_MOCK_CLASS && ROBOFLOW_MOCK_CLASS.trim()) || 'object',
    class_id: 0,
  };
  return { success: true, data: [toPrediction(raw, imageW, imageH)], mock: true };
}

function buildUrl(): string {
  const base = ROBOFLOW_DETECT_URL.trim();
  const params: string[] = [];
  if (ROBOFLOW_API_KEY && ROBOFLOW_API_KEY.trim()) {
    params.push(`api_key=${encodeURIComponent(ROBOFLOW_API_KEY.trim())}`);
  }
  // Server-side gate too; we also gate client-side below.
  params.push(`confidence=${Math.round(minConfidence() * 100)}`);
  params.push('format=json');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${params.join('&')}`;
}

/**
 * Run detection on a base64-encoded JPEG. Returns predictions already filtered
 * by the confidence gate and sorted high→low confidence. base-center is filled
 * for floor placement.
 */
export async function detectObjects(imageBase64: string): Promise<RoboflowResult> {
  const gate = minConfidence();

  if (!isRoboflowConfigured()) {
    if (__DEV__) {
      console.log('[roboflow] no ROBOFLOW_DETECT_URL — using mock provider');
    }
    const mock = mockResult();
    return { ...mock, data: mock.data.filter(p => p.confidence >= gate) };
  }

  try {
    const response = await axios.post(buildUrl(), imageBase64, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: TIMEOUT_MS,
    });

    const body = response.data ?? {};
    const imageW: number = body.image?.width ?? 0;
    const imageH: number = body.image?.height ?? 0;
    const rawPreds: RawPrediction[] = Array.isArray(body.predictions)
      ? body.predictions
      : [];

    const preds = rawPreds
      .filter(
        p =>
          p &&
          typeof p.x === 'number' &&
          typeof p.y === 'number' &&
          typeof p.width === 'number' &&
          typeof p.height === 'number' &&
          typeof p.confidence === 'number' &&
          typeof p.class === 'string',
      )
      .map(p => toPrediction(p, imageW, imageH))
      .filter(p => p.confidence >= gate)
      .sort((a, b) => b.confidence - a.confidence);

    if (__DEV__) {
      console.log(
        `[roboflow] model=${ROBOFLOW_MODEL || '?'} preds=${rawPreds.length} kept=${preds.length} gate=${gate}`,
      );
    }
    return { success: true, data: preds, mock: false };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED') {
        return { success: false, error: 'Detection timed out — hold steady and retry' };
      }
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        return { success: false, error: 'Detector auth failed — check ROBOFLOW_API_KEY' };
      }
      if (status === 429) {
        return { success: false, error: 'Rate limit reached — try again shortly' };
      }
      return { success: false, error: `Detector API error (${status ?? 'network'})` };
    }
    return { success: false, error: 'Detection failed — try again' };
  }
}

/** Convenience: the single best prediction above the gate, or null. */
export function topPrediction(result: RoboflowResult): RoboflowPrediction | null {
  return result.success && result.data.length > 0 ? result.data[0] : null;
}
