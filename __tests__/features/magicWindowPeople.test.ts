/**
 * The palace's six figures, all six placed, and the invariant that keeps them
 * separable.
 *
 * `MagicWindowScreen` resolves who is present with
 * `people.find(pp => !pp.visibleFrom || pp.visibleFrom.includes(viewpoint.id))`.
 * `find` returns the FIRST match, so two people claiming one viewpoint makes the
 * second unreachable — which is the state FORT_PEOPLE is already in, both
 * omitting `visibleFrom` so the fort's second figure can never be selected.
 *
 * These tests pin the properties that stop the palace inheriting that: every
 * PLACED person declares a viewpoint, no two share one, and every viewpoint
 * named actually exists in the scene.
 *
 * "PLACED" IS STILL THE WORD, because there are three states and the middle one
 * is easy to misread. `visibleFrom` OMITTED means "visible everywhere" — the
 * fort's bug. A NON-EMPTY list means those viewpoints. An EMPTY list means
 * NOWHERE: `!person.visibleFrom` is false for `[]`, so `find` never matches it.
 *
 * Hyder Ali was stood down that way for a while — his lawn went to Tipu so that
 * one man stood there in both the AR arrival and the magic window, and every
 * free viewpoint was an interior, which his own second line says the record
 * rules out for him. P0b, the far corner of the same lawn, gave him an exterior
 * of his own, so nobody is stood down today. `stoodDown` is kept here anyway:
 * it is how the next one shows up as a deliberate act rather than as a figure
 * that quietly stopped appearing.
 *
 * Offenders are collected into arrays rather than asserted one at a time, so a
 * failure names which figure is wrong instead of just saying `false !== true`.
 */
import {peopleFor} from '../../src/features/magicwindow/people';
import {PALACE_VIEWPOINTS} from '../../src/features/magicwindow/palace';

const PALACE = 'tipu-summer-palace-bengaluru';
const palace = peopleFor(PALACE);
/** Authored and reachable — the ones `find` can actually return. */
const placed = palace.filter(p => !p.visibleFrom || p.visibleFrom.length > 0);
/** Authored but deliberately unreachable. Kept, not deleted. */
const stoodDown = palace.filter(p => p.visibleFrom?.length === 0);
const viewpointIds = PALACE_VIEWPOINTS.map(v => v.id);

describe('PALACE_PEOPLE — one person per viewpoint, and no collisions', () => {
  it('holds six figures and places all six of them', () => {
    // Hyder Ali was the sixth and was stood down with an EMPTY visibleFrom
    // while Tipu and he were both on the lawn. P0b — the far corner of the same
    // lawn — separates them, so nobody is stood down any more. If a figure ever
    // is again, `stoodDown` is how it shows up here rather than silently
    // vanishing from the venue.
    expect(palace).toHaveLength(6);
    expect(placed).toHaveLength(6);
    expect(stoodDown.map(p => p.id)).toEqual([]);
  });

  it('every PLACED person declares a viewpoint', () => {
    // Omitting visibleFrom means "visible everywhere", which in a list this
    // long would shadow everyone after it. An empty list is the opposite and
    // is checked above; this catches the omission.
    const missing = placed.filter(p => !p.visibleFrom).map(p => p.id);
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
  it('only the three named figures carry personal names', () => {
    // Tipu joins them, on the same footing as Hyder Ali: named, with a face
    // his own fifth line marks DISPUTED. A type figure still never gets a name.
    const named = palace.filter(p =>
      /^(Purnaiah|Hyder Ali|Tipu Sultan)$/.test(p.name),
    );
    expect(named.map(p => p.id).sort()).toEqual([
      'hyderali_lawn',
      'purnaiah_darbar',
      'tipu_lawn',
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

  it('every figure resolves to a distinct model', () => {
    const ids = palace.map(p => p.modelId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the five amplified figures all use an _idle_amp clip', () => {
    // The raw idle moves 5 of 24 joints by 2.85 deg — about three pixels at
    // viewing distance. Only the _amp clips are perceptible.
    //
    // TIPU IS THE ONE EXEMPTION, and it is not an oversight. He reuses
    // `tipu_figure_royal9`, the model the arrival step already downloads, which
    // is the only palace figure carrying a real talking clip
    // (Talk_with_Right_Hand_Open) rather than an amplified idle — so
    // amplification is not what makes him move. Sharing that object is also why
    // his 8.87 MB costs a visitor nothing: by the magic window it is a cache hit.
    const raw = palace
      .filter(p => p.id !== 'tipu_lawn')
      .map(p => p.modelId)
      .filter(id => !/_idle_amp$/.test(id));
    expect(raw).toEqual([]);
    expect(palace.find(p => p.id === 'tipu_lawn')?.modelId).toBe(
      'tipu_figure_royal9',
    );
  });
});
