import type {ImageSourcePropType} from 'react-native';

/**
 * Bundled hero images for curated sites, keyed by monument slug.
 *
 * These are used when the backend has no `hero_image_url` for a site yet, so
 * the card still shows a real photo instead of an empty thumbnail. Add an entry
 * here (and drop the asset in `src/assets/images/`) when a site ships before
 * its remote hero image does.
 */
const LOCAL_SITE_HERO: Record<string, ImageSourcePropType> = {
  'konark-sun-temple': require('../../assets/images/konark.jpg'),
};

/** Local bundled hero for a slug, or null when none is bundled. */
export function localSiteHero(
  slug?: string | null,
): ImageSourcePropType | null {
  if (!slug) return null;
  return LOCAL_SITE_HERO[slug] ?? null;
}

/**
 * Resolves the best available image source for a curated site: the remote
 * `hero_image_url` when present, otherwise a bundled local hero matched by
 * slug. Returns null when neither exists so callers can skip the thumbnail.
 */
export function resolveSiteImageSource(site: {
  slug?: string | null;
  hero_image_url?: string | null;
}): ImageSourcePropType | null {
  if (site.hero_image_url) return {uri: site.hero_image_url};
  return localSiteHero(site.slug);
}
