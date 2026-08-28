/**
 * Covers the audio-stops client (query shape, error mapping) and the pure
 * ordering/grouping helpers the guide step depends on.
 */

const mockGet = jest.fn();

jest.mock('../../src/utils/api/auth', () => ({
  createAuthenticatedClient: () => ({ get: mockGet }),
}));

import {
  groupStopsByZone,
  listAudioStops,
  sortStops,
} from '../../src/utils/api/audio';
import type { AudioStop } from '../../src/utils/api/audio';

const SLUG = 'tipu-summer-palace-bengaluru';

function stop(
  key: string,
  order: number,
  zone: string | null | undefined,
): AudioStop {
  return {
    stop_key: key,
    title: key,
    sort_order: order,
    // The wire cannot send null here — model.go declares Zone as *string with
    // `,omitempty`, so a NULL column is omitted rather than serialised as null,
    // and AudioStop.zone is typed `?: string` to say so. groupStopsByZone is
    // nonetheless defensive about null, and that defence is worth a test, so
    // this ONE field is constructed past the type rather than the type being
    // widened to a shape the server can never produce.
    zone: zone as string | undefined,
  };
}

describe('listAudioStops', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('hits /api/v1/audio/stops with monument_id, lang and persona', async () => {
    mockGet.mockResolvedValueOnce({
      data: { monument_id: SLUG, lang: 'en', persona: 'casual', stops: [] },
    });
    const res = await listAudioStops(SLUG, { lang: 'en', persona: 'casual' });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/audio/stops', {
      params: { monument_id: SLUG, lang: 'en', persona: 'casual' },
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.stops).toEqual([]);
  });

  it('omits lang/persona so the server applies its own defaults', async () => {
    mockGet.mockResolvedValueOnce({ data: { stops: [] } });
    await listAudioStops(SLUG);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/audio/stops', {
      params: { monument_id: SLUG },
    });
  });

  it('maps an HTTP error to success=false with the status code', async () => {
    // createErrorResult recognises axios errors by their `isAxiosError` flag
    // (axios.isAxiosError), so the rejection has to carry it.
    mockGet.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 400, data: { error: 'unknown persona' } },
      }),
    );
    const res = await listAudioStops(SLUG, { persona: 'casual' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.statusCode).toBe(400);
      expect(res.error.message).toBe('unknown persona');
    }
  });

  it('returns failure when the call throws a plain error', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    const res = await listAudioStops(SLUG);
    expect(res.success).toBe(false);
  });
});

describe('sortStops', () => {
  it('orders by sort_order, then stop_key, without mutating the input', () => {
    const input = [stop('b', 2, 'x'), stop('c', 1, 'x'), stop('a', 2, 'x')];
    const sorted = sortStops(input);
    expect(sorted.map(s => s.stop_key)).toEqual(['c', 'a', 'b']);
    expect(input.map(s => s.stop_key)).toEqual(['b', 'c', 'a']);
  });
});

describe('groupStopsByZone', () => {
  it('groups consecutive stops by zone in walking order', () => {
    const groups = groupStopsByZone([
      stop('the_lost_colour', 3, 'upper_floor'),
      stop('palace_overview', 1, 'exterior_lawn'),
      stop('the_pillars', 2, 'ground_colonnade'),
    ]);
    expect(groups.map(g => g.zone)).toEqual([
      'exterior_lawn',
      'ground_colonnade',
      'upper_floor',
    ]);
    expect(groups.map(g => g.stops.map(s => s.stop_key))).toEqual([
      ['palace_overview'],
      ['the_pillars'],
      ['the_lost_colour'],
    ]);
  });

  it('keeps walking order over zone identity — a revisited zone is a new group', () => {
    const groups = groupStopsByZone([
      stop('a', 1, 'lawn'),
      stop('b', 2, 'hall'),
      stop('c', 3, 'lawn'),
    ]);
    expect(groups.map(g => g.zone)).toEqual(['lawn', 'hall', 'lawn']);
  });

  it('treats a missing or blank zone as its own null group', () => {
    const groups = groupStopsByZone([
      stop('a', 1, 'lawn'),
      stop('b', 2, undefined),
      stop('c', 3, '  '),
      stop('d', 4, null),
    ]);
    expect(groups.map(g => g.zone)).toEqual(['lawn', null]);
    expect(groups[1].stops.map(s => s.stop_key)).toEqual(['b', 'c', 'd']);
  });

  it('returns [] for no stops', () => {
    expect(groupStopsByZone([])).toEqual([]);
  });
});
