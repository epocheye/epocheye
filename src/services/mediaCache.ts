/**
 * On-device cache for journey media — narration audio, card video and the
 * figure GLB — extending the glbCache pattern (LRU by lastAccessed, url→path
 * manifest in AsyncStorage, best-effort everywhere) to any file type.
 *
 * Why a sibling cache instead of widening glbCache: its filenames are `.glb`-only
 * and `clearGlbCache` unlinks the whole directory, so mixing media in would let
 * a "clear media" silently drop models (or the reverse). `.glb` URLs handed to
 * this module are DELEGATED to glbCache, so one `prefetchMedia` call warms the
 * whole journey manifest and the figure still lands where the placement path
 * (`getOrFetchGlb`) already looks.
 *
 * Offline contract: `getOrFetchMedia` returns the cached file:// when warm and
 * the remote URL when the download fails, so react-native-video plays from disk
 * when it can and streams when it must — the journey degrades, it never blocks.
 */
import {
  DocumentDirectoryPath,
  downloadFile,
  exists as fileExists,
  mkdir,
  stat,
  unlink,
} from '@dr.pogodin/react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUDIO_BASE_URL } from '@env';
import { STORAGE_KEYS } from '../core/constants/storage-keys';
import { cacheGlbUrl, getCachedGlbUri, getOrFetchGlb } from './glbCache';

const CACHE_DIR = `${DocumentDirectoryPath}/media_cache`;
const MANIFEST_KEY = STORAGE_KEYS.CACHE.MEDIA_MANIFEST;
// Sized for one venue's guide (a few MB of MP3) plus a handful of short card
// videos; a second venue evicts the first, oldest-played first.
const MAX_BYTES = 150 * 1024 * 1024; // 150 MB
const DOWNLOAD_TIMEOUT_MS = 60_000;
const PREFETCH_CONCURRENCY = 3;

/**
 * Join a CDN base onto a backend-issued media reference. The audio API returns
 * `audio_url` / `restoration_image_url` as EITHER a relative CDN key
 * ("audio/<venue>/<file>.mp3", see migration 080) OR an absolute URL; absolute
 * values pass through untouched. Returns null when the key is empty or when a
 * relative key has no base to join onto (no CDN configured for this build).
 * Pure — exported for testing.
 */
export function joinMediaUrl(
  base: string | undefined,
  keyOrUrl: string | null | undefined,
): string | null {
  const key = (keyOrUrl ?? '').trim();
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return key;
  const b = (base ?? '').trim().replace(/\/+$/, '');
  if (!b) return null;
  return `${b}/${key.replace(/^\/+/, '')}`;
}

/**
 * Resolve an audio-API media reference against AUDIO_BASE_URL. This is the
 * client half of the contract documented on apis/audio/model.go (Clip.AudioURL):
 * the backend serves the pointer, the client decides the origin.
 */
export function buildAudioUrl(keyOrUrl: string | null | undefined): string | null {
  return joinMediaUrl(AUDIO_BASE_URL, keyOrUrl);
}

/**
 * DEV-ONLY STAND-IN. A 5 s ffmpeg test pattern (testsrc 640x360, h264, no
 * audio) uploaded to s3://epocheye-glb-models/test/journey_test_pattern.mp4 so
 * the card-video path (VideoNode on a world-anchored card, tap-to-enlarge) can
 * be exercised before any real card video exists. The journey attaches it only
 * from its clearly-marked dev hook (recognised title matches 'pillar'); nothing
 * in production content references this file.
 *
 * NULL IN RELEASE, and that guard is load-bearing rather than tidy. AUDIO_BASE_URL
 * is configured in .env, so without the `__DEV__` test this constant is a live
 * CloudFront URL in a release build, and the ONLY thing keeping colour bars off a
 * visitor's screen is the journey's admin-allowlist CTA. Flipping
 * JOURNEY_OPEN_TO_ALL — the single flag that is meant to open the journey to
 * everyone — would then hang an ffmpeg test pattern on a real heritage pillar (the
 * exact feature the step's own hint copy tells visitors to aim at) and download it
 * over mobile data on every journey entry. Null here makes both call sites
 * (PointLearnStep's attach, PalaceJourneyScreen's pre-cache list) no-ops in
 * release with no other change: prefetchMedia drops falsy URLs before counting.
 * Also null when no CDN is configured.
 */
