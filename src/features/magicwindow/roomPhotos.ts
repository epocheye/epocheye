import type {ImageSourcePropType} from 'react-native';

/**
 * A photograph of the real room, for the viewpoint rail.
 *
 * WHY A PICTURE AND NOT A NAME. The rail is a fallback now — the guided tour
 * leads — but when a visitor does open it, a list of names is still unusable:
 * matching "Zenana corner" to the room you are standing in requires already
 * knowing which room that is. A photograph is matched by looking up.
 *
 * SOURCE AND RIGHTS. All eight of this site's usable modern photographs are by
 * one author under one licence — Mike Prince, CC BY 2.0 — which is why they were
 * chosen for the wall textures too, and why one credit line covers every use.
 * They are the only non-share-alike photographs in the corpus: the other 68 are
 * CC BY-SA, which is viral and cannot be shipped inside a proprietary app.
 * Attribution is already rendered by the magic window's "Image credits" line.
 *
 * Bundled at 256 x 256, centre-cropped, ~19 KB each and 114 KB for the set. The
 * originals are 2048 px and would have cost several MB in the APK for something
 * shown at thumbnail size.
 *
 * ── HOW THESE WERE ASSIGNED, AND THE LIMIT OF IT ─────────────────────────────
 *
 * By SUBJECT, read against each stop's own narration — not from a record of
 * where the photographer stood, because no such record exists. Commons gives
 * these eight no titles, captions or locations beyond the site itself.
 *
 * So each is "a photograph of this kind of space in this building", which is
 * weaker than "a photograph of this exact spot" and must not be presented as
 * the latter. Two viewpoints are deliberately left with NO photograph rather
 * than a plausible-looking wrong one:
 *
 *   P0  the front lawn — every one of the eight is an interior
 *   P4  the head of the stair — no photograph in the set shows a stair
 *
 * A name-only chip is honest. A picture of a different room is not, and on a
 * control whose whole purpose is "match this to what is in front of you" it
 * would be worse than the list it replaces.
 */
const PALACE_ROOM_PHOTOS: Record<string, ImageSourcePropType> = {
  // Cusped arcade and fluted columns, seen through the arches.
  P1: require('../../assets/images/palace-rooms/p1.jpg'),
  // Columns receding down the length, balustrade along the side.
  P2: require('../../assets/images/palace-rooms/p2.jpg'),
  // Surviving painted plaster at arm's length — what `what_the_board_says`
  // calls "the closest thing left to the original surface".
  P3: require('../../assets/images/palace-rooms/p3.jpg'),
  // The hall with its galleries, looking toward the light.
  P5: require('../../assets/images/palace-rooms/p5.jpg'),
  // Looking up into a gilded arch head and the timber soffit.
  P6: require('../../assets/images/palace-rooms/p6.jpg'),
  // A small enclosed corner, painted ceiling and two wall niches.
  P9: require('../../assets/images/palace-rooms/p9.jpg'),
};

/** The rail photograph for a viewpoint, or undefined for a name-only chip. */
export function roomPhotoFor(
  slug: string,
  viewpointId: string,
): ImageSourcePropType | undefined {
  if (slug !== 'tipu-summer-palace-bengaluru') return undefined;
  return PALACE_ROOM_PHOTOS[viewpointId];
}
