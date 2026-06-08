/**
 * Roboflow hosted-inference object detection — via the backend proxy.
 *
 * The trained detector is served by Roboflow as a hosted WORKFLOW endpoint, and
 * that workflow only accepts the full-access (private) API key. To keep that key
 * out of the mobile bundle we never call Roboflow directly: the app POSTs the
 * base64 frame to our backend (`POST /api/v1/vision/roboflow-detect`), which
 * injects ROBOFLOW_API_KEY server-side, forwards to the workflow, and relays the
 * response. Same rationale as the Gemini proxy.
 *
 * Config (`@env`):
 *   ROBOFLOW_ENABLED        'true' → call the live backend proxy; anything else
 *                           → built-in mock provider (so the detect→place chain
 *                           is testable before the detector is wired/deployed).
 *   ROBOFLOW_MIN_CONFIDENCE confidence gate, 0..1 (default 0.5).
 *   ROBOFLOW_MOCK_CLASS     class label the mock provider returns.
 *
 * The private key + workflow URL live ONLY on the backend
 * (ROBOFLOW_API_KEY / ROBOFLOW_WORKFLOW_URL).
 *
 * Workflow response envelope:
 *   { outputs: [ { predictions: { image: {width,height}|null,
 *                                 predictions: [ {x,y,width,height,confidence,
 *                                                 class,class_id}, ... ] } } ] }
 * The `image` block can come back null, so we fall back to reading the frame's
 * dimensions from the JPEG itself (placement normalizes the box to 0..1).
 *
 * NOTE on coordinates: Roboflow returns box `x,y` as the box CENTER in
 * source-image pixels (not top-left). For floor placement we also expose the
 * box BASE-CENTER (bottom-middle), which is the point hit-tested against the
 * floor plane.
 */

import axios from 'axios';
import {
  ROBOFLOW_ENABLED,
  ROBOFLOW_MIN_CONFIDENCE,
  ROBOFLOW_MOCK_CLASS,
} from '@env';
import { BACKEND_URL } from '../constants/onboarding';
import { getValidAccessToken } from '../utils/api/auth';

const PROXY_URL = `${BACKEND_URL}/api/v1/vision/roboflow-detect`;

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
  /** True when the canned mock provider produced this (no live detector). */
  mock: boolean;
}
interface DetectFailure {
  success: false;
  error: string;
}
export type RoboflowResult = DetectSuccess | DetectFailure;

const TIMEOUT_MS = 20_000;

function minConfidence(): number {
  const parsed = parseFloat(ROBOFLOW_MIN_CONFIDENCE ?? '');
  return Number.isFinite(parsed) ? parsed : 0.5;
}

/** Whether the live detector (backend proxy) is enabled vs. the mock provider. */
export function isRoboflowConfigured(): boolean {
  return (ROBOFLOW_ENABLED ?? '').trim().toLowerCase() === 'true';
}

/** Raw Roboflow detection prediction (same fields for classic + workflow). */
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

const B64_LOOKUP: Int16Array = (() => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const table = new Int16Array(256).fill(-1);
  for (let i = 0; i < chars.length; i++) table[chars.charCodeAt(i)] = i;
  return table;
})();

/* eslint-disable no-bitwise -- base64 decode + JPEG marker walking are inherently bit/byte ops */

/** Decode a base64 string to bytes (ignores whitespace / data: prefix). */
function base64ToBytes(b64: string): Uint8Array | null {
  try {
    let clean = b64;
    const comma = clean.indexOf(',');
    if (clean.startsWith('data:') && comma >= 0) clean = clean.slice(comma + 1);
    const len = clean.length;
    const out = new Uint8Array(Math.floor((len * 3) / 4) + 3);
    let o = 0;
    let acc = 0;
    let accBits = 0;
    for (let i = 0; i < len; i++) {
      const v = B64_LOOKUP[clean.charCodeAt(i)];
      if (v < 0) continue; // skip '=', newlines, etc.
      acc = (acc << 6) | v;
      accBits += 6;
      if (accBits >= 8) {
        accBits -= 8;
        out[o++] = (acc >> accBits) & 0xff;
      }
    }
    return out.subarray(0, o);
  } catch {
    return null;
  }
}

/**
 * Reads {width,height} from a base64-encoded JPEG by walking its segment
 * markers. Used as a fallback when the workflow response omits image dimensions
 * (its `image` block can be null) — the AR placement normalizes the detection
 * box against the source size, so we need real dimensions. Returns null if the
 * bytes aren't a parseable JPEG.
 */
function jpegSizeFromBase64(
  b64: string,
): { width: number; height: number } | null {
  const bytes = base64ToBytes(b64);
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null; // not a JPEG (no SOI)
  }
  let off = 2;
  while (off + 1 < bytes.length) {
    if (bytes[off] !== 0xff) {
      off++;
      continue;
    }
    let marker = bytes[off + 1];
    // Collapse any 0xFF fill bytes.
    while (marker === 0xff && off + 2 < bytes.length) {
      off++;
      marker = bytes[off + 1];
    }
    off += 2;
    // Standalone markers (no length payload): TEM(01), RSTn(D0-D7), SOI/EOI(D8/D9).
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) continue;
    if (off + 1 >= bytes.length) break;
    const segLen = (bytes[off] << 8) | bytes[off + 1];
    if (segLen < 2) break;
    // SOF markers carry frame size: C0-CF except DHT(C4), JPG(C8), DAC(CC).
    const isSOF =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSOF) {
      if (off + 6 >= bytes.length) break;
      const height = (bytes[off + 3] << 8) | bytes[off + 4];
      const width = (bytes[off + 5] << 8) | bytes[off + 6];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    off += segLen;
  }
  return null;
}

/* eslint-enable no-bitwise */

/** Pull the workflow detections + image dims out of the proxy response. */
function parseWorkflowBody(
  body: any,
  imageBase64: string,
): { preds: RawPrediction[]; imageW: number; imageH: number } {
  // Envelope: outputs[0].predictions = { image: {width,height}|null, predictions: [...] }
  const block = Array.isArray(body?.outputs)
    ? body.outputs[0]?.predictions
    : undefined;
  const preds: RawPrediction[] = Array.isArray(block?.predictions)
    ? block.predictions
    : [];

  let imageW = Number(block?.image?.width) || 0;
  let imageH = Number(block?.image?.height) || 0;
  if (!imageW || !imageH) {
    const size = jpegSizeFromBase64(imageBase64);
    if (size) {
      imageW = size.width;
      imageH = size.height;
    }
  }
  return { preds, imageW, imageH };
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
      console.log('[roboflow] ROBOFLOW_ENABLED not set — using mock provider');
    }
    const mock = mockResult();
    return { ...mock, data: mock.data.filter(p => p.confidence >= gate) };
  }

  try {
    const token = await getValidAccessToken();
    const response = await axios.post(
      PROXY_URL,
      { image_base64: imageBase64 },
      {
        timeout: TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );

    const { preds: rawPreds, imageW, imageH } = parseWorkflowBody(
      response.data ?? {},
      imageBase64,
    );

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
        `[roboflow] preds=${rawPreds.length} kept=${preds.length} gate=${gate} dims=${imageW}x${imageH}`,
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
        return { success: false, error: 'Session expired — please sign in again' };
      }
      if (status === 503) {
        return { success: false, error: 'Detector not configured on the server yet' };
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
