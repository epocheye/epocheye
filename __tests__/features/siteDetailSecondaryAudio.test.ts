/**
 * THE SECONDARY DOOR TO THE NARRATION.
 *
 * The ladder resolves ONE button and rung 1 returns outright wherever a journey
 * is authored, so at the summer palace `case 'audio'` in handleSiteCta is
 * unreachable — for every account, not just admins. These tests pin the two
 * halves of that claim: that the primary really does resolve to `journey` for a
 * non-admin standing at the palace, and that the secondary affordance's own
 * condition is therefore true there.
 *
 * The condition under test is the literal expression at
 * SiteDetailScreen.tsx:531 — `hasAudioGuide && siteCta.key !== 'audio'`. It is
 * restated here rather than imported because it is one line of screen state; if
 * it is ever extracted into a helper, import it and delete the local copy.
 */
import {resolveSiteCta} from '../../src/screens/Main/siteCta';
import type {SiteCtaInput} from '../../src/screens/Main/siteCta';
import {
  canBeginJourney,
  JOURNEY_OPEN_TO_ALL,
} from '../../src/screens/Main/journey/journeyConfig';
import {shouldShowAudioCta} from '../../src/shared/utils/audioGuide';

const PALACE = 'tipu-summer-palace-bengaluru';
const VISITOR = 'someone@example.com'; // deliberately NOT on the admin allowlist

/** SiteDetailScreen.tsx:531 */
const showSecondaryAudio = (hasAudioGuide: boolean, key: string) =>
  hasAudioGuide && key !== 'audio';

const base: SiteCtaInput = {
  journeyAvailable: false,
  journeyGateState: 'outside',
  journeyAllowed: false,
  audioAvailable: false,
  magicWindowAvailable: false,
  hasReconstruction: false,
  arCapable: true,
};

describe('the palace shadows its own audio rung', () => {
  it('offers the journey to a NON-admin, because JOURNEY_OPEN_TO_ALL is set', () => {
    expect(JOURNEY_OPEN_TO_ALL).toBe(true);
    expect(canBeginJourney(PALACE, VISITOR)).toBe(true);
  });

  it('resolves the one button to journey, never audio, even with stops', () => {
    const cta = resolveSiteCta({
      ...base,
      journeyAvailable: canBeginJourney(PALACE, VISITOR),
      journeyGateState: 'inside',
      journeyAllowed: true,
      audioAvailable: true,
    });
    expect(cta.key).toBe('journey');
    expect(cta.key).not.toBe('audio');
  });

  it('so the secondary affordance shows for that visitor', () => {
    const cta = resolveSiteCta({
      ...base,
      journeyAvailable: canBeginJourney(PALACE, VISITOR),
      journeyGateState: 'inside',
      journeyAllowed: true,
      audioAvailable: true,
    });
    expect(showSecondaryAudio(true, cta.key)).toBe(true);
  });

  // The case the affordance was actually built for: a visitor who is at the
  // site but cannot walk it, or is not at the site at all. The journey button
  // stays on screen and dimmed; this is the live thing underneath it.
  it('shows even when the journey button is disabled by the geofence', () => {
    const cta = resolveSiteCta({
      ...base,
      journeyAvailable: canBeginJourney(PALACE, VISITOR),
      journeyGateState: 'outside',
      journeyAllowed: false,
      audioAvailable: false, // shouldShowAudioCta is FALSE off-site, by design
    });
    expect(cta.key).toBe('journey');
    expect(cta.disabled).toBe(true);
    expect(showSecondaryAudio(true, cta.key)).toBe(true);
  });
});

describe('it does not duplicate the primary', () => {
  it('stays hidden where the audio guide IS the one button', () => {
    const cta = resolveSiteCta({...base, audioAvailable: true});
    expect(cta.key).toBe('audio');
    expect(showSecondaryAudio(true, cta.key)).toBe(false);
  });

  it('stays hidden where the venue has no stops at all', () => {
    const cta = resolveSiteCta({...base});
    expect(showSecondaryAudio(false, cta.key)).toBe(false);
  });
});

describe('the primary rung keeps its on-site rule', () => {
  // shouldShowAudioCta is NOT the secondary's gate and is left untouched; this
  // pins that it still refuses off-site, so the two gates cannot be conflated.
  it('refuses the audio rung off-site for a non-admin', () => {
    expect(
      shouldShowAudioCta({hasStops: true, atThisVenue: false, adminBypass: false}),
    ).toBe(false);
  });

  it('allows it on-site', () => {
    expect(
      shouldShowAudioCta({hasStops: true, atThisVenue: true, adminBypass: false}),
    ).toBe(true);
  });
});
