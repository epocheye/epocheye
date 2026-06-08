/**
 * Step 4 verification: a second load of the same GLB hits the on-device cache
 * and does NOT re-download. RNFS is mocked; an in-memory "filesystem" set tracks
 * which paths exist so getCachedGlbUri sees the warm file on the second call.
 */
const mockExistingPaths = new Set<string>();
const mockDownloadFile = jest.fn();

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/doc',
  downloadFile: (opts: { toFile: string }) => {
    mockDownloadFile(opts);
    mockExistingPaths.add(opts.toFile);
    return { promise: Promise.resolve({ statusCode: 200, bytesWritten: 1234 }) };
  },
  exists: (p: string) => Promise.resolve(mockExistingPaths.has(p)),
  mkdir: (p: string) => {
    mockExistingPaths.add(p);
    return Promise.resolve();
  },
  stat: () => Promise.resolve({ size: 1234 }),
  unlink: (p: string) => {
    mockExistingPaths.delete(p);
    return Promise.resolve();
  },
}));

import { getOrFetchGlb, getCachedGlbUri, clearGlbCache } from '../../src/services/glbCache';

beforeEach(async () => {
  mockExistingPaths.clear();
  mockDownloadFile.mockClear();
  await clearGlbCache();
  mockDownloadFile.mockClear(); // clearGlbCache doesn't download, but be safe
});

describe('glbCache — second load hits cache, not network', () => {
  const url = 'https://cdn.example.com/konark_vimana.glb';

  it('downloads on the first fetch, serves from disk on the second', async () => {
    const first = await getOrFetchGlb(url);
    expect(first.startsWith('file://')).toBe(true);
    expect(mockDownloadFile).toHaveBeenCalledTimes(1);

    const second = await getOrFetchGlb(url);
    expect(second).toBe(first);
    // No second network call — served from the cache manifest.
    expect(mockDownloadFile).toHaveBeenCalledTimes(1);
  });

  it('getCachedGlbUri returns null before fetch, a file:// after', async () => {
    const u = 'https://cdn.example.com/charioteer.glb';
    expect(await getCachedGlbUri(u)).toBeNull();
    await getOrFetchGlb(u);
    const cached = await getCachedGlbUri(u);
    expect(cached).not.toBeNull();
    expect(cached?.startsWith('file://')).toBe(true);
    // Reading the cache must not trigger a download.
    expect(mockDownloadFile).toHaveBeenCalledTimes(1);
  });
});
