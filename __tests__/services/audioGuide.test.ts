/**
 * Pure helpers behind the audio guide screen: zone grouping, duration
 * formatting and the entry-point gate. Rendering is not exercised here — these
 * are the bits with real branching.
 */
import {
  formatClipDuration,
  groupStopsByZone,
  hasRestoration,
  isPlayable,
  shouldShowAudioCta,
  wipeSplitX,
} from '../../src/shared/utils/audioGuide';
import type { AudioStop } from '../../src/utils/api/audio/types';

const clip = (overrides: Partial<AudioStop['clip']> = {}) =>
  ({
    lang: 'en',
    persona: 'casual',
    audio_url: 'audio/x.m4a',
    duration_ms: 60_000,
    transcript: 't',
    source_ids: ['s1'],
    tier: 'CONFIRMED',
    ...overrides,
  } as NonNullable<AudioStop['clip']>);

const stop = (
  stop_key: string,
  sort_order: number,
  zone?: string,
  withClip = true,
): AudioStop => ({
  stop_key,
  title: `Title ${stop_key}`,
  sort_order,
  ...(zone ? { zone } : {}),
  ...(withClip ? { clip: clip() } : {}),
});

describe('formatClipDuration', () => {
  it('formats as m:ss with a zero-padded seconds field', () => {
    expect(formatClipDuration(60_000)).toBe('1:00');
    expect(formatClipDuration(134_000)).toBe('2:14');
    expect(formatClipDuration(9_000)).toBe('0:09');
    expect(formatClipDuration(3_601_000)).toBe('60:01');
  });

  it('truncates sub-second remainders rather than rounding up', () => {
    expect(formatClipDuration(59_999)).toBe('0:59');
  });

  it('collapses missing/invalid values to 0:00 instead of NaN', () => {
    expect(formatClipDuration(0)).toBe('0:00');
    expect(formatClipDuration(-1)).toBe('0:00');
    expect(formatClipDuration(undefined)).toBe('0:00');
    expect(formatClipDuration(null)).toBe('0:00');
    expect(formatClipDuration(Number.NaN)).toBe('0:00');
  });
});

describe('groupStopsByZone', () => {
  it('puts ungrouped stops in a single null-zone bucket, first', () => {
    const groups = groupStopsByZone([
      stop('a', 0, 'upper_floor'),
      stop('b', 1),
      stop('c', 2, 'courtyard'),
      stop('d', 3),
    ]);
    expect(groups[0].zone).toBeNull();
    expect(groups[0].stops.map(s => s.stop_key)).toEqual(['b', 'd']);
  });

  it('keeps named zones in first-appearance (= sort) order', () => {
    const groups = groupStopsByZone([
      stop('a', 0, 'upper_floor'),
      stop('b', 1, 'courtyard'),
      stop('c', 2, 'upper_floor'),
    ]);
    expect(groups.map(g => g.zone)).toEqual(['upper_floor', 'courtyard']);
    // Server ordering is preserved WITHIN a zone too — no re-sorting.
    expect(groups[0].stops.map(s => s.stop_key)).toEqual(['a', 'c']);
  });

  it('omits the ungrouped bucket entirely when every stop has a zone', () => {
    const groups = groupStopsByZone([
      stop('a', 0, 'upper_floor'),
      stop('b', 1, 'upper_floor'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].zone).toBe('upper_floor');
  });

  it('treats a blank/whitespace zone as ungrouped', () => {
    const groups = groupStopsByZone([stop('a', 0, '   ')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].zone).toBeNull();
  });

  it('returns an empty array for no stops', () => {
    expect(groupStopsByZone([])).toEqual([]);
  });
});

describe('isPlayable', () => {
  it('is false when the stop carries no clip (nothing recorded yet)', () => {
    expect(isPlayable(stop('a', 0, undefined, false))).toBe(false);
  });

  it('is false when the clip exists but has no url', () => {
    const s = stop('a', 0);
    s.clip = clip({ audio_url: '' });
    expect(isPlayable(s)).toBe(false);
  });

  it('is true for a clip with a url', () => {
    expect(isPlayable(stop('a', 0))).toBe(true);
  });
});

describe('hasRestoration', () => {
  it('is false for an ordinary stop', () => {
    expect(hasRestoration(stop('a', 0))).toBe(false);
  });

  it('is true when the stop carries a restoration image', () => {
    const s = { ...stop('a', 0), restoration_image_url: 'audio/x/restored.jpg' };
    expect(hasRestoration(s)).toBe(true);
  });

  it('is false for a blank url — an empty string is not an asset', () => {
    expect(hasRestoration({ ...stop('a', 0), restoration_image_url: '   ' })).toBe(
      false,
    );
  });

  it('keys on the image, not the caption — an uncaptioned image is still worth showing', () => {
    const s = stop('a', 0);
    s.clip = clip({ restoration_caption: 'Reconstructed from…' });
    // Caption present, image absent → nothing to reveal.
    expect(hasRestoration(s)).toBe(false);
  });
});

describe('wipeSplitX', () => {
  it('maps the handle fraction onto pixels', () => {
    expect(wipeSplitX(0, 1000)).toBe(0);
    expect(wipeSplitX(0.5, 1000)).toBe(500);
    expect(wipeSplitX(1, 1000)).toBe(1000);
    expect(wipeSplitX(0.42, 1200)).toBeCloseTo(504);
  });

  it('clamps an overshooting drag rather than splitting outside the image', () => {
    expect(wipeSplitX(-0.4, 1000)).toBe(0);
    expect(wipeSplitX(1.9, 1000)).toBe(1000);
  });

  it('is defensive about a zero or non-finite frame', () => {
    expect(wipeSplitX(0.5, 0)).toBe(0);
    expect(wipeSplitX(Number.NaN, 1000)).toBe(0);
    expect(wipeSplitX(0.5, Number.NaN)).toBe(0);
  });
});

describe('shouldShowAudioCta', () => {
  it('hides when the site has no stops, even for an admin on-site', () => {
    expect(
      shouldShowAudioCta({
        hasStops: false,
        atThisVenue: true,
        adminBypass: true,
      }),
    ).toBe(false);
  });

  it('hides for a normal user who is not inside this venue', () => {
    expect(
      shouldShowAudioCta({
        hasStops: true,
        atThisVenue: false,
        adminBypass: false,
      }),
    ).toBe(false);
  });

  it('shows for a normal user standing in the venue', () => {
    expect(
      shouldShowAudioCta({
        hasStops: true,
        atThisVenue: true,
        adminBypass: false,
      }),
    ).toBe(true);
  });

  it('shows for an admin anywhere — the bypass', () => {
    expect(
      shouldShowAudioCta({
        hasStops: true,
        atThisVenue: false,
        adminBypass: true,
      }),
    ).toBe(true);
  });
});
