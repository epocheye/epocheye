/**
 * Gemini 2.5 Flash Vision API service for heritage identification.
 *
 * Sends a camera-captured image to Gemini and receives a structured
 * identification response: monument name, historical period, cultural
 * significance, and a surprising fact.
 *
 * Uses direct REST calls via axios. Images are resized + recompressed
 * locally via Skia before upload so request payloads stay small even on
 * weak networks.
 */

import axios from 'axios';
import { readFile as fsReadFile } from '@dr.pogodin/react-native-fs';
import {
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
} from '@shopify/react-native-skia';
import { GEMINI_API_KEY } from '@env';

// ── Types ──────────────────────────────────────────────────────────

export interface GeminiIdentification {
  name: string;
  period: string;
  significance: string;
  fact: string;
}

export type GeminiErrorCode =
  | 'timeout'
  | 'rate_limit'
  | 'http_error'
  | 'blocked'
  | 'parse_failed'
  | 'empty'
  | 'network'
  | 'no_api_key';

interface GeminiSuccess {
  success: true;
  data: GeminiIdentification;
}

interface GeminiFailure {
  success: false;
  error: string;
  code: GeminiErrorCode;
}

export type GeminiResult = GeminiSuccess | GeminiFailure;

// ── Constants ──────────────────────────────────────────────────────

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const TIMEOUT_MS = 15_000;

const IMAGE_MAX_EDGE = 1024;
const IMAGE_JPEG_QUALITY = 82;

// In-memory dedup: prevent duplicate requests for the same context
let pendingRequest: Promise<GeminiResult> | null = null;
let pendingKey = '';

// In-memory cache: skip re-identification within 30s for the same zone
let lastResult: { key: string; result: GeminiResult; timestamp: number } | null =
  null;
const RESULT_CACHE_TTL_MS = 30_000;

// ── Prompt ─────────────────────────────────────────────────────────

function buildPrompt(siteHint?: string): string {
  const base = [
    'You are a heritage monument and artifact identification AI specializing in Indian heritage sites.',
    'Analyze this image carefully.',
    'Return ONLY valid JSON with no markdown formatting, code fences, or extra text.',
    'Response format: {"name":"...","period":"...","significance":"...","fact":"..."}',
    '- name: The name of the monument, temple, sculpture, or artifact.',
    '- period: The historical era or approximate date (e.g. "13th Century CE", "Kalinga Period").',
    '- significance: Cultural or historical significance in 1-2 concise sentences.',
    '- fact: One surprising or lesser-known fact.',
    'If the image does not show a heritage site or artifact, return:',
    '{"name":"Unknown","period":"","significance":"Not identified as a heritage structure or artifact.","fact":""}',
  ];

  if (siteHint) {
    base.push(
      `The user is currently near "${siteHint}". Use this as context to improve identification accuracy.`,
    );
  }

  return base.join('\n');
}

// ── Helpers ─────────────────────────────────────────────────────────

function extractJSON(text: string): GeminiIdentification | null {
  try {
    return JSON.parse(text) as GeminiIdentification;
  } catch {
    // fall through
  }

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as GeminiIdentification;
    } catch {
      // fall through
    }
  }

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]) as GeminiIdentification;
    } catch {
      // give up
    }
  }

  return null;
}

// fetch('file://...') is unreliable on Android release builds (OkHttp scoped-storage
// issues), so we use native file I/O via react-native-fs.
export async function fileToBase64(uri: string): Promise<string> {
  const path = uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
  return fsReadFile(path, 'base64');
}

/**
 * Reads a captured JPEG, downscales it to IMAGE_MAX_EDGE on the longest
 * side, and re-encodes at IMAGE_JPEG_QUALITY. Raw camera JPEGs are often
 * 3–10 MB, which inflates ~33% once base64-encoded and causes both upload
 * timeouts on weak networks and occasional 400-too-large errors from
 * Gemini. The resized payload is typically 100–400 KB.
 *
 * Falls back to the raw base64 on any Skia failure so the pipeline degrades
 * gracefully instead of hard-erroring.
 */
export async function prepareImageForGemini(uri: string): Promise<string> {
  const raw = await fileToBase64(uri);

  try {
    const data = Skia.Data.fromBase64(raw);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) {
      return raw;
    }

    const srcW = image.width();
    const srcH = image.height();
    const longest = Math.max(srcW, srcH);
    const scale = longest > IMAGE_MAX_EDGE ? IMAGE_MAX_EDGE / longest : 1;
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const surface = Skia.Surface.MakeOffscreen(dstW, dstH);
    if (!surface) {
      return raw;
    }

    const canvas = surface.getCanvas();
    const src = Skia.XYWHRect(0, 0, srcW, srcH);
    const dst = Skia.XYWHRect(0, 0, dstW, dstH);
    const paint = Skia.Paint();
    canvas.drawImageRectOptions(
      image,
      src,
      dst,
      FilterMode.Linear,
      MipmapMode.None,
      paint,
    );
    surface.flush();

    const snapshot = surface.makeImageSnapshot();
    const encoded = snapshot.encodeToBase64(
      ImageFormat.JPEG,
      IMAGE_JPEG_QUALITY,
    );
    return encoded || raw;
  } catch (err) {
    if (__DEV__) {
      console.warn('[geminiVisionService.prepareImage] Skia resize failed', err);
    }
    return raw;
  }
}

