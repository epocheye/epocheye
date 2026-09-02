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
  withVideoCards,
  MAX_VIDEO_CARDS,
  videoCardId,
  type ArCard,
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

describe('video cards', () => {
  it('matches pillar titles case-insensitively and not others', () => {
    expect(titleMentionsPillar('The Pillars')).toBe(true);
    expect(titleMentionsPillar('a fluted pillar')).toBe(true);
    expect(titleMentionsPillar('Caterpillar')).toBe(false);
    expect(titleMentionsPillar('The balcony')).toBe(false);
    expect(titleMentionsPillar(null)).toBe(false);
  });

  it('appends one video card for a pillar and keeps within the cap', () => {
    const base = buildAiCards('The pillars', longBody);
    const cards = withVideoCards(
      base,
      [{ videoUrl: 'https://cdn/test.mp4', title: 'The pillars' }],
      'Watch',
    );
    expect(cards.length).toBeLessThanOrEqual(MAX_AR_CARDS);
    const video = cards[cards.length - 1];
    expect(video).toMatchObject({
      id: JOURNEY_VIDEO_CARD_ID,
      video_url: 'https://cdn/test.mp4',
      heading: 'Watch',
      narrative: 'The pillars',
    });
    expect(cards.filter((c: ArCard) => 'video_url' in c)).toHaveLength(1);
  });

  it('attaches nothing without a video URL or for a non-pillar', () => {
    const base = buildAiCards('The pillars', 'Body.');
    expect(withVideoCards(base, [{ videoUrl: '', title: 'The pillars' }], 'Watch')).toBe(base);
    expect(
      withVideoCards(base, [{ videoUrl: 'https://cdn/test.mp4', title: 'The balcony' }], 'Watch'),
    ).toBe(base);
    expect(withVideoCards(base, [], 'Watch')).toBe(base);
  });

  // THE REGRESSION THIS FUNCTION WAS MADE PLURAL FOR. PointLearnStep used
  // `.find()`, so an object with two seeded videos showed one and the other was
  // unreachable — which is exactly what migration 093 seeds on the palace's
  // sword and hilt.
  it('carries EVERY video an object has, in order, each with its own title', () => {
    const base = buildAiCards('Sword hilt', 'Body.');
    const cards = withVideoCards(
      base,
      [
        { videoUrl: 'https://cdn/a.mp4', title: 'A tiger-head hilt on a marked blade', disclosure: 'Visualisation.' },
        { videoUrl: 'https://cdn/b.mp4', title: 'A bronze tiger-head hilt', disclosure: 'Visualisation.' },
      ],
      'Watch',
    );
    const videos = cards.filter((c: ArCard) => 'video_url' in c);
    expect(videos).toHaveLength(2);
    expect(videos[0]).toMatchObject({
      id: JOURNEY_VIDEO_CARD_ID,
      video_url: 'https://cdn/a.mp4',
      narrative: 'A tiger-head hilt on a marked blade',
    });
    expect(videos[1]).toMatchObject({
      id: videoCardId(1),
      video_url: 'https://cdn/b.mp4',
      narrative: 'A bronze tiger-head hilt',
    });
    expect(cards.length).toBeLessThanOrEqual(MAX_AR_CARDS);
  });

  it('drops a generated clip missing its disclosure WITHOUT dropping its siblings', () => {
    const base = buildAiCards('Sword', 'Body.');
    const cards = withVideoCards(
      base,
      [
        { videoUrl: 'https://cdn/good.mp4', title: 'A watered-steel blade', disclosure: 'Visualisation.' },
        { videoUrl: 'https://cdn/bad.mp4', title: 'Unlabelled' },
      ],
      'Watch',
    );
    const videos = cards.filter((c: ArCard) => 'video_url' in c);
    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({ video_url: 'https://cdn/good.mp4' });
  });

  it('keeps the words when an object has more videos than can be shown', () => {
    const base = buildAiCards('Sword', longBody);
    const many = Array.from({ length: MAX_VIDEO_CARDS + 3 }, (_, i) => ({
      videoUrl: `https://cdn/${i}.mp4`,
      title: `Clip ${i}`,
      disclosure: 'Visualisation.',
    }));
    const cards = withVideoCards(base, many, 'Watch');
    const videos = cards.filter((c: ArCard) => 'video_url' in c);
    const text = cards.filter((c: ArCard) => !('video_url' in c));
    expect(videos).toHaveLength(MAX_VIDEO_CARDS);
    expect(text.length).toBeGreaterThanOrEqual(2);
    expect(cards.length).toBeLessThanOrEqual(MAX_AR_CARDS);
  });

  it('passes a poster through when the row has one', () => {
    const base = buildAiCards('Sword', 'Body.');
    const [video] = withVideoCards(
      base,
      [{
        videoUrl: 'https://cdn/a.mp4',
        title: 'A watered-steel blade',
        posterUrl: 'https://cdn/a.jpg',
        disclosure: 'Visualisation.',
      }],
      'Watch',
    ).filter((c: ArCard) => 'video_url' in c);
    expect(video).toMatchObject({ poster_url: 'https://cdn/a.jpg' });
  });
});
