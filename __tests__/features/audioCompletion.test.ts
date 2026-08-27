/**
 * useAudioCompletion — the guard that stops the journey freezing on the lawn.
 *
 * The reported bug: the welcome played, finished, and nothing happened. The
 * cause was that `<Video onEnd>` was the ONLY autonomous way out of "speaking",
 * and on Android there are shipped paths (audio focus denied at un-pause, focus
 * lost mid-playback, a dead URL) that stop the sound without ever emitting it.
 *
 * So the thing worth testing is not "does onEnd work" — it is that completion
 * still happens when onEnd never comes, that it happens EXACTLY once when
 * several signals race, and that it never happens by accident (while paused, or
 * after the screen has gone). Each test below is one of those.
 *
 * The hook imports only TYPES from react-native-video, so nothing here needs the
 * native module mocked — the four callbacks are driven by hand, which is exactly
 * how a phone that has stopped emitting them behaves.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {
  DURATION_GRACE_MS,
  STALL_TIMEOUT_MS,
  START_TIMEOUT_MS,
  useAudioCompletion,
  type AudioCompletionReason,
  type UseAudioCompletionOptions,
  type UseAudioCompletionResult,
} from '../../src/screens/Main/journey/useAudioCompletion';

// ── Harness ────────────────────────────────────────────────────────────────
// A component that renders nothing and just publishes the hook's return value,
// so the tests can read `state`/`reason` and call the handlers directly.
let latest: UseAudioCompletionResult | null = null;

const Harness: React.FC<UseAudioCompletionOptions> = props => {
  latest = useAudioCompletion(props);
  return null;
};

const hook = (): UseAudioCompletionResult => {
  if (!latest) throw new Error('harness not mounted');
  return latest;
};

function mount(props: UseAudioCompletionOptions) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(React.createElement(Harness, props));
  });
  return {
    update(next: UseAudioCompletionOptions) {
      ReactTestRenderer.act(() => {
        renderer.update(React.createElement(Harness, next));
      });
    },
    unmount() {
      ReactTestRenderer.act(() => {
        renderer.unmount();
      });
    },
  };
}

/** Advance the fake clock inside act() so timer-driven setState is flushed. */
const advance = (ms: number) =>
  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(ms);
  });

/** Fire one of the player's callbacks inside act(). */
const fire = (fn: () => void) =>
  ReactTestRenderer.act(() => {
    fn();
  });

const loadData = (duration: number) => ({ duration } as any);
const progressData = (currentTime: number, seekableDuration = 0) =>
  ({ currentTime, seekableDuration, playableDuration: currentTime } as any);

let completions: AudioCompletionReason[];
const onComplete = (reason: AudioCompletionReason) => {
  completions.push(reason);
};

beforeEach(() => {
  jest.useFakeTimers();
  completions = [];
  latest = null;
});
afterEach(() => {
  jest.useRealTimers();
});

// ── The happy path, unchanged ──────────────────────────────────────────────
describe('onEnd', () => {
  it('completes as "ended" and reports done', () => {
    mount({ paused: false, onComplete });
    expect(hook().state).toBe('playing');

    fire(() => hook().handlers.onEnd());

    expect(completions).toEqual(['ended']);
    expect(hook().state).toBe('done');
    expect(hook().reason).toBe('ended');
  });

  it('disarms the backstops, so nothing fires a second time later', () => {
    mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(10)));
    fire(() => hook().handlers.onEnd());

    expect(jest.getTimerCount()).toBe(0);
    advance(10 * 60 * 1000);
    expect(completions).toEqual(['ended']);
  });
});

// ── Backstop 1: the clip has had its whole length to play ──────────────────
describe('duration backstop', () => {
  it('completes as "duration" once the clip length plus grace has elapsed', () => {
    mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(10)));

    // Not a moment early: cutting the welcome short is the worse bug.
    advance(10_000 + DURATION_GRACE_MS - 1);
    expect(completions).toEqual([]);

    advance(1);
    expect(completions).toEqual(['duration']);
    expect(hook().state).toBe('done');
    expect(hook().reason).toBe('duration');
  });

  it('re-arms from the current position, so progress moves the deadline', () => {
    mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(10)));

    // Five seconds in, five seconds of audio left — not ten.
    advance(5_000);
    fire(() => hook().handlers.onProgress(progressData(5)));

    advance(5_000 + DURATION_GRACE_MS - 1);
    expect(completions).toEqual([]);
    advance(1);
    expect(completions).toEqual(['duration']);
  });

  it('takes the duration from onProgress when onLoad was missed', () => {
    mount({ paused: false, onComplete });
    // seekableDuration is player.getDuration() on Android.
    fire(() => hook().handlers.onProgress(progressData(0.25, 4)));

    advance(4_000 - 250 + DURATION_GRACE_MS - 1);
    expect(completions).toEqual([]);
    advance(1);
    expect(completions).toEqual(['duration']);
  });

  it('arms no duration timer for an unbounded source', () => {
    mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(0)));

    // Only the stall watchdog is running — a duration of 0 must never be read
    // as "already finished".
    expect(jest.getTimerCount()).toBe(1);
    expect(hook().progress.duration).toBe(0);
  });
});

