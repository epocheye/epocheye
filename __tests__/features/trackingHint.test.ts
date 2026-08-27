/**
 * The one guarantee worth locking down: a visitor never sees an ARCore symbol.
 *
 * This is not hypothetical. Tracking failures used to be posted down the same
 * `onARError` channel that carries prose, and every screen renders that channel
 * straight into a status pill — so `INSUFFICIENT_FEATURES` reached real users, and a
 * stale `BAD_STATE` was recorded sitting on screen at Bangalore Fort while tracking
 * was perfectly healthy. These tests fail if that can ever happen again.
 */
import en from '../../src/i18n/locales/en.json';
import {
  TRACKING_FAILURE_REASONS,
  isTrackingFailureRetryable,
  parseTrackingFailure,
  trackingHintKey,
  type TrackingFailureReason,
} from '../../src/features/ar/trackingHint';

type Dict = Record<string, unknown>;
const lookup = (key: string): string | undefined =>
  key.split('.').reduce<unknown>((acc, part) => (acc as Dict)?.[part], en) as
    | string
    | undefined;

describe('trackingHint', () => {
  it('maps every ARCore reason to a key that exists in en.json', () => {
    for (const reason of TRACKING_FAILURE_REASONS) {
      const key = trackingHintKey(reason);
      expect(key).toBeTruthy();
      const copy = lookup(key as string);
      expect(typeof copy).toBe('string');
      expect((copy as string).length).toBeGreaterThan(10);
    }
  });

  it('never puts an ARCore symbol in front of a visitor', () => {
    // The exact strings that leaked before. If any of them ever appears in copy the
    // visitor can read, this test is the thing that catches it.
    const symbols = [...TRACKING_FAILURE_REASONS, 'ARCORE', 'TrackingFailureReason'];
    const keys = [
      ...TRACKING_FAILURE_REASONS.flatMap(r => [
        trackingHintKey(r, false),
        trackingHintKey(r, true),
      ]),
      'arSession.hot',
      'arSession.retry',
    ].filter(Boolean) as string[];

    for (const key of keys) {
      const copy = lookup(key);
      expect(copy).toBeDefined();
      for (const symbol of symbols) {
        expect(copy as string).not.toContain(symbol);
      }
      // No underscores either — that is what an enum name looks like even when the
      // specific value is one we have not seen yet.
      expect(copy as string).not.toMatch(/[A-Z]{3,}_[A-Z]{3,}/);
    }
  });

  it('treats an empty, null or unknown reason as "nothing is wrong"', () => {
    // Native sends '' on recovery. Anything unrecognised must degrade to silence
    // rather than to a banner nobody can act on.
    expect(parseTrackingFailure('')).toBe('NONE');
    expect(parseTrackingFailure(null)).toBe('NONE');
    expect(parseTrackingFailure(undefined)).toBe('NONE');
    expect(parseTrackingFailure('SOMETHING_NEW_IN_ARCORE_2027')).toBe('NONE');
    expect(trackingHintKey('NONE')).toBeNull();
  });

  it('accepts the enum names ARCore actually sends', () => {
    for (const reason of TRACKING_FAILURE_REASONS) {
      expect(parseTrackingFailure(reason)).toBe(reason);
    }
  });

  it('only offers "try again" where trying again can honestly help', () => {
    // Another app holding the camera will not release it because we retried, so
    // promising a retry there would be a lie. Everything else clears when the
    // visitor moves, adds light, or slows down.
    expect(isTrackingFailureRetryable('CAMERA_UNAVAILABLE')).toBe(false);
    expect(isTrackingFailureRetryable('NONE')).toBe(false);
    const clearable: TrackingFailureReason[] = [
      'INSUFFICIENT_LIGHT',
      'INSUFFICIENT_FEATURES',
      'EXCESSIVE_MOTION',
      'BAD_STATE',
    ];
    for (const reason of clearable) {
      expect(isTrackingFailureRetryable(reason)).toBe(true);
    }
  });

  it('says something different when the phone lamp is already on', () => {
    // The app lights the torch after 2 s of darkness. Repeating "it's too dark"
    // without saying the lamp is on and what it cannot reach is not useful.
    const off = lookup(trackingHintKey('INSUFFICIENT_LIGHT', false) as string);
    const on = lookup(trackingHintKey('INSUFFICIENT_LIGHT', true) as string);
    expect(off).not.toEqual(on);
  });
});

describe('the earphone advice', () => {
  it('encourages earphones without requiring them', () => {
    const copy = lookup('journey.prepare.earphones') as string;
    expect(copy).toBeDefined();
    // Must not read as a requirement. Negated forms ("not required") are the whole
    // point of this line, so strip them before looking for a demand — otherwise the
    // assertion fails on exactly the wording we want.
    const demand = copy
      .toLowerCase()
      .replace(/\b(?:not|aren't|isn't|no need)\b[^.]*?required/g, '')
      .replace(/\bnot mandatory\b/g, '');
    expect(demand).not.toMatch(/you must|is required|are required|mandatory|need to wear/);
    // Must say the speaker is fine, so nobody without earphones feels shut out.
    expect(copy.toLowerCase()).toContain('speaker');
    // Must say WHEN — connecting mid-playback is the documented cause of Android
    // denying audio focus and the welcome never starting (useAudioCompletion, (A)).
    expect(copy.toLowerCase()).toMatch(/before you start|now/);
  });

  it('warns that AR can fail, before the camera opens', () => {
    const copy = lookup('journey.prepare.arCaution') as string;
    expect(copy).toBeDefined();
    expect(copy.length).toBeGreaterThan(40);
    // Names real causes rather than saying "an error occurred".
    expect(copy.toLowerCase()).toMatch(/sun|dark|warm|plain/);
    // Tells them it is recoverable, so a failure is not read as the end of the tour.
    expect(copy.toLowerCase()).toMatch(/try again|say so/);
  });
});
