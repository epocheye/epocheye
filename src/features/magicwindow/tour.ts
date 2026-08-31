/**
 * The guided tour — the order a visitor actually walks, and what to tell them.
 *
 * WHY THIS EXISTS. The magic window shipped as a rail of eight viewpoint names.
 * Those names mean something to whoever authored them; to a visitor they are
 * unusable, because picking the right one requires already knowing which room
 * you are in, which way you are facing, and what the other seven are. A list of
 * place names is a developer tool. This is the visitor interface.
 *
 * NOTHING HERE SENSES ANYTHING, AND THAT IS DELIBERATE. The tour tells the
 * visitor where to walk and they confirm they have arrived. It never claims to
 * know. Every way of knowing was checked and each one fails indoors:
 *
 *   GPS          fixes of 163 m have been logged inside a building on this very
 *                device (SiteReconstructionScreen), and 30-80 m drift is normal
 *                (geofenceService.ts). The palace is 31 m long.
 *   Compass      dragged around by steel indoors, which is why the native view
 *                reads a magnetometer-free sensor and why recentring is a manual
 *                act (EpocheyeMagicWindowView, "the view direction").
 *   Recognition  cannot separate these rooms, and the backend already contains
 *                the measurement proving it: apis/recognize/outdoor.go says
 *                near-identical caves AT ONE SITE lead by ~0.02 against a 0.03
 *                margin and are deliberately REFUSED. Eight interiors of one
 *                colonnade - same teak, same arches, same palette, two of them
 *                at literally the same coordinate - are a harder case than that.
 *                Explore mode would also merge them: it names an object, then
 *                dedupes by name, so two bays both become "fluted teak pillar".
 *
 * So the honest design is to lead and let the visitor confirm. Anything else
 * would be guessing at the visitor's position and being confidently wrong.
 *
 * THE ORDER IS PLACES, NOT VIEWPOINTS. Eight views stand at seven places: P6 and
 * P5 share the coordinate [0, 9, 4.2] and differ only in pitch, so the visitor
 * arrives in the darbar hall once and is then asked to look up rather than to
 * walk somewhere they are already standing. `sameSpot` marks that.
 *
 * IT ALSO REORDERS ONE STOP, and that is a deliberate editorial fix rather than
 * an accident. `audio_stops.sort_order` puts `the_stair` at 28, AFTER two stops
 * that are already upstairs - so the clip says "You came up a stair to get here"
 * two stops after the visitor got there. The tour walks the stair when it is
 * climbed. The database is untouched, so AudioGuideScreen is unaffected.
 */

import {getMagicWindowScene, hasMagicWindow} from './scenes';

/** One stop on the guided tour. */
export interface TourStop {
  /** Viewpoint id this stop opens; must exist in the scene's viewpoints. */
  viewpointId: string;
  /** Short name of the place, as a visitor would say it. */
  place: string;
  /**
   * How to get there, in plain language. No left/right relative to an unstated
   * facing, no metres, no compass - a visitor cannot act on any of those inside
   * a building. Landmarks and counts only.
   */
  walkTo: string;
  /**
   * True when this stop is at the SAME physical position as the previous one, so
   * the prompt asks the visitor to look rather than to move.
   */
  sameSpot?: boolean;
}

const PALACE_TOUR: TourStop[] = [
  {
    viewpointId: 'P0',
    place: 'The front lawn',
    walkTo:
      'Stand out on the lawn in front of the palace, far enough back to see ' +
      'the whole front at once. Face the building.',
  },
  {
    viewpointId: 'P1',
    place: 'The front colonnade',
    walkTo:
      'Walk up the steps and stop just inside, between the first two ' +
      'pillars, on the middle of the front. Face into the building.',
  },
  {
    viewpointId: 'P2',
    place: 'The end of the colonnade',
    walkTo:
      'Walk along the front, past the pillars, to the far end. Turn and look ' +
      'back down the whole length of the arcade.',
  },
  {
    viewpointId: 'P4',
    place: 'The top of the stair',
    walkTo:
      'Take the stairs up to the floor above. Stop at the top and face back ' +
      'along the building.',
  },
  {
    viewpointId: 'P6',
    place: 'The darbar hall',
    walkTo:
      'Walk to the middle of the upper floor — the tall open hall with ' +
      'galleries down both sides. Then look up.',
  },
  {
    viewpointId: 'P5',
    place: 'The darbar hall',
    // Same coordinate as P6. Asking someone to "walk to" where they are
    // standing is how a guide loses their trust.
    walkTo: 'Stay exactly where you are, and look straight ahead.',
    sameSpot: true,
  },
  {
    viewpointId: 'P9',
    place: 'The corner room',
    walkTo:
      'Carry on past the hall to the small room in the far corner of the ' +
      'upper floor.',
  },
  {
    viewpointId: 'P3',
    place: 'The museum room',
    walkTo:
      'Go back down, and along to the enclosed room at the opposite end of ' +
      'the building — the one with the display cases.',
  },
];

/**
 * The tour for a site, or an empty list. Empty means the scene has no guided
 * mode and falls back to the viewpoint rail — which is where the fort is today.
 */
export function tourFor(slug: string): TourStop[] {
  if (slug === 'tipu-summer-palace-bengaluru') return PALACE_TOUR;
  return [];
}

/**
 * The viewpoint that stands where an `audio_stops.stop_key` is heard, or
 * undefined. Lets a caller that already knows the stop — the journey's audio
 * guide — open the magic window at the right place instead of at a list.
 *
 * Guarded on `hasMagicWindow` because `getMagicWindowScene` falls back to the
 * FORT for an unknown slug, so an unguarded lookup would happily hand back a
 * Bangalore Fort viewpoint for some other venue's stop.
 */
export function viewpointForStop(
  slug: string | null | undefined,
  stopKey: string | null | undefined,
): string | undefined {
  if (!slug || !stopKey || !hasMagicWindow(slug)) return undefined;
  const scene = getMagicWindowScene(slug);
  if (scene.slug !== slug) return undefined;
  return scene.viewpoints.find(v => v.stopKey === stopKey)?.id;
}
