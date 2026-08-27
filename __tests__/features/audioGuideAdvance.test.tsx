/**
 * DRY RUN — the audio guide walking itself, at a desk.
 *
 * The lawn froze in front of the product owner because the step's only exit was
 * a media callback that never came, and the only control on screen was one
 * nobody would press. AudioGuideStep had the identical shape one screen later:
 * every stop started paused, and every hand-over was a "Next stop" tap.
 *
 * So this drives the real step against a fake AudioPlayer and asserts on the
 * TRANSITIONS — which stop is showing, what journeyStore is told to remember,
 * and whether the journey is handed on at the end — because those are the things
 * the visitor experiences as "it moved" or "it froze". It deliberately never
 * calls the fake player's onEnd in three of the five cases: a phone where onEnd
 * never arrives is precisely the failure being fixed.
 */
import React from 'react';
import ReactTestRenderer, {type ReactTestInstance} from 'react-test-renderer';

// ── The player, replaced by a recorder ──────────────────────────────────────
/** Latest props the step handed the player — its callbacks live here. */
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

// ── Everything else the step leans on, stubbed to a known state ─────────────
jest.mock('../../src/services/mediaCache', () => ({
  buildAudioUrl: (key: string | null | undefined) =>
    key ? `https://cdn.test/${key}` : null,
  // Never cached, so the step falls through to the remote URL — the same path a
  // visitor whose pre-cache failed takes.
  getCachedMediaUri: jest.fn(() => Promise.resolve(null)),
}));

const mockTrack = jest.fn();
jest.mock('../../src/services/analytics', () => ({
  analytics: {track: (...a: unknown[]) => mockTrack(...a)},
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

jest.mock('react-native-safe-area-context', () => {
  const React_ = require('react');
  return {
    SafeAreaView: ({children}: any) => React_.createElement('SafeAreaView', null, children),
  };
});

jest.mock('lucide-react-native', () => ({
  Camera: 'Camera',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Pause: 'Pause',
  SkipBack: 'SkipBack',
  X: 'X',
}));

jest.mock('../../src/components/ui', () => ({
  Skeleton: () => null,
}));

import AudioGuideStep from '../../src/screens/Main/journey/AudioGuideStep';
import type {AudioStopsResponse} from '../../src/utils/api/audio';

/** Longer than ADVANCE_BEAT_MS (4000) — the beat plus a margin. */
const PAST_THE_BEAT_MS = 5000;

const clip = (file: string) =>
  ({lang: 'en', audio_url: file, transcript: null, tier: 'CONFIRMED'}) as any;

function stopsFixture(overrides?: {secondHasAudio?: boolean}): AudioStopsResponse {
  const secondHasAudio = overrides?.secondHasAudio ?? true;
  return {
    lang: 'en',
    persona: 'casual',
    fallback_lang: null,
    stops: [
      {
        stop_key: 'stop-one',
        title: 'The lawn',
        zone: 'exterior_lawn',
        order_index: 1,
        clip: clip('one.mp3'),
      },
      {
        stop_key: 'stop-two',
        title: 'The colonnade',
        zone: 'ground_colonnade',
        order_index: 2,
        clip: secondHasAudio ? clip('two.mp3') : null,
      },
    ],
  } as unknown as AudioStopsResponse;
}

/**
 * Three stops, so "in the middle of the walk" and "the last stop" are different
 * places — the two-stop fixture cannot tell them apart, and every refusal below
 * turns on exactly that difference. `silent` names the stops with no recording.
 */
function threeStopsFixture(silent: string[] = []): AudioStopsResponse {
  const keys = ['stop-one', 'stop-two', 'stop-three'];
  return {
    lang: 'en',
    persona: 'casual',
    fallback_lang: null,
    stops: keys.map((stop_key, i) => ({
      stop_key,
      title: `Stop ${i + 1}`,
      zone: 'ground_colonnade',
      order_index: i + 1,
      clip: silent.includes(stop_key) ? null : clip(`${stop_key}.mp3`),
    })),
  } as unknown as AudioStopsResponse;
}

interface Harness {
  tree: ReactTestRenderer.ReactTestRenderer;
  onStopChange: jest.Mock;
  onContinue: jest.Mock;
}

/**
 * Find a control by the accessibility label JourneyUi gives every button. The
 * Pressable inside PrimaryButton/GhostButton is the element carrying BOTH the
 * label and onPress; the host View it renders carries only the label.
 */
function button(tree: ReactTestRenderer.ReactTestRenderer, label: string): ReactTestInstance {
  const found = tree.root.findAll(
    n => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function',
  );
  if (found.length === 0) throw new Error(`no pressable labelled ${label}`);
  return found[0];
}

/** Unmount inside act(), or React warns about the state updates it triggers. */
function unmount(tree: ReactTestRenderer.ReactTestRenderer): void {
  ReactTestRenderer.act(() => {
    tree.unmount();
  });
}

function hasText(tree: ReactTestRenderer.ReactTestRenderer, text: string): boolean {
  return tree.root.findAll(n => n.children.includes(text)).length > 0;
}

async function mount(
  stops: AudioStopsResponse,
  initialStopKey: string | null = null,
): Promise<Harness> {
  const onStopChange = jest.fn();
  const onContinue = jest.fn();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <AudioGuideStep
        status="ready"
        stops={stops}
        onRetry={jest.fn()}
        initialStopKey={initialStopKey}
        onStopChange={onStopChange}
        onContinue={onContinue}
      />,
    );
  });
  return {tree, onStopChange, onContinue};
}