// ── Backstop 2: the position stopped moving ────────────────────────────────
describe('stall watchdog', () => {
  it('completes as "stalled" when a playing clip goes quiet', () => {
    // A long clip, so only the stall watchdog can be what fires.
    mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(600)));
    fire(() => hook().handlers.onProgress(progressData(0.25)));

    advance(STALL_TIMEOUT_MS - 1);
    expect(completions).toEqual([]);
    advance(1);
    expect(completions).toEqual(['stalled']);
    expect(hook().state).toBe('done');
    expect(hook().reason).toBe('stalled');
  });

  it('is pushed back by every tick that actually moves', () => {
    mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(600)));

    for (let i = 1; i <= 10; i++) {
      advance(STALL_TIMEOUT_MS - 1_000);
      fire(() => hook().handlers.onProgress(progressData(i * 7)));
    }
    expect(completions).toEqual([]);
  });

  it('is NOT pushed back by a tick that repeats the same position', () => {
    mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(600)));
    fire(() => hook().handlers.onProgress(progressData(3)));

    advance(STALL_TIMEOUT_MS - 1_000);
    fire(() => hook().handlers.onProgress(progressData(3)));
    advance(1_000);

    expect(completions).toEqual(['stalled']);
  });

  it('waits the longer start timeout when playback never begins at all', () => {
    // Audio focus denied at un-pause: no onLoad, no onProgress, no onError, no
    // onEnd — the exact silence that froze the lawn.
    mount({ paused: false, onComplete });

    advance(STALL_TIMEOUT_MS + 1_000);
    expect(completions).toEqual([]);

    advance(START_TIMEOUT_MS - STALL_TIMEOUT_MS - 1_000 - 1);
    expect(completions).toEqual([]);
    advance(1);
    expect(completions).toEqual(['stalled']);
  });
});

// ── A dead URL must never strand the visitor ───────────────────────────────
describe('onError', () => {
  // The hook logs the payload under __DEV__; silence it so a passing run is
  // quiet, and assert it while we are here.
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('completes as "error" and reports failed, distinguishably', () => {
    mount({ paused: false, onComplete });
    fire(() => hook().handlers.onError());

    expect(completions).toEqual(['error']);
    expect(hook().state).toBe('failed');
    expect(hook().reason).toBe('error');
    expect(jest.getTimerCount()).toBe(0);
    expect(warn).toHaveBeenCalled();
  });

  it('completes even while paused — the file is broken either way', () => {
    mount({ paused: true, onComplete });
    fire(() => hook().handlers.onError());

    expect(completions).toEqual(['error']);
    expect(hook().state).toBe('failed');
  });
});

// ── Exactly once, whichever signals race ───────────────────────────────────
describe('single completion', () => {
  it('ignores a late onEnd after the duration backstop already fired', () => {
    mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(10)));
    advance(10_000 + DURATION_GRACE_MS);
    expect(completions).toEqual(['duration']);

    fire(() => hook().handlers.onEnd());
    fire(() => hook().handlers.onError());

    expect(completions).toEqual(['duration']);
    expect(hook().reason).toBe('duration');
  });

  it('ignores repeated onEnd', () => {
    mount({ paused: false, onComplete });
    fire(() => {
      hook().handlers.onEnd();
      hook().handlers.onEnd();
      hook().handlers.onEnd();
    });
    expect(completions).toEqual(['ended']);
  });

  it('keeps counting progress after completion without re-firing', () => {
    mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(10)));
    fire(() => hook().handlers.onEnd());
    fire(() => hook().handlers.onProgress(progressData(9.5)));

    expect(completions).toEqual(['ended']);
    expect(hook().progress.position).toBe(9.5);
  });
});

// ── Paused means paused ────────────────────────────────────────────────────
describe('paused', () => {
  it('arms nothing while paused, however long the visitor waits', () => {
    const h = mount({ paused: true, onComplete });
    fire(() => hook().handlers.onLoad(loadData(10)));

    expect(jest.getTimerCount()).toBe(0);
    advance(10 * 60 * 1000);
    expect(completions).toEqual([]);
    expect(hook().state).toBe('idle');

    h.update({ paused: false, onComplete });
    expect(hook().state).toBe('playing');
    advance(10_000 + DURATION_GRACE_MS);
    expect(completions).toEqual(['duration']);
  });

  it('disarms mid-playback when the caller pauses, and re-arms on resume', () => {
    const h = mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(10)));
    advance(3_000);

    h.update({ paused: true, onComplete });
    expect(jest.getTimerCount()).toBe(0);
    advance(10 * 60 * 1000);
    expect(completions).toEqual([]);

    h.update({ paused: false, onComplete });
    advance(10_000 + DURATION_GRACE_MS);
    expect(completions).toEqual(['duration']);
  });
});

