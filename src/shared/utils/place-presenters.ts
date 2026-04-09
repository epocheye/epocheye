import type { Place } from '../../utils/api/places/types';

const CATEGORY_IMAGE_MAP: Record<string, string> = {
  temple:
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80',
  religious:
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80',
  fort: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
  castle:
    'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
};

const FALLBACK_PLACE_IMAGE =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80';

export function getPlaceImage(categories: string[]): string {
  const first = categories[0]?.toLowerCase() ?? '';
  for (const [keyword, uri] of Object.entries(CATEGORY_IMAGE_MAP)) {
    if (first.includes(keyword)) {
      return uri;
    }
  }
  return FALLBACK_PLACE_IMAGE;
}

export function buildSiteDetailData(place: Place) {
  return {
    id: place.id,
    name: place.name,
    location: place.formatted || `${place.city}, ${place.country}`,
    era: place.categories[0] || 'Historic',
    style: place.categories.join(', ') || 'Architecture',
    yearBuilt: 'Unknown',
    distance: `${(place.distance_meters / 1000).toFixed(1)} km`,
    estimatedTime: '45 min',
    heroImages: [getPlaceImage(place.categories)],
    shortDescription: `Explore ${place.name} located at ${place.formatted}.`,
    fullDescription: `${place.name} is a historic site located at ${place.formatted}. Discover its rich history and cultural significance.`,
    funFacts: [],
    visitorTips: [
      'Best visited during early morning or late afternoon.',
      'Carry water and wear comfortable shoes.',
    ],
    relatedSites: [],
    rating: 4.5,
    reviews: 0,
    lat: place.lat,
    lon: place.lon,
    address_line1: place.address_line1,
    city: place.city,
    country: place.country,
  };
}
