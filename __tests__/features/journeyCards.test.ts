/**
 * journeyCards — the placard JSON the journey hands to the native AR view.
 * Pins the DetectArScreen-compatible shape, the six-card cap and the dev-only
 * video hook (a pillar gets a video card; nothing else does).
 */
import {
  JOURNEY_VIDEO_CARD_ID,
  MAX_AR_CARDS,
  buildAiCards,
  buildGroundedCards,
  capCards,
  splitIntoSections,
  titleMentionsPillar,
  withDevVideoCard,
} from '../../src/screens/Main/journey/journeyCards';
import type { ObjectCard } from '../../src/services/detectorResolver';

const sentence = (n: number) => `Sentence number ${n} says a little about the palace.`;
const longBody = Array.from({ length: 60 }, (_, i) => sentence(i + 1)).join(' ');

describe('splitIntoSections', () => {
  it('returns nothing for empty text', () => {
    expect(splitIntoSections('')).toEqual([]);
    expect(splitIntoSections(null)).toEqual([]);
  });

  it('never cuts mid-sentence and never drops text', () => {
    const sections = splitIntoSections(longBody);
    expect(sections.length).toBeLessThanOrEqual(MAX_AR_CARDS);
    for (const s of sections) {
      expect(s.trim().endsWith('.')).toBe(true);
    }
    expect(sections.join(' ').replace(/\s+/g, ' ')).toBe(longBody);
  });

  it('keeps paragraph breaks as section boundaries', () => {
    expect(splitIntoSections('First.\n\nSecond.')).toEqual(['First.', 'Second.']);
  });
});

describe('buildAiCards', () => {
  it('puts the name on card 0 and body-only continuations after it', () => {
    const cards = buildAiCards('The pillars', longBody);
    expect(cards[0]).toMatchObject({ display_name: 'The pillars', identity_confidence: 'inferred' });
    expect(cards.slice(1).every(c => c.continuation === true && !('display_name' in c))).toBe(true);
    expect(cards.length).toBeLessThanOrEqual(MAX_AR_CARDS);
  });

  it('still emits one card for an empty body', () => {
    expect(buildAiCards('Thing', '')).toEqual([
      { display_name: 'Thing', identity_confidence: 'inferred', narrative: '' },
    ]);
  });

  it('carries no source or confidence wording for the visitor', () => {
    const cards = buildAiCards('The pillars', 'A short line.');
    for (const c of cards) {
      expect(c).not.toHaveProperty('label');
      expect(c).not.toHaveProperty('source');
      expect(c).not.toHaveProperty('disclaimer');
    }
  });
});

describe('buildGroundedCards', () => {
  const card: ObjectCard = {
    class_id: 'explore:tipu:pillars',
    display_name: 'The pillars',
    period: '1791',
    dynasty: 'Mysore',
    material: 'Teak',
    origin: 'Bengaluru',
    identity_confidence: 'inferred',
    narrative: 'Teak columns carry the upper floor. They were painted, once.',
    iconography: 'Look for the fluting.',
    has_reconstruction: false,
    context_layers: [
      { layer_id: 1, label: 'The moment', body: 'A layer.', confidence: 'grounded' },
      { layer_id: 2, label: 'Empty', body: '   ', confidence: 'inferred' },
    ],
  };

  it('leads with the identity card, then iconography and layers', () => {
    const cards = buildGroundedCards(card);
    expect(cards[0]).toMatchObject({
      display_name: 'The pillars',
      period: '1791',
      dynasty: 'Mysore',
      material: 'Teak',
      origin: 'Bengaluru',
    });
    const headings = cards.map(c => c.heading).filter(Boolean);
    expect(headings).toEqual(['What to look for', 'The moment']);
    // A layer with a blank body is skipped, not rendered as an empty placard.
    expect(cards).toHaveLength(3);
  });

  it('stays within the native cap on a long narrative (overflow folded, never dropped)', () => {
    const cards = buildGroundedCards({ ...card, narrative: longBody });
    expect(cards.length).toBe(MAX_AR_CARDS);
    const allText = cards.map(c => c.narrative).join(' ');
    expect(allText).toContain('Look for the fluting.');
    expect(allText).toContain('A layer.');
  });
});

describe('capCards', () => {
  it('folds overflow into the last kept card', () => {
    const cards = Array.from({ length: 8 }, (_, i) => ({ continuation: true, narrative: `n${i}` }));
    const capped = capCards(cards, 3);
    expect(capped).toHaveLength(3);
    expect(capped[2].narrative).toBe('n2\n\nn3\n\nn4\n\nn5\n\nn6\n\nn7');
  });

  it('leaves short sets alone', () => {
    const cards = [{ narrative: 'a' }];
    expect(capCards(cards)).toBe(cards);
  });
});

describe('dev video hook', () => {
  it('matches pillar titles case-insensitively and not others', () => {
    expect(titleMentionsPillar('The Pillars')).toBe(true);
    expect(titleMentionsPillar('a fluted pillar')).toBe(true);
    expect(titleMentionsPillar('Caterpillar')).toBe(false);
    expect(titleMentionsPillar('The balcony')).toBe(false);
    expect(titleMentionsPillar(null)).toBe(false);
  });

  it('appends one video card for a pillar and keeps within the cap', () => {
    const base = buildAiCards('The pillars', longBody);
    const cards = withDevVideoCard(base, 'The pillars', 'https://cdn/test.mp4', 'Watch');
    expect(cards.length).toBeLessThanOrEqual(MAX_AR_CARDS);
    const video = cards[cards.length - 1];
    expect(video).toMatchObject({
      id: JOURNEY_VIDEO_CARD_ID,
      video_url: 'https://cdn/test.mp4',
      heading: 'Watch',
      narrative: 'The pillars',
    });
    expect(cards.filter(c => 'video_url' in c)).toHaveLength(1);
  });

  it('attaches nothing without a video URL or for a non-pillar', () => {
    const base = buildAiCards('The pillars', 'Body.');
    expect(withDevVideoCard(base, 'The pillars', null, 'Watch')).toBe(base);
    expect(withDevVideoCard(base, 'The balcony', 'https://cdn/test.mp4', 'Watch')).toBe(base);
  });
});