function approxKB(base64: string): number {
  return Math.round((base64.length * 3) / 4 / 1024);
}

// ── Main API ────────────────────────────────────────────────────────

export async function identifyHeritage(
  imageBase64: string,
  siteHint?: string,
): Promise<GeminiResult> {
  const cacheKey = siteHint ?? 'general';
  if (
    lastResult &&
    lastResult.key === cacheKey &&
    Date.now() - lastResult.timestamp < RESULT_CACHE_TTL_MS
  ) {
    return lastResult.result;
  }

  if (pendingRequest && pendingKey === cacheKey) {
    return pendingRequest;
  }

  const request = executeRequest(imageBase64, siteHint, cacheKey);
  pendingRequest = request;
  pendingKey = cacheKey;

  try {
    return await request;
  } finally {
    pendingRequest = null;
    pendingKey = '';
  }
}

async function executeRequest(
  imageBase64: string,
  siteHint: string | undefined,
  cacheKey: string,
): Promise<GeminiResult> {
  if (!GEMINI_API_KEY) {
    return {
      success: false,
      error: 'Identification is unavailable right now',
      code: 'no_api_key',
    };
  }

  const started = Date.now();
  if (__DEV__) {
    console.log(
      `[geminiVision] request: img=${approxKB(imageBase64)}KB, siteHint=${siteHint ?? '(none)'}`,
    );
  }

  try {
    const response = await axios.post(
      `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: buildPrompt(siteHint) },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
        },
      },
      { timeout: TIMEOUT_MS },
    );

    const elapsed = Date.now() - started;
    const candidate = response.data?.candidates?.[0];
    const text: string = candidate?.content?.parts?.[0]?.text ?? '';
    const finishReason: string | undefined = candidate?.finishReason;
    const blockReason: string | undefined =
      response.data?.promptFeedback?.blockReason;

    if (__DEV__) {
      console.log(
        `[geminiVision] response: ${elapsed}ms, status=${response.status}, finish=${finishReason ?? '?'}, block=${blockReason ?? '-'}, textLen=${text.length}`,
      );
      if (text) {
        console.log(`[geminiVision] text: ${text.slice(0, 500)}`);
      }
    }

    if (blockReason) {
      return {
        success: false,
        error: "Couldn't process this image — try a different angle",
        code: 'blocked',
      };
    }

    if (!text) {
      return {
        success: false,
        error: 'No response from identification service — try again',
        code: 'empty',
      };
    }

    const parsed = extractJSON(text);
    if (!parsed || !parsed.name) {
      if (__DEV__) {
        console.warn('[geminiVision] parse failed for text:', text);
      }
      return {
        success: false,
        error: "Couldn't read the identification response — try again",
        code: 'parse_failed',
      };
    }

    const result: GeminiResult = { success: true, data: parsed };
    lastResult = { key: cacheKey, result, timestamp: Date.now() };
    return result;
  } catch (err: unknown) {
    const elapsed = Date.now() - started;
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (__DEV__) {
        console.warn(
          `[geminiVision] axios error: ${elapsed}ms, code=${err.code}, status=${status}, body=`,
          err.response?.data,
        );
      }
      if (err.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'This took too long — hold steady and try again',
          code: 'timeout',
        };
      }
      if (status === 429) {
        return {
          success: false,
          error: 'Too many identifications right now — try again shortly',
          code: 'rate_limit',
        };
      }
      if (typeof status === 'number') {
        return {
          success: false,
          error: "Couldn't reach identification service — try again",
          code: 'http_error',
        };
      }
      return {
        success: false,
        error: 'No connection — check your internet and try again',
        code: 'network',
      };
    }
    if (__DEV__) {
      console.warn('[geminiVision] unexpected error', err);
    }
    return {
      success: false,
      error: "Couldn't identify — try holding steady and try again",
      code: 'network',
    };
  }
}

// ── Dev probe ───────────────────────────────────────────────────────

/**
 * Dev-only diagnostic: sends the image to Gemini with a minimal free-form
 * prompt that asks for a one-sentence plain-text description. Used to
 * verify the request/auth/encoding path works end-to-end independent of
 * the heritage-specific prompt.
 */
export async function identifyAny(
  imageBase64: string,
): Promise<{ success: true; text: string } | { success: false; error: string }> {
  if (!GEMINI_API_KEY) {
    return { success: false, error: 'Gemini API key not configured' };
  }
  try {
    const response = await axios.post(
      `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: 'Describe what is in this image in one short sentence. Plain text only.',
              },
              {
                inline_data: { mime_type: 'image/jpeg', data: imageBase64 },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 128 },
      },
      { timeout: TIMEOUT_MS },
    );
    const text: string =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const blockReason: string | undefined =
      response.data?.promptFeedback?.blockReason;
    if (blockReason) {
      return { success: false, error: `blocked: ${blockReason}` };
    }
    if (!text) {
      return { success: false, error: 'empty response' };
    }
    return { success: true, text: text.trim() };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return {
        success: false,
        error: `axios ${err.code ?? ''} status=${err.response?.status ?? '-'}`,
      };
    }
    return { success: false, error: String(err) };
  }
}
