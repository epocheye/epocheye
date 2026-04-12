import type { Place } from '../../utils/api/places/types';
import { formatCategory, formatPlaceType } from './formatters';

const FALLBACK_PLACE_IMAGE =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80';

/**
 * Returns a fallback image URL for a place based on its categories.
 * Used as last-resort in ResolvedSubjectImage components.
 */
export function getPlaceImage(categories: string[]): string {
  // If the place already has backend-provided images, those are preferred.
  // This function only provides a static fallback when no real images exist.
  const first = categories[0]?.toLowerCase() ?? '';
  if (first.includes('temple') || first.includes('religious')) {
    return 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80';
  }
  if (first.includes('fort') || first.includes('castle')) {
    return 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80';
  }
  return FALLBACK_PLACE_IMAGE;
}

export function buildSiteDetailData(place: Place) {
  // Prefer real images from backend (Wikipedia/Gemini), fall back to category-based Unsplash
  const backendImages = place.image_urls?.filter(Boolean) ?? [];
  const heroImages =
    backendImages.length > 0
      ? backendImages
      : [getPlaceImage(place.categories)];

  // Use Gemini place_type as primary tag, formatted category as secondary
  const placeType = place.place_type
    ? formatPlaceType(place.place_type)
    : '';
  const primaryCategory = place.categories[0]
    ? formatCategory(place.categories[0])
    : '';

  // Primary tag: prefer Gemini place_type, else formatted first category
  const era = placeType || primaryCategory || 'Historic';
  // Secondary tag: formatted second category or generic
  const style =
    place.categories.length > 1
      ? place.categories
          .slice(0, 3)
          .map(formatCategory)
          .join(', ')
      : primaryCategory || 'Heritage';

  // Use Gemini description when available
  const shortDescription =
    place.description || `Explore ${place.name} located at ${place.formatted}.`;
  const fullDescription =
    (place.description ? place.description + '\n\n' : '') +
    (place.significance || `${place.name} is a historic site located at ${place.formatted}. Discover its rich history and cultural significance.`);

  return {
    id: place.id,
    name: place.name,
    location: place.formatted || `${place.city}, ${place.country}`,
    era,
    style,
    yearBuilt: 'Unknown',
    distance: `${(place.distance_meters / 1000).toFixed(1)} km`,
    estimatedTime: '45 min',
    heroImages,
    shortDescription,
    fullDescription,
    funFacts: [],
    visitorTips: [
      'Best visited during early morning or late afternoon.',
      'Carry water and wear comfortable shoes.',
    ],
    relatedSites: [],
    lat: place.lat,
    lon: place.lon,
    address_line1: place.address_line1,
    city: place.city,
    country: place.country,
    place_type: place.place_type,
  };
}
