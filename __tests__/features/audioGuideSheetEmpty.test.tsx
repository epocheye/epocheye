/**
 * The stop list must state its own empty case.
 *
 * "All stops" rendered its heading unconditionally and then mapped over the
 * groups. With no groups that is a gold heading over nothing — and the only
 * thing preventing a visitor seeing it was that AudioGuideScreen hides the
 * control that opens this sheet whenever it is showing a fallback state.
 *
 * That is two files happening to agree, not a guarantee. The sheet is ALWAYS
 * mounted, because the player lives inside it, so anything that empties the
 * groups while it is open puts the blank straight on the screen. A list is
 * responsible for its own empty state.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (k: string) => k, i18n: {language: 'en'}}),
}));

jest.mock('../../src/components/ui/DetailSheet', () => {
  const React_ = require('react');
  const {View} = require('react-native');
  const Mock = ({children}: any) => React_.createElement(View, null, children);
  return {
    __esModule: true,
    default: Mock,
    SHEET: {block: {}, heading: {}, meta: {}, text: {}},
  };
});

import AudioGuideSheet from '../../src/features/audioguide/AudioGuideSheet';
import type {AudioStop} from '../../src/utils/api/audio';

const stop = (key: string, title: string): AudioStop =>
  ({
    stop_key: key,
    title,
    sort_order: 10,
    zone: 'exterior_lawn',
    clip: {
      lang: 'en',
      persona: 'casual',
      audio_url: 'audio/x.mp3',
      duration_ms: 40000,
      transcript: 't',
      source_ids: ['s'],
      tier: 'CONFIRMED',
    },
  }) as unknown as AudioStop;

const render = (groups: any[]) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <AudioGuideSheet
        open
        onClose={() => {}}
        groups={groups}
        selectedKey={null}
        selected={null}
        onSelectStop={() => {}}
        restorationUri={null}
        images={[]}
        onOpenRestoration={() => {}}
        persona="casual"
        onSelectPersona={() => {}}
        autoAdvance
        onAutoAdvanceChange={() => {}}
      />,
    );
  });
  const texts: string[] = [];
  const walk = (n: any) => {
    if (n == null) return;
    if (typeof n === 'string') {
      texts.push(n);
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n.children) n.children.forEach(walk);
  };
  walk(tree.toJSON());
  return texts;
};

describe('AudioGuideSheet — the stop list owns its empty state', () => {
  it('says so when there are no groups at all', () => {
    const texts = render([]);
    expect(texts).toContain('audioGuide.allStops');
    expect(texts).toContain('audioGuide.noStops');
  });

  it('does not say it when there are stops', () => {
    const texts = render([
      {zone: 'exterior_lawn', stops: [stop('a', 'Envy of Heaven')]},
    ]);
    expect(texts).toContain('Envy of Heaven');
    expect(texts).not.toContain('audioGuide.noStops');
  });

  it('the heading is still there either way, so the section never vanishes', () => {
    expect(render([])).toContain('audioGuide.allStops');
    expect(
      render([{zone: null, stops: [stop('a', 'One')]}]),
    ).toContain('audioGuide.allStops');
  });
});
