/**
 * On-device LRU cache for AR reconstruction GLBs.
 *
 * Why: every visitor scan that re-shows a previously-fetched GLB hammers the
 * Cloudinary CDN unnecessarily and adds 1-3s of cold-cache latency on mobile
 * networks at heritage sites. Caching the bytes in
 * `${DocumentDirectoryPath}/glb_cache/<id>.glb` makes warm taps instant and
 * lets the AR experience survive offline once a site has been visited once.
 *
 * The 100 MB cap is enforced via LRU eviction by `lastAccessed` — after each
 * cache write we trim the oldest entries until under cap. The manifest is
 * persisted to AsyncStorage so eviction state survives app restart.
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

const CACHE_DIR = `${DocumentDirectoryPath}/glb_cache`;
const MANIFEST_KEY = '@epocheye/glb_cache/manifest';
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const DOWNLOAD_TIMEOUT_MS = 60_000;

interface CacheEntry {
  path: string;
  size: number;
  lastAccessed: number; // epoch ms
}

interface Manifest {
  [url: string]: CacheEntry;
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
    if (__DEV__) console.warn('[glbCache] ensureDir failed', err);
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
    if (__DEV__) console.warn('[glbCache] saveManifest failed', err);
  }
}

/**
 * 32-bit FNV-1a hash of the URL — only used to derive a unique filename.
 * Collisions are tolerated because the manifest stores url→path explicitly,
 * so a hash collision just means two URLs would share a filename slot;
 * we resolve that by appending the URL length as a tiebreaker (extremely
 * rare for two same-length URLs to also collide on FNV-1a).
 */
function fileNameFor(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, '0')}_${url.length.toString(16)}.glb`;
}

/**
 * Returns the local file URI for the GLB if it's already cached. Updates the
 * lastAccessed timestamp for LRU bookkeeping. Returns null on miss or if the
 * manifest entry exists but the file went missing (e.g. user cleared storage).
 */
export async function getCachedGlbUri(url: string): Promise<string | null> {
  if (!url) return null;
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
 * Downloads the GLB to disk and registers it in the manifest. If the URL is
 * already cached, returns the existing path without re-downloading. After
 * each successful write we trim the LRU back under the cap.
 */
export async function cacheGlbUrl(url: string): Promise<string> {
  if (!url) {
    throw new Error('cacheGlbUrl: empty url');
  }

  const existing = await getCachedGlbUri(url);
  if (existing) return existing;

  await ensureDir();
  const fileName = fileNameFor(url);
  const targetPath = `${CACHE_DIR}/${fileName}`;

  const { promise } = downloadFile({
    fromUrl: url,
    toFile: targetPath,
    connectionTimeout: DOWNLOAD_TIMEOUT_MS,
    readTimeout: DOWNLOAD_TIMEOUT_MS,
  });
  const result = await promise;
  if (result.statusCode >= 400) {
    try {
      await unlink(targetPath);
    } catch {
      // best-effort cleanup
    }
    throw new Error(`download failed http ${result.statusCode}`);
  }

  let size = result.bytesWritten ?? 0;
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

/**
 * Convenience: returns cached URI if present, otherwise downloads and returns
 * the local URI. On download failure returns the original remote URL so the
 * caller can still attempt to render — caching is best-effort.
 */
export async function getOrFetchGlb(url: string): Promise<string> {
  if (!url) return url;
  try {
    return await cacheGlbUrl(url);
  } catch (err) {
    if (__DEV__) console.warn('[glbCache] cache miss + fetch failed', url, err);
    return url;
  }
}

/**
 * Kicks off downloads for a batch of URLs in parallel without blocking the
 * caller. Used on zone entry to pre-warm the local cache for a site's
 * curated catalog. Failures are silent — prefetch is best-effort.
 */
export function prefetchGlbs(urls: string[]): void {
  for (const url of urls) {
    if (!url) continue;
    cacheGlbUrl(url).catch(() => {
      // silent — prefetch is best-effort
    });
  }
}

/**
 * Drops every cached GLB plus the manifest. Used on logout / "clear cache"
 * settings action.
 */
export async function clearGlbCache(): Promise<void> {
  try {
    const present = await fileExists(CACHE_DIR);
    if (present) {
      await unlink(CACHE_DIR);
    }
  } catch (err) {
    if (__DEV__) console.warn('[glbCache] clearGlbCache failed', err);
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