export const JOURNEY_TEST_VIDEO_URL: string | null = __DEV__
  ? joinMediaUrl(AUDIO_BASE_URL, 'test/journey_test_pattern.mp4')
  : null;

interface CacheEntry {
  path: string;
  size: number;
  lastAccessed: number; // epoch ms
}

interface Manifest {
  [url: string]: CacheEntry;
}

/** One prefetch run's tally. `cached + failed === total` once the run ends, unless it was aborted. */
export interface PrefetchSummary {
  /** Distinct fetchable URLs in the request. */
  total: number;
  /** URLs now on disk (freshly downloaded or already warm). */
  cached: number;
  /** URLs that could not be downloaded — they will stream on demand. */
  failed: number;
  /** True when the run stopped early because `signal` fired. */
  aborted: boolean;
}

export interface PrefetchOptions {
  /** Called after every URL settles, with the running tally. */
  onProgress?: (progress: PrefetchSummary) => void;
  /** Stops STARTING new downloads; in-flight ones finish and are kept. */
  signal?: AbortSignal;
}

let manifestCache: Manifest | null = null;
let dirEnsured = false;

async function ensureDir(): Promise<void> {
  if (dirEnsured) return;
  try {
    const present = await fileExists(CACHE_DIR);
    if (!present) {
      await mkdir(CACHE_DIR);
    }
    dirEnsured = true;
  } catch (err) {
    if (__DEV__) console.warn('[mediaCache] ensureDir failed', err);
  }
}

async function loadManifest(): Promise<Manifest> {
  if (manifestCache) return manifestCache;
  try {
    const raw = await AsyncStorage.getItem(MANIFEST_KEY);
    manifestCache = raw ? (JSON.parse(raw) as Manifest) : {};
  } catch {
    manifestCache = {};
  }
  return manifestCache;
}

