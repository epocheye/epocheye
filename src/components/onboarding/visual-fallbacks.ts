import { CDN_BASE } from '../../core/constants/theme';

const DEFAULT_VISUAL = `${CDN_BASE}monuments/Konarka_Temple-2.jpg`;

const KEYWORD_FALLBACKS: Array<{ keywords: string[]; uri: string }> = [
  {
    keywords: ['root', 'lineage', 'ancestor', 'family'],
    uri: `${CDN_BASE}monuments/mesopotamia.jpg`,
  },
  {
    keywords: ['travel', 'journey', 'monument', 'heritage'],
    uri: `${CDN_BASE}monuments/Konarka_Temple-2.jpg`,
  },
  {
    keywords: ['history', 'manuscript', 'knowledge'],
    uri: `${CDN_BASE}monuments/china.jpg`,
  },
  {
    keywords: ['region', 'india', 'south asia'],
    uri: `${CDN_BASE}monuments/amritsar.jpg`,
  },
  {
    keywords: ['promise', 'arrival', 'destination', 'nearby'],
    uri: `${CDN_BASE}monuments/victoria.jpg`,
  },
];

export function getOnboardingVisualFallback(
  subject?: string | null,
  context?: string,
): string {
  const haystack = `${subject ?? ''} ${context ?? ''}`.toLowerCase();

  for (const entry of KEYWORD_FALLBACKS) {
    if (entry.keywords.some(keyword => haystack.includes(keyword))) {
      return entry.uri;
    }
  }

  return DEFAULT_VISUAL;
}
