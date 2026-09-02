/**
 * The ladder that replaced six buttons with one.
 *
 * The rungs are ordered by how much of the site each one gives you, so the
 * tests that matter are the ones proving a richer rung is never skipped for a
 * poorer one, and that the journey's disabled state survives resolution rather
 * than collapsing into "no button".
 */
import {resolveSiteCta} from '../../src/screens/Main/siteCta';
import type {SiteCtaInput} from '../../src/screens/Main/siteCta';

const base: SiteCtaInput = {
  journeyAvailable: false,
  journeyGateState: 'outside',
  journeyAllowed: false,
  audioAvailable: false,
  magicWindowAvailable: false,
  hasReconstruction: false,
  arCapable: true,
};

describe('resolveSiteCta — the ladder', () => {
  it('prefers the journey over everything else it could have offered', () => {
    const cta = resolveSiteCta({
      ...base,
      journeyAvailable: true,
      journeyGateState: 'inside',
      journeyAllowed: true,
      audioAvailable: true,
      magicWindowAvailable: true,
      hasReconstruction: true,
      arCapable: true,
    });
    expect(cta.key).toBe('journey');
    expect(cta.disabled).toBe(false);
    expect(cta.labelKey).toBe('journey.cta');
  });

  it('falls to the audio guide where no journey is authored', () => {
    expect(resolveSiteCta({...base, audioAvailable: true}).key).toBe('audio');
  });

  // BANGALORE FORT. A magic window and no journey: without this rung the fort's
  // reconstruction lost its only entry point when the button stack went.
  it('offers the magic window where one exists and no journey does', () => {
    expect(resolveSiteCta({...base, magicWindowAvailable: true}).key).toBe('magic');
  });

  it('never lets the magic window outrank the audio guide or a journey', () => {
    expect(
      resolveSiteCta({...base, magicWindowAvailable: true, audioAvailable: true}).key,
    ).toBe('audio');
  });

  // The magic window's own admin check is what this flag carries. Opening the
  // journey must not open the magic window; the input is computed separately.
  it('does not offer the magic window when the caller says it is unavailable', () => {
    expect(
      resolveSiteCta({...base, magicWindowAvailable: false, arCapable: true}).key,
    ).toBe('scan');
  });

  // An authored reconstruction beats a generic scan: someone chose where to
  // stand and what to show. It still needs a phone that can hold it in place.
  it('offers an authored reconstruction over a generic scan', () => {
    expect(
      resolveSiteCta({...base, hasReconstruction: true, arCapable: true}).key,
    ).toBe('reconstruction');
  });

  it('never offers a reconstruction the phone cannot hold in place', () => {
    expect(
      resolveSiteCta({...base, hasReconstruction: true, arCapable: false}).key,
    ).toBe('ask');
  });

  it('falls to the camera only when the device can actually do AR', () => {
    expect(resolveSiteCta({...base, arCapable: true}).key).toBe('scan');
    expect(resolveSiteCta({...base, arCapable: false}).key).toBe('ask');
  });

  it('always resolves to something — the chat needs nothing from site or phone', () => {
    const cta = resolveSiteCta({
      journeyAvailable: false,
      journeyGateState: 'unavailable',
      journeyAllowed: false,
      audioAvailable: false,
      magicWindowAvailable: false,
      hasReconstruction: false,
      arCapable: false,
    });
    expect(cta.key).toBe('ask');
    expect(cta.disabled).toBe(false);
  });
});

describe('resolveSiteCta — the journey is dimmed, never hidden', () => {
  it('resolves to the journey off-site and says why', () => {
    const cta = resolveSiteCta({
      ...base,
      journeyAvailable: true,
      journeyGateState: 'outside',
      journeyAllowed: false,
      // Both lower rungs are available and must NOT be substituted: a visitor
      // who will be at the palace tomorrow should see the palace's own button.
      audioAvailable: true,
      magicWindowAvailable: true,
      hasReconstruction: true,
      arCapable: true,
    });
    expect(cta.key).toBe('journey');
    expect(cta.disabled).toBe(true);
    expect(cta.disabledLabelKey).toBe('journey.gate.outsideCta');
  });

  it('asks for patience while checking, rather than refusing', () => {
    const cta = resolveSiteCta({
      ...base,
      journeyAvailable: true,
      journeyGateState: 'checking',
      journeyAllowed: false,
    });
    expect(cta.disabledLabelKey).toBe('journey.gate.checking');
  });

  it('distinguishes location-unavailable from standing too far away', () => {
    const cta = resolveSiteCta({
      ...base,
      journeyAvailable: true,
      journeyGateState: 'unavailable',
      journeyAllowed: false,
    });
    expect(cta.disabledLabelKey).toBe('journey.gate.unavailableCta');
  });

  it('an admin bypass reads as allowed, like being there', () => {
    const cta = resolveSiteCta({
      ...base,
      journeyAvailable: true,
      journeyGateState: 'bypass',
      journeyAllowed: true,
    });
    expect(cta.disabled).toBe(false);
    expect(cta.disabledLabelKey).toBeUndefined();
  });
});
