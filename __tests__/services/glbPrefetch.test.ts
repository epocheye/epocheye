/**
 * Step 3 verification: venue→marquee mapping + that arrival prefetch warms the
 * venue's model through the resolver. GLB_BASE_URL is unset in tests, so the
 * resolver takes the bundled path → we assert getBundledGlbUri is warmed.
 */
const mockGetOrFetchGlb = jest.fn();
const mockGetBundledGlbUri = jest.fn();

jest.mock('../../src/services/glbCache', () => ({
  getOrFetchGlb: (...a: unknown[]) => mockGetOrFetchGlb(...a),
}));
jest.mock('../../src/services/localGlbAssets', () => ({
  getBundledGlbUri: (...a: unknown[]) => mockGetBundledGlbUri(...a),
}));

import { marqueeModelsForVenue } from '../../src/config/glbDelivery';
import { prefetchVenueMarquee } from '../../src/services/glbSource';

const flush = () => new Promise<void>(r => setImmediate(() => r()));

beforeEach(() => {
  mockGetOrFetchGlb.mockReset();
  mockGetBundledGlbUri.mockReset().mockResolvedValue('file:///bundle/konark_vimana.glb');
});

describe('marqueeModelsForVenue', () => {
  it('maps the konark venue to the bundled marquee model', () => {
    expect(marqueeModelsForVenue('konark-sun-temple')).toEqual(['konark_vimana']);
    expect(marqueeModelsForVenue('konark')).toEqual(['konark_vimana']);
  });

  it('returns [] for unknown or empty venues (empty-safe)', () => {
    expect(marqueeModelsForVenue('taj-mahal')).toEqual([]);
    expect(marqueeModelsForVenue('')).toEqual([]);
  });
});

describe('prefetchVenueMarquee', () => {
  it('warms the venue marquee model on arrival (bundled path here)', async () => {
    prefetchVenueMarquee('konark-sun-temple');
    await flush();
    expect(mockGetBundledGlbUri).toHaveBeenCalledWith('konark_vimana');
  });

  it('does nothing for an unmapped venue', async () => {
    prefetchVenueMarquee('taj-mahal');
    await flush();
    expect(mockGetBundledGlbUri).not.toHaveBeenCalled();
    expect(mockGetOrFetchGlb).not.toHaveBeenCalled();
  });
});