/** One progress tick, so the watchdog knows playback actually started. */
async function tick(seconds: number, duration: number): Promise<void> {
  await ReactTestRenderer.act(async () => {
    mockPlayerProps?.onProgress?.({
      currentTime: seconds,
      playableDuration: duration,
      seekableDuration: duration,
    });
  });
}

async function runTimers(ms: number): Promise<void> {
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockPlayerProps = null;
  mockPlayerMounts = 0;
  mockTrack.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AudioGuideStep — each stop plays itself', () => {
  it('autoplays the first stop instead of waiting for a tap', async () => {
    const {tree, onStopChange} = await mount(stopsFixture());
    expect(mockPlayerProps?.autoPlay).toBe(true);
    expect(mockPlayerProps?.uri).toBe('https://cdn.test/one.mp3');
    // The resume key is written the moment the stop is showing, not on exit.
    expect(onStopChange).toHaveBeenCalledWith('stop-one');
    unmount(tree);
  });

  it('hands the four <Video> callbacks to the player so a lost onEnd is survivable', async () => {
    const {tree} = await mount(stopsFixture());
    expect(typeof mockPlayerProps?.onLoad).toBe('function');
    expect(typeof mockPlayerProps?.onProgress).toBe('function');
    expect(typeof mockPlayerProps?.onEnd).toBe('function');
    expect(typeof mockPlayerProps?.onError).toBe('function');
    expect(typeof mockPlayerProps?.onPausedChange).toBe('function');
    unmount(tree);
  });
});

describe('AudioGuideStep — the hand-over', () => {
  it('walks on to the next stop after the beat when the audio ends', async () => {
    const {tree, onStopChange} = await mount(stopsFixture());
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
    });

    // The beat is a beat: nothing has moved yet, and the visitor is told why.
    expect(onStopChange).toHaveBeenCalledTimes(1);
    expect(hasText(tree, 'journey.guide.autoNext')).toBe(true);

    await runTimers(PAST_THE_BEAT_MS);
    expect(onStopChange).toHaveBeenLastCalledWith('stop-two');
    expect(mockPlayerProps?.uri).toBe('https://cdn.test/two.mp3');
    // Remounted, not reused — the watchdog must not inherit stop one's duration.
    expect(mockPlayerMounts).toBe(2);
    unmount(tree);
  });

  it('walks on when onEnd NEVER fires and only the watchdog notices', async () => {
    const {tree, onStopChange} = await mount(stopsFixture());
    // One tick proves playback started, then the player goes silent for good —
    // audio focus denied or lost, the failure the owner hit on the lawn.
    await tick(1, 30);
    await runTimers(9000); // past STALL_TIMEOUT_MS (8000)
    await runTimers(PAST_THE_BEAT_MS);

    expect(onStopChange).toHaveBeenLastCalledWith('stop-two');
    expect(mockTrack).toHaveBeenCalledWith('journey_stop_finished', {
      stop: 'stop-one',
      reason: 'stalled',
    });
    unmount(tree);
  });

  it('walks on when the file is broken rather than stranding the visitor', async () => {
    // useAudioCompletion logs the failure under __DEV__; expected, not leaked.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const {tree, onStopChange} = await mount(stopsFixture());
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onError?.({error: {errorString: 'boom'}});
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(hasText(tree, 'journey.guide.audioFailed')).toBe(true);

    await runTimers(PAST_THE_BEAT_MS);
    expect(onStopChange).toHaveBeenLastCalledWith('stop-two');
    unmount(tree);
  });

  it('walks on past a stop in the middle of the walk that was never recorded', async () => {
    // Stop two has no clip at all: a gap in the narration, not a stop sign.
    const {tree, onStopChange} = await mount(threeStopsFixture(['stop-two']));
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
    });
    await runTimers(PAST_THE_BEAT_MS); // stop one -> the silent stop two
    expect(onStopChange).toHaveBeenLastCalledWith('stop-two');
    expect(hasText(tree, 'journey.guide.notRecorded')).toBe(true);

    await runTimers(PAST_THE_BEAT_MS); // and straight over it to stop three
    expect(onStopChange).toHaveBeenLastCalledWith('stop-three');
    unmount(tree);
  });

  it('completes the step when the LAST stop finishes', async () => {
    const {tree, onContinue} = await mount(stopsFixture());
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
    });
    await runTimers(PAST_THE_BEAT_MS); // stop one -> stop two
    expect(onContinue).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
    });
    expect(hasText(tree, 'journey.guide.autoFinish')).toBe(true);
    await runTimers(PAST_THE_BEAT_MS);
    expect(onContinue).toHaveBeenCalledTimes(1);
    unmount(tree);
  });
});

