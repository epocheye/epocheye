/**
 * Resolver wiring: remote (CDN→cache) vs bundled fallback vs none.
 */
const mockBuildGlbUrl = jest.fn();
const mockGetOrFetchGlb = jest.fn();
const mockGetBundledGlbUri = jest.fn();
const mockLowDetailModelId = jest.fn();

jest.mock('../../src/config/glbDelivery', () => ({
  buildGlbUrl: (...a: unknown[]) => mockBuildGlbUrl(...a),
  lowDetailModelId: (...a: unknown[]) => mockLowDetailModelId(...a),
  marqueeModelsForVenue: () => [],
}));
jest.mock('../../src/services/glbCache', () => ({
  getOrFetchGlb: (...a: unknown[]) => mockGetOrFetchGlb(...a),
}));
jest.mock('../../src/services/localGlbAssets', () => ({
  getBundledGlbUri: (...a: unknown[]) => mockGetBundledGlbUri(...a),
}));

import {
  resolveModelGlbDetailed,
  resolveModelProgressive,
} from '../../src/services/glbSource';

beforeEach(() => {
  mockBuildGlbUrl.mockReset();
  mockGetOrFetchGlb.mockReset();
  mockGetBundledGlbUri.mockReset();
  mockLowDetailModelId.mockReset();
});

describe('resolveModelGlbDetailed', () => {
  it('uses the CDN→cache path when GLB_BASE_URL is configured', async () => {
    mockBuildGlbUrl.mockReturnValue('https://cdn/konark_vimana.glb');
    mockGetOrFetchGlb.mockResolvedValue('file:///cache/abc.glb');

    const res = await resolveModelGlbDetailed('konark_vimana');

    expect(mockGetOrFetchGlb).toHaveBeenCalledWith('https://cdn/konark_vimana.glb');
    expect(mockGetBundledGlbUri).not.toHaveBeenCalled();
    expect(res).toEqual({ uri: 'file:///cache/abc.glb', kind: 'remote' });
  });

  it('falls back to the bundled GLB when no CDN base is set', async () => {
    mockBuildGlbUrl.mockReturnValue(null);
    mockGetBundledGlbUri.mockResolvedValue('file:///bundle/konark_vimana.glb');

    const res = await resolveModelGlbDetailed('konark_vimana');

    expect(mockGetOrFetchGlb).not.toHaveBeenCalled();
    expect(res).toEqual({ uri: 'file:///bundle/konark_vimana.glb', kind: 'bundled' });
  });

  it('returns none when neither remote nor bundled is available', async () => {
    mockBuildGlbUrl.mockReturnValue(null);
    mockGetBundledGlbUri.mockResolvedValue(null);

    const res = await resolveModelGlbDetailed('unknown_model');

    expect(res).toEqual({ uri: null, kind: 'none' });
  });

  it('returns none for an empty model id without touching either path', async () => {
    const res = await resolveModelGlbDetailed('');
    expect(mockBuildGlbUrl).not.toHaveBeenCalled();
    expect(res).toEqual({ uri: null, kind: 'none' });
  });
});

describe('resolveModelProgressive', () => {
  it('returns the bundled low placeholder + a promise for the full model', async () => {
    mockLowDetailModelId.mockReturnValue('konark_vimana_low');
    mockBuildGlbUrl.mockReturnValue(null); // no CDN → full resolves bundled
    mockGetBundledGlbUri.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'konark_vimana_low' ? 'file:///low.glb' : 'file:///full.glb',
      ),
    );

    const { placeholder, full } = await resolveModelProgressive('konark_vimana');

    expect(placeholder).toBe('file:///low.glb');
    expect(await full).toBe('file:///full.glb');
  });

  it('has no placeholder when the model lacks a low variant; full uses CDN→cache', async () => {
    mockLowDetailModelId.mockReturnValue(null);
    mockBuildGlbUrl.mockReturnValue('https://cdn/x.glb');
    mockGetOrFetchGlb.mockResolvedValue('file:///cache/x.glb');

    const { placeholder, full } = await resolveModelProgressive('x');

    expect(placeholder).toBeNull();
    expect(mockGetBundledGlbUri).not.toHaveBeenCalled();
    expect(await full).toBe('file:///cache/x.glb');
  });
});
