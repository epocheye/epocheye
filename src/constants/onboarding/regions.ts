/**
 * Region Data
 * Defines available ancestry regions for the onboarding selection screen.
 */

export interface Region {
  id: string;
  name: string;
  /** Short abbreviation displayed as a visual placeholder on the card */
  abbreviation: string;
  /** Accent color for the card's visual marker */
  color: string;
}

export const REGIONS: Region[] = [
  { id: 'odisha', name: 'Odisha', abbreviation: 'OD', color: '#D4860A' },
  { id: 'rajasthan', name: 'Rajasthan', abbreviation: 'RJ', color: '#C9553A' },
  { id: 'bengal', name: 'Bengal', abbreviation: 'BN', color: '#3A8C6E' },
  { id: 'punjab', name: 'Punjab', abbreviation: 'PB', color: '#D4860A' },
  { id: 'tamil_nadu', name: 'Tamil Nadu', abbreviation: 'TN', color: '#8B5E3C' },
  { id: 'kerala', name: 'Kerala', abbreviation: 'KL', color: '#2E7D5B' },
  { id: 'maharashtra', name: 'Maharashtra', abbreviation: 'MH', color: '#A0522D' },
  { id: 'persia', name: 'Persia', abbreviation: 'PR', color: '#6B4C8A' },
  { id: 'china', name: 'China', abbreviation: 'CN', color: '#B22234' },
  { id: 'the_ottomans', name: 'The Ottomans', abbreviation: 'OT', color: '#1E6F8A' },
  { id: 'mesopotamia', name: 'Mesopotamia', abbreviation: 'MS', color: '#5C7A3D' },
];
