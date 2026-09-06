/**
 * A locked stop must not read as a broken one.
 *
 * The server strips a locked stop's clip before responding (apis/audio/handler.go),
 * so a locked stop and a never-recorded stop arrive looking IDENTICAL to this
 * list — both have no `clip`. The row's meta used to be a two-state ternary on
 * that alone, which meant the moment migration 100 shipped, five stops we are
 * selling would have told the visitor "Not recorded yet".
 *
 * That is worse than a wrong label. It says the palace never recorded the rest
 * of its own guide, which would make the purchase look like a charge for
 * something that does not exist.
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

/** A free stop: clip present, exactly as the server sends one. */
const free = (key: string, title: string): AudioStop =>
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

/**
 * A locked stop, shaped the way the wire actually delivers one: `locked: true`
 * and NO clip. Writing it with a clip would test a payload the server refuses
 * to send and would hide the very collision this file exists for.
 */
const locked = (key: string, title: string): AudioStop =>
  ({
    stop_key: key,
    title,
    sort_order: 25,
    zone: 'upper_floor',
    locked: true,
  }) as unknown as AudioStop;

/** A stop that is genuinely unrecorded: no clip, and NOT locked. */
const silent = (key: string, title: string): AudioStop =>
  ({
    stop_key: key,
    title,
    sort_order: 40,
    zone: 'end_block',
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

describe('AudioGuideSheet — locked is not the same as unrecorded', () => {
  it('labels a locked stop locked, never "not recorded"', () => {
    const texts = render([
      {zone: 'upper_floor', stops: [locked('the_stair', 'The stair, and the gap')]},
    ]);
    expect(texts).toContain('audioGuide.locked');
    expect(texts).not.toContain('audioGuide.notRecorded');
  });

  it('still says "not recorded" for a stop that really has no clip', () => {
    const texts = render([
      {zone: 'end_block', stops: [silent('what_the_board_says', 'What the board says')]},
    ]);
    expect(texts).toContain('audioGuide.notRecorded');
    expect(texts).not.toContain('audioGuide.locked');
  });

  it('keeps a locked stop VISIBLE, so the visitor sees what they would be buying', () => {
    const texts = render([
      {zone: 'upper_floor', stops: [locked('the_lost_colour', 'The colour that is gone')]},
    ]);
    expect(texts).toContain('The colour that is gone');
  });

  it('shows the free and the locked half of one guide together', () => {
    const texts = render([
      {zone: 'exterior_lawn', stops: [free('palace_overview', 'Envy of Heaven')]},
      {zone: 'upper_floor', stops: [locked('the_stair', 'The stair, and the gap')]},
    ]);
    expect(texts).toContain('Envy of Heaven');
    expect(texts).toContain('The stair, and the gap');
    expect(texts).toContain('audioGuide.locked');
    expect(texts).not.toContain('audioGuide.notRecorded');
  });
});
