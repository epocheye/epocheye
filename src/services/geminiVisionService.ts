/**
 * Gemini 2.0 Flash Vision API service for heritage identification.
 *
 * Sends a camera-captured image (base64) to Gemini and receives a
 * structured identification response: monument name, historical period,
 * cultural significance, and a surprising fact.
 *
 * Uses direct REST calls via axios — no additional npm dependency.
 */

import axios from 'axios';
import { readFile as fsReadFile } from '@dr.pogodin/react-native-fs';
import { GEMINI_API_KEY } from '@env';

// ── Types ──────────────────────────────────────────────────────────

export interface GeminiIdentification {
  name: string;
  period: string;
  significance: string;
  fact: string;
}

interface GeminiSuccess {
  success: true;
  data: GeminiIdentification;
}

interface GeminiFailure {
  success: false;
  error: string;
}

export type GeminiResult = GeminiSuccess | GeminiFailure;

// ── Constants ──────────────────────────────────────────────────────

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const TIMEOUT_MS = 15_000;

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

/**
 * Extracts JSON from a Gemini response that may be wrapped in markdown
 * code fences or contain leading/trailing text.
 */
function extractJSON(text: string): GeminiIdentification | null {
  // Try direct parse first
  try {
    return JSON.parse(text) as GeminiIdentification;
  } catch {
    // Not raw JSON — try extraction
  }

  // Strip markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as GeminiIdentification;
    } catch {
      // Continue to brace extraction
    }
  }

  // Extract first {...} block
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]) as GeminiIdentification;
    } catch {
      // Give up
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

// ── Main API ────────────────────────────────────────────────────────

/**
 * Identifies a heritage site or artifact in the given image.
 *
 * @param imageBase64 - Base64-encoded JPEG image data (no data: prefix)
 * @param siteHint    - Optional nearby site name for context (from geofence)
 */
export async function identifyHeritage(
  imageBase64: string,
  siteHint?: string,
): Promise<GeminiResult> {
  // Check in-memory cache
  const cacheKey = siteHint ?? 'general';
  if (
    lastResult &&
    lastResult.key === cacheKey &&
    Date.now() - lastResult.timestamp < RESULT_CACHE_TTL_MS
  ) {
    return lastResult.result;
  }

  // Dedup in-flight requests
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

    const text: string =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!text) {
      return { success: false, error: 'Empty response from Gemini' };
    }

    const parsed = extractJSON(text);
    if (!parsed || !parsed.name) {
      return { success: false, error: 'Could not parse identification response' };
    }

    const result: GeminiResult = { success: true, data: parsed };
    lastResult = { key: cacheKey, result, timestamp: Date.now() };
    return result;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED') {
        return { success: false, error: 'Request timed out — try holding steady' };
      }
      const status = err.response?.status;
      if (status === 429) {
        return { success: false, error: 'Rate limit reached — try again shortly' };
      }
      return {
        success: false,
        error: `API error (${status ?? 'network'})`,
      };
    }
    return { success: false, error: 'Could not identify — try holding steady' };
  }
}
