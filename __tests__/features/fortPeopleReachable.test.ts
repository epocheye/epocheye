/**
 * THE FORT'S SECOND FIGURE WAS UNREACHABLE, and this is the guard against it.
 *
 * `MagicWindowScreen` resolves who is present with
 * `people.find(pp => !pp.visibleFrom || pp.visibleFrom.includes(viewpoint.id))`.
 * OMITTING `visibleFrom` therefore means "visible EVERYWHERE", and both fort
 * people omitted it — so `tipu_inspecting` answered for every viewpoint and
 * `garrison_soldier_breach` could never be selected at any of them. He shipped
 * with four authored lines and no way to reach him.
 *
 * The palace has carried a test for this shape since it was written
 * (magicWindowPeople.test.ts). The fort did not, which is why the same defect
 * survived there. It does now.
 *
 * WHAT IS NOT ASSERTED HERE, deliberately: that either figure is well framed.
 * The soldier is (6.0 m, 0.35 deg off axis). Tipu is not — the nearest viewpoint
 * that can see him at all is 40.2 m away, where he is 2.42 deg tall, a speck.
 * That is a placement fault, it is recorded on the figure itself, and asserting
 * a framing bound here would either fail on a known problem or bless it.
 */
import { peopleFor } from '../../src/features/magicwindow/people';
import { getMagicWindowScene } from '../../src/features/magicwindow/scenes';

const FORT = 'bangalore-fort';
const people = peopleFor(FORT);
const scene = getMagicWindowScene(FORT);
const viewpointIds = scene.viewpoints.map(v => v.id);

describe('FORT_PEOPLE — every figure declares where it stands', () => {
  it('holds both figures', () => {
    expect(people.map(p => p.id)).toEqual([
      'tipu_inspecting',
      'garrison_soldier_breach',
    ]);
  });

  it('nobody omits visibleFrom, which would mean "everywhere"', () => {
    // The exact defect: an omitted list shadows every figure after it.
    const missing = people.filter(p => !p.visibleFrom).map(p => p.id);
    expect(missing).toEqual([]);
  });

  it('nobody is stood down by an EMPTY list either', () => {
    // `[]` is the opposite trap — it means NOWHERE, and would leave a figure
    // authored, shipped and unreachable, which is the state this test exists
    // to catch.
    const nowhere = people.filter(p => p.visibleFrom?.length === 0).map(p => p.id);
    expect(nowhere).toEqual([]);
  });

  it('names a real viewpoint every time', () => {
    for (const p of people) {
      for (const id of p.visibleFrom ?? []) {
        expect(viewpointIds).toContain(id);
      }
    }
  });

  it('gives no viewpoint two claimants — find() returns only the first', () => {
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

  it('makes the garrison soldier selectable at the breach', () => {
    // The whole point. Before this he could not be reached from anywhere.
    const at = (id: string) =>
      people.find(p => !p.visibleFrom || p.visibleFrom.includes(id))?.id;
    expect(at('VP5_the_breach')).toBe('garrison_soldier_breach');
    expect(at('VP2_over_the_barbican')).toBe('tipu_inspecting');
  });
});
