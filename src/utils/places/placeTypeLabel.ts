/**
 * Maps a Gemini-classified `place_type` (or a raw Geoapify category string) to
 * a short, user-facing label shown on place cards.
 *
 * The 14 canonical place_type values are produced by apis/findplaces/gemini.go.
 * Anything unknown falls back through a small Geoapify heuristic and finally
 * to "Heritage Site".
 */

const PLACE_TYPE_LABELS: Record<string, string> = {
  monument: 'Monument',
  temple: 'Temple',
  fort: 'Fort',
  mosque: 'Mosque',
  church: 'Church',
  palace: 'Palace',
  museum: 'Museum',
  archaeological_site: 'Archaeological Site',
  tomb: 'Tomb',
  stepwell: 'Stepwell',
  cave: 'Cave',
  garden: 'Heritage Garden',
  lake: 'Heritage Lake',
  other: 'Heritage Site',
};

const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/temple|religion\.hindu|religion\.buddhist|religion\.jain/i, 'Temple'],
  [/mosque|religion\.islam/i, 'Mosque'],
  [/church|religion\.christian/i, 'Church'],
  [/fort|fortification/i, 'Fort'],
  [/palace/i, 'Palace'],
  [/museum/i, 'Museum'],
  [/archaeolog/i, 'Archaeological Site'],
  [/tomb|mausoleum/i, 'Tomb'],
  [/stepwell|baoli/i, 'Stepwell'],
  [/cave/i, 'Cave'],
  [/garden|park/i, 'Heritage Garden'],
  [/lake|reservoir/i, 'Heritage Lake'],
  [/monument/i, 'Monument'],
];

export function placeTypeLabel(
  placeType: string | undefined,
  categories: string[] = [],
): string {
  if (placeType) {
    const normalized = placeType.toLowerCase().trim();
    const mapped = PLACE_TYPE_LABELS[normalized];
    if (mapped) return mapped;
  }

  for (const category of categories) {
    for (const [pattern, label] of CATEGORY_HINTS) {
      if (pattern.test(category)) return label;
    }
  }

  return 'Heritage Site';
}