/**
 * The three refusals. Leading a visitor is only leading while they are hearing
 * something; each case below is a shape where the same four-second beat, applied
 * to a stop that played NOTHING, stopped serving the visitor and started herding
 * them — one of them into a loop they could not get out of.
 */
describe('AudioGuideStep — it refuses to lead from a stop that played nothing', () => {
  it('holds on an unrecorded LAST stop instead of ejecting the visitor to the next step', async () => {
    // How a visitor gets here: they finished the guide, landed on 'explore', and
    // pressed back. PalaceJourneyScreen re-enters the guide at lastStopKey —
    // which is the last stop, because that is where the guide ended. Handing the
    // journey on again four seconds later would put them straight back on
    // 'explore', every single time, so the guide could never be re-entered.
    const {tree, onContinue} = await mount(
      threeStopsFixture(['stop-three']),
      'stop-three',
    );
    expect(hasText(tree, 'journey.guide.notRecorded')).toBe(true);

    await runTimers(PAST_THE_BEAT_MS * 3);
    expect(onContinue).not.toHaveBeenCalled();
    // Nothing is counting down, so nothing promises to move.
    expect(hasText(tree, 'journey.guide.autoFinish')).toBe(false);
    // And the way on is still one tap, where it always was.
    await ReactTestRenderer.act(async () => {
      button(tree, 'journey.guide.toExplore').props.onPress();
    });
    expect(onContinue).toHaveBeenCalledTimes(1);
    unmount(tree);
  });

  it('holds on a LAST stop whose audio failed, rather than completing the step', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const {tree, onContinue} = await mount(threeStopsFixture(), 'stop-three');
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onError?.({error: {errorString: 'boom'}});
    });
    warn.mockRestore();

    await runTimers(PAST_THE_BEAT_MS * 3);
    expect(onContinue).not.toHaveBeenCalled();
    // Told plainly, and offered the retry that a remount is the only route to:
    // an ExoPlayer that has reported a source error will not play again on a
    // bare un-pause, so the player's own Play button is dead after a failure.
    expect(hasText(tree, 'journey.guide.audioFailedStopped')).toBe(true);
    expect(hasText(tree, 'journey.guide.audioFailed')).toBe(false);
    const mounts = mockPlayerMounts;
    await ReactTestRenderer.act(async () => {
      button(tree, 'common.tryAgain').props.onPress();
    });
    expect(mockPlayerMounts).toBe(mounts + 1);
    unmount(tree);
  });

  it('stops after ONE failure rather than burning the whole guide on a dead connection', async () => {
    // Signal drops as the visitor walks into the courtyard: every uncached stop
    // errors the moment it is handed to the player. Chaining on that consumed
    // every remaining stop at four seconds each and dumped them out of the guide
    // entirely, with all of it marked as heard.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const {tree, onStopChange, onContinue} = await mount(threeStopsFixture());
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onError?.({error: {errorString: 'boom'}});
    });
    await runTimers(PAST_THE_BEAT_MS); // one stop skipped: a gap, not a stampede
    expect(onStopChange).toHaveBeenLastCalledWith('stop-two');

    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onError?.({error: {errorString: 'boom'}});
    });
    await runTimers(PAST_THE_BEAT_MS * 3);
    warn.mockRestore();

    expect(onStopChange).toHaveBeenLastCalledWith('stop-two');
    expect(onContinue).not.toHaveBeenCalled();
    expect(hasText(tree, 'journey.guide.audioFailedStopped')).toBe(true);
    unmount(tree);
  });

  it('lets a manual Next clear the streak, so one dead file does not disable the guide', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const {tree, onStopChange} = await mount(threeStopsFixture());
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onError?.({error: {errorString: 'boom'}});
    });
    await runTimers(PAST_THE_BEAT_MS); // -> stop two, after the first failure
    await ReactTestRenderer.act(async () => {
      button(tree, 'journey.guide.next').props.onPress(); // -> stop three, by hand
    });
    warn.mockRestore();
    expect(onStopChange).toHaveBeenLastCalledWith('stop-three');

    // Stop three plays normally: the beat is armed again, not suppressed by the
    // failure two stops ago.
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
    });
    expect(hasText(tree, 'journey.guide.autoFinish')).toBe(true);
    unmount(tree);
  });

  it('stays put when "Previous" lands on a stop that was never recorded', async () => {
    // The visitor is on stop three and wants to re-read stop two's card. Walking
    // them forward again four seconds later undoes their own tap — and makes
    // everything behind a silent stop unreachable by the only control for it.
    const {tree, onStopChange} = await mount(threeStopsFixture(['stop-two']));
    await ReactTestRenderer.act(async () => {
      button(tree, 'journey.guide.next').props.onPress(); // -> the silent stop two
    });
    // eslint-disable-next-line no-console
    await ReactTestRenderer.act(async () => {
      button(tree, 'journey.guide.next').props.onPress(); // -> stop three
    });
    // eslint-disable-next-line no-console
    expect(onStopChange).toHaveBeenLastCalledWith('stop-three');

    await ReactTestRenderer.act(async () => {
      button(tree, 'journey.guide.previous').props.onPress(); // back to stop two
    });
    expect(onStopChange).toHaveBeenLastCalledWith('stop-two');

    await runTimers(PAST_THE_BEAT_MS * 3);
    expect(onStopChange).toHaveBeenLastCalledWith('stop-two');
    expect(hasText(tree, 'journey.guide.notRecorded')).toBe(true);
    unmount(tree);
  });
});

