/**
 * UNESCO region groupings used for the onboarding heritage picker.
 * Single-select — the user picks one region their heritage belongs to.
 */

import type { ImageSourcePropType } from 'react-native';

export type UnescoRegion =
  | 'asia_pacific'
  | 'arab_states'
  | 'north_america'
  | 'latin_america_caribbean'
  | 'europe'
  | 'africa';

export interface UnescoRegionEntry {
  id: UnescoRegion;
  label: string;
  image: ImageSourcePropType;
}

export const UNESCO_REGIONS: readonly UnescoRegionEntry[] = [
  {
    id: 'asia_pacific',
    label: 'Asia & the Pacific',
    image: require('../../assets/images/asia.png'),
  },
  {
    id: 'arab_states',
    label: 'Arab States',
    image: require('../../assets/images/arabs.png'),
  },
  {
    id: 'north_america',
    label: 'North American',
    image: require('../../assets/images/north.png'),
  },
  {
    id: 'latin_america_caribbean',
    label: 'Latin American & Caribbean',
    image: require('../../assets/images/latin.png'),
  },
  {
    id: 'europe',
    label: 'European',
    image: require('../../assets/images/europe.png'),
  },
  {
    id: 'africa',
    label: 'African',
    image: require('../../assets/images/african.png'),
  },
] as const;
