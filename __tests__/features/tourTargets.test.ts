/**
 * Guards the wiring between the tour's step definitions and the screens.
 *
 * A step whose targetId no screen registers doesn't fail loudly — it silently
 * degrades to a centered explainer card with no spotlight, which is easy to ship
 * without noticing. Renaming or moving a <TourTarget> is exactly how that
 * happens, so the link is asserted here rather than discovered on a device.
 */
/// <reference types="node" />
import fs from 'fs';
import path from 'path';
import {TOUR_STEPS} from '../../src/constants/appTour';

const SRC = path.join(__dirname, '..', '..', 'src');

/** Every `<TourTarget id="…">` literal in the source tree. */
const collectRegisteredIds = (): Set<string> => {
  const ids = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        const src = fs.readFileSync(full, 'utf8');
        for (const m of src.matchAll(/<TourTarget[\s\S]{0,200}?id=["']([^"']+)["']/g)) {
          ids.add(m[1]);
        }
      }
    }
  };
  walk(SRC);
  return ids;
};

describe('guided tour targets', () => {
  const registered = collectRegisteredIds();

  it('finds TourTarget registrations in the source tree', () => {
    // Guards the regex itself — an empty set would make every assertion below
    // vacuously pass.
    expect(registered.size).toBeGreaterThan(0);
  });

  it.each(
    TOUR_STEPS.filter(s => s.targetId).map(s => [s.id, s.targetId as string]),
  )('step "%s" targets a registered element (%s)', (_stepId, targetId) => {
    expect(Array.from(registered)).toContain(targetId);
  });

  it('has unique step ids', () => {
    const ids = TOUR_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