describe('AudioGuideStep — the visitor keeps the wheel', () => {
  it('"Stay on this stop" cancels a hand-over that is counting down', async () => {
    const {tree, onStopChange} = await mount(stopsFixture());
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
    });
    await ReactTestRenderer.act(async () => {
      button(tree, 'journey.guide.stay').props.onPress();
    });

    await runTimers(PAST_THE_BEAT_MS * 4);
    expect(onStopChange).toHaveBeenCalledTimes(1);
    expect(onStopChange).toHaveBeenLastCalledWith('stop-one');
    // And it stays cancelled — no second beat arms itself behind the visitor.
    expect(hasText(tree, 'journey.guide.autoNext')).toBe(false);
    unmount(tree);
  });

  it('a paused player is not a stalled one — the guide waits', async () => {
    const {tree, onStopChange} = await mount(stopsFixture());
    await tick(1, 30);
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onPausedChange?.(true);
    });

    // Long past every watchdog. A visitor looking at a carving is not a fault.
    await runTimers(60000);
    expect(onStopChange).toHaveBeenCalledTimes(1);
    expect(onStopChange).toHaveBeenLastCalledWith('stop-one');
    unmount(tree);
  });

  it('manual Next still works and cancels any pending hand-over', async () => {
    const {tree, onStopChange} = await mount(stopsFixture());
    await ReactTestRenderer.act(async () => {
      button(tree, 'journey.guide.next').props.onPress();
    });
    expect(onStopChange).toHaveBeenLastCalledWith('stop-two');

    await ReactTestRenderer.act(async () => {
      button(tree, 'journey.guide.previous').props.onPress();
    });
    expect(onStopChange).toHaveBeenLastCalledWith('stop-one');
    unmount(tree);
  });

  it('nothing advances after the visitor has left the screen', async () => {
    const {tree, onStopChange, onContinue} = await mount(stopsFixture());
    await ReactTestRenderer.act(async () => {
      mockPlayerProps?.onEnd?.();
    });
    unmount(tree);

    await runTimers(PAST_THE_BEAT_MS);
    expect(onStopChange).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });
});
