/**
 * The audio guide screen walking itself, at a desk.
 *
 * The redesign turned the screen from a catalogue into a single current stop,
 * and the thing that makes that work — or fail — is what happens when a clip
 * ends. Auto-advance is an OFFER with a gap in front of it: a visitor standing
 * in front of a carving must be able to refuse being walked on, and a visitor
 * with the phone in a pocket must not be left in silence.
 *
 * So this drives the real screen against a fake AudioPlayer and asserts on the
 * transitions the visitor actually experiences: which stop is showing, whether
 * the offer appears, and whether refusing it sticks.
 */
import React from 'react';
import ReactTestRenderer, {type ReactTestInstance} from 'react-test-renderer';

// ── The player, replaced by a recorder ──────────────────────────────────────
let mockPlayerProps: Record<string, any> | null = null;
let mockPlayerMounts = 0;

jest.mock('../../src/components/AudioPlayer', () => {
  const React_ = require('react');
  const Mock = (props: any) => {
    mockPlayerProps = props;
    React_.useEffect(() => {
      mockPlayerMounts += 1;
    }, []);
    return null;
  };
  return {__esModule: true, default: Mock};
});

jest.mock('../../src/context/NetworkContext', () => ({
  useNetwork: () => ({isOffline: false}),
}));

jest.mock('../../src/shared/hooks/useSafeGoBack', () => ({
  useSafeGoBack: () => jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars?.title ? `${key}:${String(vars.title)}` : key,
    i18n: {language: 'en'},
  }),
}));

const mockGetAudioStops = jest.fn();
jest.mock('../../src/utils/api/audio', () => ({
  getAudioStops: (...args: unknown[]) => mockGetAudioStops(...args),
  AUDIO_PERSONAS: ['casual', 'history_buff', 'child'],
}));

jest.mock('../../src/config/glbDelivery', () => ({
  buildAudioUrl: (key: string) => `https://cdn.test/${key}`,
}));

let mockAutoAdvance = true;
jest.mock('../../src/stores/museumPrefsStore', () => ({
  useMuseumPrefsStore: (selector: (s: any) => unknown) =>
    selector({
      narrationPersona: 'casual',
      setNarrationPersona: jest.fn(),
      autoAdvance: mockAutoAdvance,
      setAutoAdvance: jest.fn(),
    }),
  useNarrationLang: () => 'en',
}));

import AudioGuideScreen from '../../src/screens/Main/AudioGuideScreen';

const stop = (key: string, title: string, recorded = true) => ({
  stop_key: key,
  title,
  zone: 'upper_floor',
  sort_order: 10,
  ...(recorded
    ? {
        clip: {
          lang: 'en',
          persona: 'casual',
          audio_url: `audio/${key}.mp3`,
          duration_ms: 60000,
          transcript: `transcript for ${title}`,
          source_ids: [],
          tier: 'CONFIRMED',
        },
      }
    : {}),
});

const STOPS = [
  stop('one', 'First stop'),
  stop('two', 'Second stop'),
  stop('three', 'Third stop'),
];

/** Every string rendered anywhere in the tree. */
const textsIn = (root: ReactTestInstance): string[] =>
  root
    // String() rather than `=== 'Text'`: the host-component union in
    // react-test-renderer's types does not include RN's own host names, so a
    // direct comparison is a type error even though it is what runs.
    .findAll(n => String(n.type) === 'Text', {deep: true})
    .flatMap(n =>
      n.children.filter((c): c is string => typeof c === 'string'),
    );

const render = async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <AudioGuideScreen
        navigation={{navigate: jest.fn()} as any}
        route={
          {
            params: {
              venueSlug: 'tipu-summer-palace-bengaluru',
              siteName: 'Palace',
            },
          } as any
        }
      />,
    );
  });
  return tree;
};

beforeEach(() => {
  jest.useFakeTimers();
  mockPlayerProps = null;
  mockPlayerMounts = 0;
  mockAutoAdvance = true;
  mockGetAudioStops.mockResolvedValue({
    success: true,
    data: {monument_id: 'm', lang: 'en', persona: 'casual', stops: STOPS},
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AudioGuideScreen — it opens on a stop, not on a list', () => {
  it('selects and plays the first recorded stop with no tap', async () => {
    const tree = await render();
    expect(mockPlayerProps?.sourceKey).toBe('one');
    expect(mockPlayerProps?.autoPlay).toBe(true);
    expect(textsIn(tree.root)).toContain('First stop');
  });

  it('mounts ONE player and keeps it across a stop change', async () => {
    await render();
    const before = mockPlayerMounts;
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
      jest.advanceTimersByTime(6000);
    });
    expect(mockPlayerProps?.sourceKey).toBe('two');
    // A remount would restart a 105 s clip every time the sheet is opened.
    expect(mockPlayerMounts).toBe(before);
  });
});

describe('AudioGuideScreen — the hand-over is an offer', () => {
  it('waits before moving on rather than cutting straight to the next stop', async () => {
    const tree = await render();
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
    });
    // Still on stop one, and saying so.
    expect(mockPlayerProps?.sourceKey).toBe('one');
    expect(textsIn(tree.root)).toContain('audioGuide.movingOn:Second stop');

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(mockPlayerProps?.sourceKey).toBe('two');
  });

  it('stays put for good when the visitor refuses', async () => {
    const tree = await render();
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
    });
    const stay = tree.root.find(
      n =>
        n.props?.accessibilityRole === 'button' &&
        textsIn(n).includes('audioGuide.stayHere'),
    );
    await ReactTestRenderer.act(async () => {
      stay.props.onPress();
      jest.advanceTimersByTime(60000);
    });
    expect(mockPlayerProps?.sourceKey).toBe('one');
    expect(textsIn(tree.root)).not.toContain('audioGuide.movingOn:Second stop');
  });

  it('does nothing at all when auto-advance is switched off', async () => {
    mockAutoAdvance = false;
    const tree = await render();
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
      jest.advanceTimersByTime(60000);
    });
    expect(mockPlayerProps?.sourceKey).toBe('one');
    expect(textsIn(tree.root)).not.toContain('audioGuide.movingOn:Second stop');
  });

  it('offers the next stop when the file will not play, rather than stranding', async () => {
    // A clip that never starts can never end, so onEnd is not coming.
    const tree = await render();
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onError?.({} as any);
    });
    expect(textsIn(tree.root)).toContain('audioGuide.movingOn:Second stop');
  });

  it('holds on the last stop instead of offering a stop that is not there', async () => {
    const tree = await render();
    for (let i = 0; i < 2; i++) {
      await ReactTestRenderer.act(async () => {
        mockPlayerProps?.onEnd?.();
        jest.advanceTimersByTime(6000);
      });
    }
    expect(mockPlayerProps?.sourceKey).toBe('three');
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
      jest.advanceTimersByTime(60000);
    });
    expect(mockPlayerProps?.sourceKey).toBe('three');
    expect(textsIn(tree.root).some(s => s.startsWith('audioGuide.movingOn'))).toBe(
      false,
    );
  });
});

describe('AudioGuideScreen — unrecorded stops', () => {
  it('never lands the visitor on a stop with nothing to play', async () => {
    mockGetAudioStops.mockResolvedValue({
      success: true,
      data: {
        monument_id: 'm',
        lang: 'en',
        persona: 'casual',
        stops: [
          stop('one', 'First stop'),
          stop('gap', 'Never recorded', false),
          stop('three', 'Third stop'),
        ],
      },
    });
    await render();
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
      jest.advanceTimersByTime(6000);
    });
    expect(mockPlayerProps?.sourceKey).toBe('three');
  });
});
