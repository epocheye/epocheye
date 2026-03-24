/**
 * Region Data
 * Defines available ancestry regions for the onboarding selection screen.
 * Images are served from the CDN at jsdelivr.
 */

import { CDN_BASE } from '../../core/constants/theme';

export interface Region {
  id: string;
  name: string;
  /** Short abbreviation displayed as fallback on the card */
  abbreviation: string;
  /** Accent color for the card's visual marker */
  color: string;
  /** CDN URL for the region's monument image */
  imageUrl: string;
}

export const REGIONS: Region[] = [
  {
    id: 'odisha',
    name: 'Odisha',
    abbreviation: 'OD',
    color: '#D4860A',
    imageUrl: `${CDN_BASE}/monuments/Konarka_Temple-2.jpg`,
  },
  {
    id: 'rajasthan',
    name: 'Rajasthan',
    abbreviation: 'RJ',
    color: '#C9553A',
    imageUrl: `${CDN_BASE}/monuments/chittorgarh-fort.jpg`,
  },
  {
    id: 'bengal',
    name: 'Bengal',
    abbreviation: 'BN',
    color: '#3A8C6E',
    imageUrl: `${CDN_BASE}/monuments/victoria.jpg`,
  },
  {
    id: 'punjab',
    name: 'Punjab',
    abbreviation: 'PB',
    color: '#D4860A',
    imageUrl: `${CDN_BASE}/monuments/amritsar.jpg`,
  },
  {
    id: 'tamil_nadu',
    name: 'Tamil Nadu',
    abbreviation: 'TN',
    color: '#8B5E3C',
    imageUrl: `${CDN_BASE}/monuments/tamil.jpg`,
  },
  {
    id: 'kerala',
    name: 'Kerala',
    abbreviation: 'KL',
    color: '#2E7D5B',
    imageUrl: `${CDN_BASE}/monuments/kerala.jpg`,
  },
  {
    id: 'maharashtra',
    name: 'Maharashtra',
    abbreviation: 'MH',
    color: '#A0522D',
    imageUrl: `${CDN_BASE}/monuments/maharashtra.jpg`,
  },
  {
    id: 'persia',
    name: 'Persia',
    abbreviation: 'PR',
    color: '#6B4C8A',
    imageUrl: `${CDN_BASE}/monuments/persia.jpg`,
  },
  {
    id: 'china',
    name: 'China',
    abbreviation: 'CN',
    color: '#B22234',
    imageUrl: `${CDN_BASE}/monuments/china.jpg`,
  },
  {
    id: 'the_ottomans',
    name: 'The Ottomans',
    abbreviation: 'OT',
    color: '#1E6F8A',
    imageUrl: `${CDN_BASE}/monuments/ottoman.jpg`,
  },
  {
    id: 'mesopotamia',
    name: 'Mesopotamia',
    abbreviation: 'MS',
    color: '#5C7A3D',
    imageUrl: `${CDN_BASE}/monuments/mesopotamia.jpg`,
  },
];
