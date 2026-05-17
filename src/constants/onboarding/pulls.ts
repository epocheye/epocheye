/**
 * Heritage interests for the OB04 ("What pulls you in?") onboarding step.
 * Multi-select — user picks one or more categories that draw them in.
 *
 * Image mapping (per design):
 *   image4 → Temples
 *   image1 → Palaces
 *   image2 → Forts
 *   image3 → Ruins
 */

import type {ImageSourcePropType} from 'react-native';

export type HeritageInterest = 'temples' | 'palaces' | 'forts' | 'ruins';

export interface HeritageInterestEntry {
  id: HeritageInterest;
  label: string;
  image: ImageSourcePropType;
}

export const HERITAGE_INTERESTS: readonly HeritageInterestEntry[] = [
  {
    id: 'temples',
    label: 'Temples',
    image: require('../../assets/images/image4.webp'),
  },
  {
    id: 'palaces',
    label: 'Palaces',
    image: require('../../assets/images/image1.webp'),
  },
  {
    id: 'forts',
    label: 'Forts',
    image: require('../../assets/images/image2.webp'),
  },
  {
    id: 'ruins',
    label: 'Ruins',
    image: require('../../assets/images/image3.webp'),
  },
] as const;
