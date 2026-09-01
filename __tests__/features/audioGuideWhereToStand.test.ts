/**
 * The audio guide's "where to stand" line is a JOIN, not a field.
 *
 * `audio_stops` has no walk-to column. The prose comes from the guided tour by
 * way of the magic window's viewpoints — stop_key -> viewpoint -> tour stop —
 * which is free and already authored, and also fragile: it breaks silently if
 * anyone renames a stopKey on a viewpoint or drops a tour entry, and the only
 * symptom is that a stop quietly stops saying where to go.
 *
 * So the chain is asserted here rather than noticed in a building.
 */
import {PALACE_VIEWPOINTS} from '../../src/features/magicwindow/palace';
import {tourFor, walkToForStop} from '../../src/features/magicwindow/tour';

const PALACE = 'tipu-summer-palace-bengaluru';

describe('walkToForStop', () => {
  it('answers for every palace viewpoint that names an audio stop', () => {
    const withStops = PALACE_VIEWPOINTS.filter(v => v.stopKey);
    expect(withStops.length).toBeGreaterThan(0);

    for (const vp of withStops) {
      const walkTo = walkToForStop(PALACE, vp.stopKey);
      expect(typeof walkTo).toBe('string');
      expect((walkTo ?? '').length).toBeGreaterThan(20);
    }
  });

  it('returns the prose the tour authored for that place, not another one', () => {
    // P0 is the first tour stop, and its stop_key is the one the backend seeds
    // at sort_order 10. If the join ever crosses wires this is what catches it.
    const tour = tourFor(PALACE);
    const first = tour[0];
    const viewpoint = PALACE_VIEWPOINTS.find(v => v.id === first.viewpointId);
    expect(viewpoint?.stopKey).toBe('palace_overview');
    expect(walkToForStop(PALACE, 'palace_overview')).toBe(first.walkTo);
  });

  it('is undefined for a venue with no tour rather than borrowing one', () => {
    // getMagicWindowScene falls back to the FORT for an unknown slug, so an
    // unguarded lookup would hand a Bangalore Fort direction to another venue.
    expect(walkToForStop('bangalore-fort', 'palace_overview')).toBeUndefined();
    expect(walkToForStop('konark-sun-temple', 'palace_overview')).toBeUndefined();
  });

  it('is undefined for an unknown stop, a null slug and a null stop', () => {
    expect(walkToForStop(PALACE, 'no_such_stop')).toBeUndefined();
    expect(walkToForStop(null, 'palace_overview')).toBeUndefined();
    expect(walkToForStop(PALACE, null)).toBeUndefined();
    expect(walkToForStop(undefined, undefined)).toBeUndefined();
  });
});

describe('the palace tour and its viewpoints stay in step', () => {
  it('gives every tour stop a viewpoint that exists', () => {
    const ids = new Set(PALACE_VIEWPOINTS.map(v => v.id));
    for (const stop of tourFor(PALACE)) {
      expect(ids.has(stop.viewpointId)).toBe(true);
    }
  });

  it('reaches every stop_key exactly once across the tour', () => {
    const keys = tourFor(PALACE)
      .map(s => PALACE_VIEWPOINTS.find(v => v.id === s.viewpointId)?.stopKey)
      .filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
