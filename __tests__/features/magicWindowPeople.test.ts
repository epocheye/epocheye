/**
 * The palace's five figures, and the invariant that keeps them separable.
 *
 * `MagicWindowScreen` resolves who is present with
 * `people.find(pp => !pp.visibleFrom || pp.visibleFrom.includes(viewpoint.id))`.
 * `find` returns the FIRST match, so two people claiming one viewpoint makes the
 * second unreachable — which is the state FORT_PEOPLE is already in, both
 * omitting `visibleFrom` so the fort's second figure can never be selected.
 *
 * These tests pin the properties that stop the palace inheriting that: every
 * palace person declares a viewpoint, no two share one, and every viewpoint
 * named actually exists in the scene.
 *
 * Offenders are collected into arrays rather than asserted one at a time, so a
 * failure names which figure is wrong instead of just saying `false !== true`.
 */
import {peopleFor} from '../../src/features/magicwindow/people';
import {PALACE_VIEWPOINTS} from '../../src/features/magicwindow/palace';

const PALACE = 'tipu-summer-palace-bengaluru';
const palace = peopleFor(PALACE);
const viewpointIds = PALACE_VIEWPOINTS.map(v => v.id);

describe('PALACE_PEOPLE — one person per viewpoint, and no collisions', () => {
  it('places five figures', () => {
    expect(palace).toHaveLength(5);
  });

  it('every one declares a viewpoint', () => {
    // Omitting visibleFrom means "visible everywhere", which for a list of five
    // would shadow everyone after it.
    const missing = palace
      .filter(p => !p.visibleFrom || p.visibleFrom.length === 0)
      .map(p => p.id);
    expect(missing).toEqual([]);
  });

  it('no two people claim the same viewpoint', () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const p of palace) {
      for (const vp of p.visibleFrom ?? []) {
        const prev = seen.get(vp);
        if (prev) collisions.push(`${vp}: ${prev} and ${p.id}`);
        else seen.set(vp, p.id);
      }
    }
    expect(collisions).toEqual([]);
  });

  it('every viewpoint named actually exists in the scene', () => {
    const unknown = palace.flatMap(p =>
      (p.visibleFrom ?? [])
        .filter(vp => !viewpointIds.includes(vp))
        .map(vp => `${p.id} -> ${vp}`),
    );
    expect(unknown).toEqual([]);
  });
});

describe('PALACE_PEOPLE — the evidence discipline', () => {
  it('every person carries at least one NOT-A-CLAIM line', () => {
    // No source places any named person anywhere inside this palace
    // (figure-court/evidence.md:75-78, :121-135). Placement is a staging
    // decision and each figure has to say so in its own voice.
    const silent = palace
      .filter(p => !p.lines.some(l => l.tier === 'NOT-A-CLAIM'))
      .map(p => p.id);
    expect(silent).toEqual([]);
  });

  it('every line carries a source', () => {
    const unsourced = palace.flatMap(p =>
      p.lines
        .map((l, i) => (l.source.trim() ? null : `${p.id} line ${i}`))
        .filter((x): x is string => x !== null),
    );
    expect(unsourced).toEqual([]);
  });

  // evidence.md:399-400 — a type figure is captioned as a type and NEVER with a
  // personal name. Only Purnaiah has a likeness painted from life; Hyder Ali is
  // named but his face is a documented fabrication, which his lines state.
  it('only the two named figures carry personal names', () => {
    const named = palace.filter(p => /^(Purnaiah|Hyder Ali)$/.test(p.name));
    expect(named.map(p => p.id).sort()).toEqual([
      'hyderali_lawn',
      'purnaiah_darbar',
    ]);
    // The rest read as types: "A court attendant", "A Mysore trooper".
    const notAType = palace
      .filter(p => !named.includes(p) && !p.name.startsWith('A '))
      .map(p => `${p.id}: ${p.name}`);
    expect(notAType).toEqual([]);
  });

  it('the figure whose likeness is disputed says so in its own lines', () => {
    const hyder = palace.find(p => p.id === 'hyderali_lawn');
    expect(hyder).toBeDefined();
    expect(hyder!.lines.map(l => l.tier)).toContain('DISPUTED');
  });
});

describe('PALACE_PEOPLE — placement sanity', () => {
  it('nobody stands through a floor', () => {
    // Ground colonnade 0.0, first floor 2.60, external ground -0.70. Anything
    // else means a figure hovering or sunk into the slab.
    const wrong = palace
      .filter(p => ![0, 2.6, -0.7].includes(p.floorM ?? 0))
      .map(p => `${p.id}: ${p.floorM}`);
    expect(wrong).toEqual([]);
  });

  it('every figure resolves to a distinct amplified model', () => {
    const ids = palace.map(p => p.modelId);
    expect(new Set(ids).size).toBe(ids.length);
    // The raw idle moves 5 of 24 joints by 2.85 deg — about three pixels at
    // viewing distance. Only the _amp clips are perceptible.
    const raw = ids.filter(id => !/_idle_amp$/.test(id));
    expect(raw).toEqual([]);
  });
});
