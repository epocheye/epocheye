/**
 * ONE MAN ON THE LAWN, AND HE IS IN FRAME.
 *
 * Two invariants that the magic window depends on and that nothing enforced.
 *
 * ONE: `visibleFrom` sets must be DISJOINT. MagicWindowScreen picks a figure
 * with `people.find(...)`, which returns the FIRST match, so two people
 * claiming one viewpoint makes the second unreachable for ever. That is not a
 * hypothetical — it is the state FORT_PEOPLE is in today, where both entries
 * omit `visibleFrom` and the fort's second figure can never be selected. The
 * palace now has six entries and it only takes one careless copy-paste.
 *
 * An EMPTY array is the third state and the one that is easy to misread:
 * `!person.visibleFrom` is false for `[]`, so an omitted list means "everywhere"
 * and an empty list means "nowhere". Hyder Ali is stood down that way rather
 * than deleted, so the test asserts the difference on purpose.
 *
 * TWO: a figure outside the delivered field of view is not a figure. SceneView
 * hands `fovDeg` to Filament as a focal length and Filament reads it as
 * VERTICAL against a 24 mm sensor, so the palace's authored 62 arrives as
 * 43.66 vertical and 20.94 horizontal — a 10.47 half-angle, not 31. Hyder Ali's
 * own comment records a first draft placed at 13.8 off axis, which was simply
 * off screen, and the same fault had already moved Purnaiah once. The
 * arithmetic belongs in a test rather than in three comments.
 */
import {
  peopleFor,
  type MagicWindowPerson,
} from '../../src/features/magicwindow/people';
import { getMagicWindowScene } from '../../src/features/magicwindow/scenes';

const PALACE = 'tipu-summer-palace-bengaluru';

/** Delivered horizontal half-angle for an authored fovDeg of 62. */
const H_HALF_DEG = 10.47;
/** Delivered vertical half-angle, likewise. */
const V_HALF_DEG = 21.83;

const people = peopleFor(PALACE);
const scene = getMagicWindowScene(PALACE);
const viewpointById = (id: string) => scene.viewpoints.find(v => v.id === id);

/** Signed angle between the viewpoint's heading and the bearing to a figure. */
function offAxisDeg(vp: { position: readonly number[]; headingDeg: number },
                    who: MagicWindowPerson): number {
  const dx = who.position[0] - vp.position[0];
  const dy = who.position[1] - vp.position[1];
  const az = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  return (((az - vp.headingDeg + 540) % 360) - 180);
}

/** How far below the eye the figure's feet sit, in degrees. */
function feetBelowDeg(vp: { position: readonly number[] },
                      who: MagicWindowPerson): number {
  const dx = who.position[0] - vp.position[0];
  const dy = who.position[1] - vp.position[1];
  const range = Math.hypot(dx, dy);
  const drop = vp.position[2] - (who.floorM ?? 0);
  return (Math.atan2(drop, range) * 180) / Math.PI;
}

