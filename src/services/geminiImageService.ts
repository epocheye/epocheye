/**
 * Gemini image generation service for heritage monument imagery.
 *
 * Replaces the backend /api/v1/images/resolve call with a direct Gemini
 * image-generation request from the device. Results are persisted to
 * AsyncStorage so repeat visits to the same monument are instant and
 * don't burn quota.
 *
 * Model: `gemini-2.0-flash-exp-image-generation` — Google AI Studio key
 * works without additional billing setup. If the model rotates, change
 * GEMINI_IMAGE_MODEL below.
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GEMINI_API_KEY } from '@env';
import { STORAGE_KEYS } from '../core/constants/storage-keys';

// ── Configuration ──────────────────────────────────────────────────

const GEMINI_IMAGE_MODEL = 'gemini-2.0-flash-exp-image-generation';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;
const TIMEOUT_MS = 30_000;
const MAX_CACHE_ENTRIES = 60;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// ── Types ──────────────────────────────────────────────────────────

export interface GenerateMonumentImageParams {
  subject: string;
  context?: string;
}

export interface GeneratedImageResult {
  url: string;
  fromCache: boolean;
  cachedAt: number;
}

interface PersistedEntry {
  key: string;
  dataUri: string;
  cachedAt: number;
}

// ── In-memory cache + in-flight dedup ──────────────────────────────

const memoryCache = new Map<string, GeneratedImageResult>();
const inflight = new Map<string, Promise<GeneratedImageResult | null>>();
let persistedLoaded = false;

function cacheKey({ subject, context }: GenerateMonumentImageParams): string {
  return `${subject.trim().toLowerCase()}::${(context ?? '').trim().toLowerCase()}`;
}

// ── Persisted cache (AsyncStorage) ─────────────────────────────────

async function loadPersistedIntoMemory(): Promise<void> {
  if (persistedLoaded) return;
  persistedLoaded = true;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CACHE.GEMINI_IMAGE);
    if (!raw) return;
    const entries: PersistedEntry[] = JSON.parse(raw);
    const now = Date.now();
    for (const e of entries) {
      if (now - e.cachedAt < CACHE_TTL_MS) {
        memoryCache.set(e.key, {
          url: e.dataUri,
          fromCache: true,
          cachedAt: e.cachedAt,
        });
      }
    }
  } catch {
    // Best effort
  }
}

async function persistEntry(key: string, dataUri: string, cachedAt: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CACHE.GEMINI_IMAGE);
    const entries: PersistedEntry[] = raw ? JSON.parse(raw) : [];

    const filtered = entries.filter(e => e.key !== key);
    filtered.push({ key, dataUri, cachedAt });

    while (filtered.length > MAX_CACHE_ENTRIES) {
      filtered.shift();
    }

    await AsyncStorage.setItem(
      STORAGE_KEYS.CACHE.GEMINI_IMAGE,
      JSON.stringify(filtered),
    );
  } catch {
    // Best effort — cache is a nicety, not correctness
  }
}

// ── Prompt ─────────────────────────────────────────────────────────

function buildPrompt({ subject, context }: GenerateMonumentImageParams): string {
  const where = context ? ` located at ${context}` : '';
  return [
    `A photorealistic documentary-style photograph of ${subject}${where}, a real heritage monument.`,
    'Golden hour lighting, wide landscape framing, 4K realism, atmospheric haze.',
    'No people, no text, no watermark, no modern vehicles, no tourists.',
    'Accurate architecture and cultural detail. Editorial travel magazine aesthetic.',
  ].join(' ');
}

// ── Gemini request ─────────────────────────────────────────────────

function extractImageDataUri(response: unknown): string | null {
  const r = response as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inline_data?: { mime_type?: string; data?: string };
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };

  const parts = r?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inline_data ?? part.inlineData;
    const data = inline?.data;
    const mime =
      (inline as { mime_type?: string } | undefined)?.mime_type ??
      (inline as { mimeType?: string } | undefined)?.mimeType ??
      'image/png';
    if (data) {
      return `data:${mime};base64,${data}`;
    }
  }
  return null;
}

async function requestGemini(
  params: GenerateMonumentImageParams,
): Promise<GeneratedImageResult | null> {
  if (!GEMINI_API_KEY) {
    if (__DEV__) {
      console.warn('[geminiImageService] GEMINI_API_KEY missing — skipping');
    }
    return null;
  }

  try {
    const response = await axios.post(
      `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: buildPrompt(params) }],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
          temperature: 0.4,
        },
      },
      { timeout: TIMEOUT_MS },
    );

    const dataUri = extractImageDataUri(response.data);
    if (!dataUri) {
      if (__DEV__) {
        console.warn('[geminiImageService] no image in response', params);
      }
      return null;
    }

    const cachedAt = Date.now();
    const result: GeneratedImageResult = {
      url: dataUri,
      fromCache: false,
      cachedAt,
    };

    memoryCache.set(cacheKey(params), result);
    void persistEntry(cacheKey(params), dataUri, cachedAt);
    return result;
  } catch (err) {
    if (__DEV__) {
      if (axios.isAxiosError(err)) {
        console.warn(
          '[geminiImageService] request failed',
          err.response?.status,
          err.response?.data ?? err.message,
        );
      } else {
        console.warn('[geminiImageService] request failed', err);
      }
    }
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Generates (or retrieves from cache) a photorealistic image of a
 * heritage monument. Returns a data URI suitable for a <Image source={{uri}}>.
 */
export async function generateMonumentImage(
  params: GenerateMonumentImageParams,
): Promise<GeneratedImageResult | null> {
  const subject = params.subject.trim();
  if (!subject) return null;

  await loadPersistedIntoMemory();

  const key = cacheKey(params);

  const cached = memoryCache.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = requestGemini(params).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

/**
 * Synchronous cache lookup — returns immediately without awaiting
 * persisted load. Useful for hot renders where we're OK with a miss on
 * the very first call of a session.
 */
export function peekMonumentImageFromMemory(
  params: GenerateMonumentImageParams,
): GeneratedImageResult | null {
  return memoryCache.get(cacheKey(params)) ?? null;
}

export async function clearGeneratedImageCache(): Promise<void> {
  memoryCache.clear();
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.CACHE.GEMINI_IMAGE);
  } catch {
    // Best effort
  }
}
