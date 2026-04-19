import {CDN_BASE} from '../../core/constants/theme';

/**
 * Maps monument names (as returned by the ancestor-story SSE) to CDN
 * imagery. Used by OB07 "The Connection" to back the story header image.
 */
export const MONUMENT_IMAGES: Record<string, string> = {
  'Konark Sun Temple': `${CDN_BASE}monuments/Konarka_Temple-2.jpg`,
  'Rock-Hewn Churches of Lalibela': `${CDN_BASE}monuments/mesopotamia.jpg`,
  'Longmen Grottoes': `${CDN_BASE}monuments/china.jpg`,
  'Notre-Dame de Paris': `${CDN_BASE}monuments/victoria.jpg`,
  'Chich\u00e9n Itz\u00e1': `${CDN_BASE}monuments/mesopotamia.jpg`,
  Persepolis: `${CDN_BASE}monuments/persia.jpg`,
  'Angkor Wat': `${CDN_BASE}monuments/tamil.jpg`,
};

/** Region → fallback monument image for the "promise" hero. */
export const REGION_FALLBACK_IMAGES: Record<string, string> = {
  'South Asia': `${CDN_BASE}monuments/Konarka_Temple-2.jpg`,
  'Africa': `${CDN_BASE}monuments/mesopotamia.jpg`,
  'East Asia & Pacific': `${CDN_BASE}monuments/china.jpg`,
  'Europe': `${CDN_BASE}monuments/victoria.jpg`,
  'Americas': `${CDN_BASE}monuments/mesopotamia.jpg`,
  'Middle East & Central Asia': `${CDN_BASE}monuments/persia.jpg`,
  'Southeast Asia': `${CDN_BASE}monuments/tamil.jpg`,
};

export const DEFAULT_MONUMENT_IMAGE = `${CDN_BASE}monuments/Konarka_Temple-2.jpg`;

export const STORY_WAIT_MESSAGES = [
  'Dusting off centuries of whispers...',
  'Matching your lineage with living monuments...',
  'Cross-checking oral legends with verified records...',
  'Searching for the ancestor most likely to walk beside you...',
  'Translating old scripts into your modern story...',
  'Composing a first chapter you can visit in real life...',
];

export const STORY_WAIT_STEPS = [
  'Reading temple inscriptions',
  'Comparing migration clues',
  'Linking regions to monuments',
  'Finalizing your timeline',
];