// ── Replay ─────────────────────────────────────────────────────────────────
describe('reset', () => {
  it('re-arms for a second playback and keeps the known duration', () => {
    const h = mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(10)));
    fire(() => hook().handlers.onProgress(progressData(4)));
    fire(() => hook().handlers.onEnd());
    expect(completions).toEqual(['ended']);

    // "Hear it again": the caller pauses (voice leaves 'speaking'), resets, then
    // un-pauses in the same tap.
    h.update({ paused: true, onComplete });
    fire(() => hook().reset());

    expect(hook().state).toBe('idle');
    expect(hook().reason).toBeNull();
    expect(hook().progress).toEqual({ position: 0, duration: 10 });

    h.update({ paused: false, onComplete });
    expect(hook().state).toBe('playing');

    advance(10_000 + DURATION_GRACE_MS);
    expect(completions).toEqual(['ended', 'duration']);
  });

  it('arms immediately when reset while already un-paused', () => {
    mount({ paused: false, onComplete });
    fire(() => hook().handlers.onEnd());
    fire(() => hook().reset());

    expect(hook().state).toBe('playing');
    advance(START_TIMEOUT_MS);
    expect(completions).toEqual(['ended', 'stalled']);
  });
});

// ── Nothing outlives the screen ────────────────────────────────────────────
describe('unmount', () => {
  it('clears every timer so the journey cannot advance after the visitor left', () => {
    const h = mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(10)));
    expect(jest.getTimerCount()).toBe(2);

    h.unmount();

    expect(jest.getTimerCount()).toBe(0);
    advance(10 * 60 * 1000);
    expect(completions).toEqual([]);
  });
});

// ── The identity trap the freeze was hiding behind ─────────────────────────
describe('onComplete identity', () => {
  it('survives a fresh callback on every render without restarting the timers', () => {
    // PalaceJourneyScreen hands LawnStep a NEW inline arrow every render, and it
    // re-renders repeatedly during the welcome (prefetchMedia reports per file).
    // If that identity were a timer dependency the backstop would be restarted
    // on every tick and would never fire — which is the failure this hook exists
    // to prevent, so it is worth pinning.
    const seen: AudioCompletionReason[] = [];
    const h = mount({ paused: false, onComplete: r => seen.push(r) });
    fire(() => hook().handlers.onLoad(loadData(10)));

    for (let i = 0; i < 8; i++) {
      advance(1_000);
      h.update({ paused: false, onComplete: r => seen.push(r) });
    }
    expect(seen).toEqual([]);

    advance(2_000 + DURATION_GRACE_MS);
    expect(seen).toEqual(['duration']);
  });

  it('calls the LATEST callback, not the one captured when the timer was armed', () => {
    const first: AudioCompletionReason[] = [];
    const second: AudioCompletionReason[] = [];
    const h = mount({ paused: false, onComplete: r => first.push(r) });
    fire(() => hook().handlers.onLoad(loadData(10)));

    h.update({ paused: false, onComplete: r => second.push(r) });
    advance(10_000 + DURATION_GRACE_MS);

    expect(first).toEqual([]);
    expect(second).toEqual(['duration']);
  });
});

// ── What the caller can put on screen ──────────────────────────────────────
describe('progress', () => {
  it('reports position and duration in seconds', () => {
    mount({ paused: false, onComplete });
    expect(hook().progress).toEqual({ position: 0, duration: 0 });

    fire(() => hook().handlers.onLoad(loadData(42.5)));
    expect(hook().progress).toEqual({ position: 0, duration: 42.5 });

    fire(() => hook().handlers.onProgress(progressData(12.25)));
    expect(hook().progress).toEqual({ position: 12.25, duration: 42.5 });
  });

  it('ignores a non-finite position rather than poisoning the deadline', () => {
    mount({ paused: false, onComplete });
    fire(() => hook().handlers.onLoad(loadData(10)));
    fire(() => hook().handlers.onProgress(progressData(NaN)));

    expect(hook().progress.position).toBe(0);
    advance(10_000 + DURATION_GRACE_MS);
    expect(completions).toEqual(['duration']);
  });
});

// ── Callers may tune the numbers ───────────────────────────────────────────
describe('overrides', () => {
  it('honours custom grace and watchdog values', () => {
    mount({
      paused: false,
      onComplete,
      durationGraceMs: 100,
      stallTimeoutMs: 500,
      startTimeoutMs: 900,
    });

    advance(899);
    expect(completions).toEqual([]);
    advance(1);
    expect(completions).toEqual(['stalled']);
  });
});