describe('the lawn is one man, and he is Tipu', () => {
  it('places Tipu at P0 — the same man the arrival step stands there in AR', () => {
    const atP0 = people.find(
      p => !p.visibleFrom || p.visibleFrom.includes('P0'),
    );
    expect(atP0?.id).toBe('tipu_lawn');
    expect(atP0?.name).toBe('Tipu Sultan');
  });

  it('reuses the arrival step’s own model, so it is already cached', () => {
    const tipu = people.find(p => p.id === 'tipu_lawn');
    // journeyConfig's figureModelId for this venue. Same string, same object.
    expect(tipu?.modelId).toBe('tipu_figure_royal9');
  });

  it('puts Hyder Ali at P0b and NOWHERE ELSE — one man per patch of lawn', () => {
    const hyder = people.find(p => p.id === 'hyderali_lawn');
    expect(hyder).toBeDefined();
    // He was stood down with an EMPTY list while both men were on the same
    // ground. EMPTY means nowhere and OMITTED would mean everywhere — the
    // difference is the whole mechanism, so the exact set is asserted rather
    // than just checked for containing P0b.
    expect(hyder?.visibleFrom).toEqual(['P0b']);
    expect(hyder?.visibleFrom?.includes('P0')).toBe(false);
    // His evidence survives the move intact, including the 1846-engraving
    // finding. This is the assertion that would have caught the earlier fix
    // costing three sourced lines.
    expect(hyder?.lines.length).toBeGreaterThanOrEqual(3);
    expect(hyder?.lines.some(l => l.tier === 'DISPUTED')).toBe(true);
  });

  it('resolves P0 to Tipu alone and P0b to Hyder Ali alone', () => {
    // Exactly what MagicWindowScreen does: find the first person whose
    // visibleFrom admits this viewpoint.
    const at = (id: string) =>
      people.find(p => !p.visibleFrom || p.visibleFrom.includes(id))?.id;
    expect(at('P0')).toBe('tipu_lawn');
    expect(at('P0b')).toBe('hyderali_lawn');
  });

  it('keeps each man inside the DELIVERED half-angle from his own viewpoint, and out of the other', () => {
    // H_HALF_DEG is 10.47, not the authored 62: fovDeg becomes a focal length
    // and Filament reads it as VERTICAL off a 24 mm sensor, so an authored 62
    // arrives as 43.66 vertical / 20.94 horizontal. Framing against 62 is what
    // put an earlier draft of this very figure off screen at 13.8 deg.
    const who = (id: string) => people.find(p => p.id === id)!;
    const vp = (id: string) => viewpointById(id)!;
    expect(Math.abs(offAxisDeg(vp('P0b'), who('hyderali_lawn')))).toBeLessThan(
      H_HALF_DEG,
    );
    expect(Math.abs(offAxisDeg(vp('P0'), who('tipu_lawn')))).toBeLessThan(
      H_HALF_DEG,
    );
    // And each is excluded from the other's viewpoint, which is the whole point
    // of the second position — the renderer draws ONE figure at a time, so a
    // near-miss here would show the wrong man rather than two.
    expect(Math.abs(offAxisDeg(vp('P0b'), who('tipu_lawn')))).toBeGreaterThan(
      H_HALF_DEG,
    );
    expect(Math.abs(offAxisDeg(vp('P0'), who('hyderali_lawn')))).toBeGreaterThan(
      H_HALF_DEG,
    );
    // Feet on the floor and head in frame from his own viewpoint too — the
    // horizontal check alone would pass a figure standing below the bottom edge.
    expect(feetBelowDeg(vp('P0b'), who('hyderali_lawn'))).toBeLessThan(
      V_HALF_DEG,
    );
  });
});

describe('visibleFrom sets stay disjoint — find() returns the first match', () => {
  it('gives no viewpoint two claimants', () => {
    const claims = new Map<string, string[]>();
    for (const p of people) {
      for (const id of p.visibleFrom ?? []) {
        claims.set(id, [...(claims.get(id) ?? []), p.id]);
      }
    }
    for (const [id, who] of claims) {
      expect(`${id}: ${who.join(', ')}`).toBe(`${id}: ${who[0]}`);
    }
  });

  it('names a real viewpoint in every set', () => {
    for (const p of people) {
      for (const id of p.visibleFrom ?? []) {
        expect(viewpointById(id)).toBeDefined();
      }
    }
  });
});

describe('every placed figure is inside the DELIVERED field of view', () => {
  for (const p of people) {
    for (const id of p.visibleFrom ?? []) {
      const vp = viewpointById(id);
      if (!vp) continue;
      it(`${p.id} is in frame from ${id}`, () => {
        // 62 deg authored is NOT what the visitor gets. See the header.
        expect(Math.abs(offAxisDeg(vp, p))).toBeLessThan(H_HALF_DEG);
        expect(feetBelowDeg(vp, p)).toBeLessThan(V_HALF_DEG);
      });
    }
  }
});
