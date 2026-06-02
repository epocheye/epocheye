import type {ImageSourcePropType} from 'react-native';

/**
 * Bundled hero images for curated sites, keyed by monument slug.
 *
 * A bundled hero takes precedence over the remote `hero_image_url` (see
 * resolveSiteImageSource) — it loads instantly, works offline, and lets us ship
 * a known-good photo for a site regardless of what the backend has. Add an entry
 * here and drop the asset in `src/assets/images/`.
 */
const LOCAL_SITE_HERO: Record<string, ImageSourcePropType> = {
  'konark-sun-temple': require('../../assets/images/konark.jpg'),
  'victoria-memorial': require('../../assets/images/Victoria_Memorial.jpg'),
  'indian-museum': require('../../assets/images/Indian_Museum.jpg'),
};

/** Local bundled hero for a slug, or null when none is bundled. */
export function localSiteHero(
  slug?: string | null,
): ImageSourcePropType | null {
  if (!slug) return null;
  return LOCAL_SITE_HERO[slug] ?? null;
}

/**
 * Resolves the best available image source for a curated site: a bundled local
 * hero matched by slug takes precedence (instant, offline, known-good), falling
 * back to the remote `hero_image_url`. Returns null when neither exists so
 * callers can skip the thumbnail.
 */
export function resolveSiteImageSource(site: {
  slug?: string | null;
  hero_image_url?: string | null;
}): ImageSourcePropType | null {
  const local = localSiteHero(site.slug);
  if (local) return local;
  if (site.hero_image_url) return {uri: site.hero_image_url};
  return null;
}