async function saveManifest(m: Manifest): Promise<void> {
  manifestCache = m;
  try {
    await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(m));
  } catch (err) {
    if (__DEV__) console.warn('[mediaCache] saveManifest failed', err);
  }
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** `.glb` URLs belong to glbCache (see module doc). Query strings are ignored. */
function isGlbUrl(url: string): boolean {
  return /\.glb$/i.test(url.split(/[?#]/, 1)[0]);
}

/**
 * File extension from the URL path, lowercased, or "bin" when there is none.
 * Kept on the cached file so ExoPlayer (react-native-video) can sniff the
 * container from the name as well as the bytes.
 */
export function extensionFor(url: string): string {
  const path = url.split(/[?#]/, 1)[0];
  const m = /\.([a-z0-9]{1,5})$/i.exec(path);
  return m ? m[1].toLowerCase() : 'bin';
}

/**
 * 32-bit FNV-1a hash of the URL plus its length as a tiebreaker — the same
 * scheme as glbCache. Collisions are tolerated because the manifest maps
 * url→path explicitly; a collision only means two URLs would share a slot.
 */
function fileNameFor(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, '0')}_${url.length.toString(16)}.${extensionFor(url)}`;
}

/**
 * Local file URI if the media is already cached, else null. Bumps lastAccessed
 * for LRU bookkeeping. A manifest entry whose file went missing (user cleared
 * storage) is dropped and reported as a miss.
 */
export async function getCachedMediaUri(url: string): Promise<string | null> {
  if (!url) return null;
  if (isGlbUrl(url)) return getCachedGlbUri(url);
  await ensureDir();
  const manifest = await loadManifest();
  const entry = manifest[url];
  if (!entry) return null;

  try {
    const present = await fileExists(entry.path);
    if (!present) {
      delete manifest[url];
      await saveManifest(manifest);
      return null;
    }
  } catch {
    return null;
  }

  entry.lastAccessed = Date.now();
  await saveManifest(manifest);
  return `file://${entry.path}`;
}

/**
 * Download to disk and register in the manifest; returns the existing file if
 * already cached. Throws on failure (network, HTTP >= 400) after removing any
 * partial file, so a half-written MP3 can never be served as "cached".
 */
export async function cacheMediaUrl(url: string): Promise<string> {
  if (!url) {
    throw new Error('cacheMediaUrl: empty url');
  }
  if (isGlbUrl(url)) return cacheGlbUrl(url);

  const existing = await getCachedMediaUri(url);
  if (existing) return existing;

  await ensureDir();
  const targetPath = `${CACHE_DIR}/${fileNameFor(url)}`;

  let statusCode = 0;
  let bytesWritten = 0;
  try {
    const { promise } = downloadFile({
      fromUrl: url,
      toFile: targetPath,
      connectionTimeout: DOWNLOAD_TIMEOUT_MS,
      readTimeout: DOWNLOAD_TIMEOUT_MS,
    });
    const result = await promise;
    statusCode = result.statusCode;
    bytesWritten = result.bytesWritten ?? 0;
  } catch (err) {
    await discardPartial(targetPath);
    throw err;
  }
  if (statusCode >= 400) {
    await discardPartial(targetPath);
    throw new Error(`download failed http ${statusCode}`);
  }

  let size = bytesWritten;
  if (!size) {
    try {
      const info = await stat(targetPath);
      size = Number(info.size) || 0;
    } catch {
      size = 0;
    }
  }

  const manifest = await loadManifest();
  manifest[url] = {
    path: targetPath,
    size,
    lastAccessed: Date.now(),
  };
  await saveManifest(manifest);
  await trimLRU();

  return `file://${targetPath}`;
}

async function discardPartial(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // best-effort cleanup — the file may never have been created
  }
}

/**
 * Cached file:// when warm, otherwise download and return the local URI, and
 * on download failure the remote URL itself so the player can still stream.
 * Non-http URIs (file://, content://) pass straight through — nothing to fetch.
 */
export async function getOrFetchMedia(url: string): Promise<string> {
  if (!url) return url;
  if (!isHttpUrl(url)) return url;
  if (isGlbUrl(url)) return getOrFetchGlb(url);
  try {
    return await cacheMediaUrl(url);
  } catch (err) {
    if (__DEV__) console.warn('[mediaCache] cache miss + fetch failed', url, err);
    return url;
  }
}

/**
 * Warm the cache for a journey: the figure GLB, every stop's audio and any card
 * video, a few at a time, reporting progress after each one settles. Never
 * throws and never rejects — a URL that fails is counted in `failed` and will
 * stream on demand. Empty / null / non-http entries and duplicates are dropped
 * before counting, so `total` is what the progress UI should show.
 */
export async function prefetchMedia(
  urls: ReadonlyArray<string | null | undefined>,
  options: PrefetchOptions = {},
): Promise<PrefetchSummary> {
  const queue = Array.from(
    new Set(urls.filter((u): u is string => !!u && isHttpUrl(u))),
  );
  const summary: PrefetchSummary = {
    total: queue.length,
    cached: 0,
    failed: 0,
    aborted: false,
  };
  if (queue.length === 0) return summary;

  const { onProgress, signal } = options;
  const report = () => {
    // A progress callback must never be able to break the prefetch itself.
    try {
      onProgress?.({ ...summary });
    } catch (err) {
      if (__DEV__) console.warn('[mediaCache] onProgress threw', err);
    }
  };

  const worker = async () => {
    for (;;) {
      if (signal?.aborted) {
        summary.aborted = true;
        return;
      }
      const url = queue.shift();
      if (!url) return;
      try {
        await cacheMediaUrl(url);
        summary.cached += 1;
      } catch (err) {
        if (__DEV__) console.warn('[mediaCache] prefetch failed', url, err);
        summary.failed += 1;
      }
      report();
    }
  };

  const workers = Array.from(
    { length: Math.min(PREFETCH_CONCURRENCY, queue.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return summary;
}

/**
 * Drops every cached media file plus the manifest. Models in glbCache are NOT
 * touched — that is the point of keeping the two caches apart.
 */
export async function clearMediaCache(): Promise<void> {
  try {
    const present = await fileExists(CACHE_DIR);
    if (present) {
      await unlink(CACHE_DIR);
    }
  } catch (err) {
    if (__DEV__) console.warn('[mediaCache] clearMediaCache failed', err);
  }
  manifestCache = {};
  dirEnsured = false;
  await AsyncStorage.removeItem(MANIFEST_KEY);
}

async function trimLRU(): Promise<void> {
  const manifest = await loadManifest();
  const entries = Object.entries(manifest);
  let total = entries.reduce((sum, [, e]) => sum + e.size, 0);
  if (total <= MAX_BYTES) return;

  // Oldest first.
  entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
  for (const [url, entry] of entries) {
    if (total <= MAX_BYTES) break;
    try {
      await unlink(entry.path);
    } catch {
      // file might already be gone; manifest cleanup proceeds anyway
    }
    delete manifest[url];
    total -= entry.size;
  }
  await saveManifest(manifest);
}
