/**
 * mediaCache — the glbCache contract extended to audio/video: second fetch is
 * served from disk, extension-aware filenames, best-effort prefetch with
 * progress + failure accounting, and .glb delegation to glbCache.
 *
 * RNFS is mocked with an in-memory "filesystem" set exactly like the glbCache
 * test; a per-URL status map lets one download 404 while the rest succeed.
 */
const mockExistingPaths = new Set<string>();
const mockDownloadFile = jest.fn();
const mockStatusByUrl = new Map<string, number>();

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/doc',
  downloadFile: (opts: { fromUrl: string; toFile: string }) => {
    mockDownloadFile(opts);
    const statusCode = mockStatusByUrl.get(opts.fromUrl) ?? 200;
    if (statusCode === -1) {
      return { promise: Promise.reject(new Error('network down')) };
    }
    mockExistingPaths.add(opts.toFile);
    return { promise: Promise.resolve({ statusCode, bytesWritten: 512 }) };
  },
  exists: (p: string) => Promise.resolve(mockExistingPaths.has(p)),
  mkdir: (p: string) => {
    mockExistingPaths.add(p);
    return Promise.resolve();
  },
  stat: () => Promise.resolve({ size: 512 }),
  unlink: (p: string) => {
    mockExistingPaths.delete(p);
    return Promise.resolve();
  },
}));

const mockCacheGlbUrl = jest.fn();
const mockGetCachedGlbUri = jest.fn();
const mockGetOrFetchGlb = jest.fn();
jest.mock('../../src/services/glbCache', () => ({
  cacheGlbUrl: (url: string) => mockCacheGlbUrl(url),
  getCachedGlbUri: (url: string) => mockGetCachedGlbUri(url),
  getOrFetchGlb: (url: string) => mockGetOrFetchGlb(url),
}));

import {
  cacheMediaUrl,
  clearMediaCache,
  extensionFor,
  getCachedMediaUri,
  getOrFetchMedia,
  joinMediaUrl,
  prefetchMedia,
} from '../../src/services/mediaCache';

const AUDIO = 'https://cdn.example.com/audio/tipu/palace_overview_en_casual.mp3';
const VIDEO = 'https://cdn.example.com/test/journey_test_pattern.mp4?v=2';
const GLB = 'https://cdn.example.com/tipu_figure_royal4.glb';

let warnSpy: jest.SpyInstance;

