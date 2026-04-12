/**
 * Offline cache for Gemini identification responses.
 *
 * Stores the last N successful identifications keyed by GPS location.
 * When the app is offline, it attempts to find a cached result near
 * the user's current position using Haversine distance matching.
 *
 * Only premium users write to the cache. Reading is allowed for all
 * users (the premium check happens at the call site).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../core/constants/storage-keys';
import type { GeminiIdentification } from './geminiVisionService';

// ── Types ──────────────────────────────────────────────────────────

export interface CachedIdentification {
  identification: GeminiIdentification;
  lat: number;
  lon: number;
  placeName?: string;
  cachedAt: number; // Unix timestamp (ms)
}

// ── Constants ──────────────────────────────────────────────────────

const MAX_CACHE_SIZE = 10;
const DEFAULT_MATCH_RADIUS_M = 200;

// ── Helpers ────────────────────────────────────────────────────────

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function readCache(): Promise<CachedIdentification[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LENS.GEMINI_CACHE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeCache(entries: CachedIdentification[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.LENS.GEMINI_CACHE,
      JSON.stringify(entries),
    );
  } catch {
    // Silent — cache is best-effort
  }
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Stores a Gemini identification result in the offline cache.
 * FIFO eviction when the cache exceeds MAX_CACHE_SIZE.
 */
export async function cacheResult(
  identification: GeminiIdentification,
  lat: number,
  lon: number,
  placeName?: string,
): Promise<void> {
  const entries = await readCache();

  const entry: CachedIdentification = {
    identification,
    lat,
    lon,
    placeName,
    cachedAt: Date.now(),
  };

  // Remove any existing entry for the same approximate location
  const filtered = entries.filter(
    e => haversineMeters(e.lat, e.lon, lat, lon) > DEFAULT_MATCH_RADIUS_M,
  );

  filtered.push(entry);

  // Evict oldest if over limit
  while (filtered.length > MAX_CACHE_SIZE) {
    filtered.shift();
  }

  await writeCache(filtered);
}

/**
 * Finds a cached identification result near the given GPS coordinates.
 * Returns the most recently cached entry within the match radius, or null.
 */
export async function findCachedResult(
  lat: number,
  lon: number,
  radiusMeters: number = DEFAULT_MATCH_RADIUS_M,
): Promise<CachedIdentification | null> {
  const entries = await readCache();

  let best: CachedIdentification | null = null;
  let bestTime = 0;

  for (const entry of entries) {
    const dist = haversineMeters(lat, lon, entry.lat, entry.lon);
    if (dist <= radiusMeters && entry.cachedAt > bestTime) {
      best = entry;
      bestTime = entry.cachedAt;
    }
  }

  return best;
}

/**
 * Clears the entire offline identification cache.
 */
export async function clearCache(): Promise<void> {
  await writeCache([]);
}

/**
 * Returns the number of cached entries.
 */
export async function getCacheSize(): Promise<number> {
  const entries = await readCache();
  return entries.length;
}