beforeEach(async () => {
  mockExistingPaths.clear();
  mockStatusByUrl.clear();
  mockDownloadFile.mockClear();
  mockCacheGlbUrl.mockReset();
  mockGetCachedGlbUri.mockReset();
  mockGetOrFetchGlb.mockReset();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await clearMediaCache();
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('joinMediaUrl', () => {
  it('joins a relative CDN key onto the base, tolerating stray slashes', () => {
    expect(joinMediaUrl('https://cdn.example.com/', '/audio/x.mp3')).toBe(
      'https://cdn.example.com/audio/x.mp3',
    );
    expect(joinMediaUrl('https://cdn.example.com', 'audio/x.mp3')).toBe(
      'https://cdn.example.com/audio/x.mp3',
    );
  });

  it('passes absolute URLs through untouched', () => {
    expect(joinMediaUrl('https://cdn.example.com', 'https://other.example/x.mp3')).toBe(
      'https://other.example/x.mp3',
    );
    expect(joinMediaUrl(undefined, 'http://other.example/x.mp3')).toBe(
      'http://other.example/x.mp3',
    );
  });

  it('returns null for an empty key or a relative key with no base', () => {
    expect(joinMediaUrl('https://cdn.example.com', '')).toBeNull();
    expect(joinMediaUrl('https://cdn.example.com', null)).toBeNull();
    expect(joinMediaUrl(undefined, 'audio/x.mp3')).toBeNull();
    expect(joinMediaUrl('   ', 'audio/x.mp3')).toBeNull();
  });
});

describe('extensionFor', () => {
  it('reads the extension from the path, ignoring query and hash', () => {
    expect(extensionFor(AUDIO)).toBe('mp3');
    expect(extensionFor(VIDEO)).toBe('mp4');
    expect(extensionFor('https://x.example/clip.M4A#t=1')).toBe('m4a');
    expect(extensionFor('https://x.example/no-extension')).toBe('bin');
    expect(extensionFor('https://x.example/dir.name/file')).toBe('bin');
  });
});

describe('cache round trip', () => {
  it('downloads on the first fetch, serves from disk on the second', async () => {
    const first = await getOrFetchMedia(AUDIO);
    expect(first.startsWith('file:///doc/media_cache/')).toBe(true);
    expect(first.endsWith('.mp3')).toBe(true);
    expect(mockDownloadFile).toHaveBeenCalledTimes(1);

    const second = await getOrFetchMedia(AUDIO);
    expect(second).toBe(first);
    expect(mockDownloadFile).toHaveBeenCalledTimes(1);
  });

  it('getCachedMediaUri is null before fetch, file:// after, and never downloads', async () => {
    expect(await getCachedMediaUri(VIDEO)).toBeNull();
    await getOrFetchMedia(VIDEO);
    const cached = await getCachedMediaUri(VIDEO);
    expect(cached?.startsWith('file://')).toBe(true);
    expect(cached?.endsWith('.mp4')).toBe(true);
    expect(mockDownloadFile).toHaveBeenCalledTimes(1);
  });

  it('drops a manifest entry whose file went missing', async () => {
    const uri = await cacheMediaUrl(AUDIO);
    mockExistingPaths.delete(uri.replace('file://', ''));
    expect(await getCachedMediaUri(AUDIO)).toBeNull();
    // Re-fetch downloads again rather than serving a phantom path.
    await getOrFetchMedia(AUDIO);
    expect(mockDownloadFile).toHaveBeenCalledTimes(2);
  });

  it('returns the remote URL when the download fails, and removes the partial file', async () => {
    mockStatusByUrl.set(AUDIO, 404);
    expect(await getOrFetchMedia(AUDIO)).toBe(AUDIO);
    expect(await getCachedMediaUri(AUDIO)).toBeNull();
    // The 404 body written by the mock must not survive as a cached file.
    const partials = [...mockExistingPaths].filter(p => p.endsWith('.mp3'));
    expect(partials).toEqual([]);
  });

  it('passes non-http URIs straight through', async () => {
    expect(await getOrFetchMedia('file:///sdcard/local.mp3')).toBe('file:///sdcard/local.mp3');
    expect(await getOrFetchMedia('')).toBe('');
    expect(mockDownloadFile).not.toHaveBeenCalled();
  });
});

describe('.glb delegation', () => {
  it('routes .glb URLs to glbCache so the figure lands where placement looks', async () => {
    mockGetOrFetchGlb.mockResolvedValueOnce('file:///doc/glb_cache/abc.glb');
    mockCacheGlbUrl.mockResolvedValueOnce('file:///doc/glb_cache/abc.glb');
    mockGetCachedGlbUri.mockResolvedValueOnce(null);

    expect(await getOrFetchMedia(GLB)).toBe('file:///doc/glb_cache/abc.glb');
    expect(await cacheMediaUrl(GLB)).toBe('file:///doc/glb_cache/abc.glb');
    expect(await getCachedMediaUri(GLB)).toBeNull();
    expect(mockGetOrFetchGlb).toHaveBeenCalledWith(GLB);
    expect(mockCacheGlbUrl).toHaveBeenCalledWith(GLB);
    expect(mockGetCachedGlbUri).toHaveBeenCalledWith(GLB);
    expect(mockDownloadFile).not.toHaveBeenCalled();
  });
});

describe('prefetchMedia', () => {
  it('dedupes, skips empties, reports progress and counts failures without throwing', async () => {
    mockStatusByUrl.set(VIDEO, -1); // network failure on the video only
    mockCacheGlbUrl.mockResolvedValue('file:///doc/glb_cache/abc.glb');
    const progress: Array<{ cached: number; failed: number; total: number }> = [];

    const summary = await prefetchMedia([AUDIO, AUDIO, '', null, undefined, VIDEO, GLB], {
      onProgress: p => progress.push({ cached: p.cached, failed: p.failed, total: p.total }),
    });

    expect(summary).toEqual({ total: 3, cached: 2, failed: 1, aborted: false });
    expect(progress).toHaveLength(3);
    expect(progress[2]).toEqual({ cached: 2, failed: 1, total: 3 });
    expect(progress.every(p => p.total === 3)).toBe(true);
    // The audio is warm; the video is not.
    expect(await getCachedMediaUri(AUDIO)).not.toBeNull();
    expect(await getCachedMediaUri(VIDEO)).toBeNull();
    expect(mockCacheGlbUrl).toHaveBeenCalledWith(GLB);
  });

  it('survives a throwing onProgress callback', async () => {
    const summary = await prefetchMedia([AUDIO], {
      onProgress: () => {
        throw new Error('ui gone');
      },
    });
    expect(summary).toEqual({ total: 1, cached: 1, failed: 0, aborted: false });
  });

  it('returns an empty summary for nothing to fetch', async () => {
    expect(await prefetchMedia([])).toEqual({ total: 0, cached: 0, failed: 0, aborted: false });
    expect(await prefetchMedia([null, 'file:///x.mp3'])).toEqual({
      total: 0,
      cached: 0,
      failed: 0,
      aborted: false,
    });
  });

  it('stops starting downloads once the signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const summary = await prefetchMedia([AUDIO, VIDEO], { signal: controller.signal });
    expect(summary.aborted).toBe(true);
    expect(summary.cached + summary.failed).toBe(0);
    expect(mockDownloadFile).not.toHaveBeenCalled();
  });
});

describe('clearMediaCache', () => {
  it('forgets cached media so the next fetch downloads again', async () => {
    await getOrFetchMedia(AUDIO);
    await clearMediaCache();
    expect(await getCachedMediaUri(AUDIO)).toBeNull();
    await getOrFetchMedia(AUDIO);
    expect(mockDownloadFile).toHaveBeenCalledTimes(2);
  });
});
