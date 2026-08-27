/**
 * journeyStore — per-venue progress: advance/complete/reset semantics, index
 * clamping, slug isolation, and the AsyncStorage persist round trip.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../src/core/constants/storage-keys';
import {
  EMPTY_JOURNEY_PROGRESS,
  JOURNEY_STEPS,
  JOURNEY_STEP_COUNT,
  currentStepId,
  isJourneyComplete,
  progressFor,
  selectJourneyProgress,
  useJourneyStore,
} from '../../src/stores/journeyStore';

const SLUG = 'tipu-summer-palace-bengaluru';
const OTHER = 'konark-sun-temple';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(async () => {
  useJourneyStore.setState({ progress: {} });
  await AsyncStorage.clear();
});

describe('reading progress', () => {
  it('returns the shared EMPTY record for an unknown venue (stable reference)', () => {
    const state = useJourneyStore.getState();
    expect(progressFor(state, SLUG)).toBe(EMPTY_JOURNEY_PROGRESS);
    expect(selectJourneyProgress(SLUG)(state)).toBe(EMPTY_JOURNEY_PROGRESS);
    expect(currentStepId(EMPTY_JOURNEY_PROGRESS)).toBe('arrival');
    expect(isJourneyComplete(EMPTY_JOURNEY_PROGRESS)).toBe(false);
  });
});

describe('advance / completeStep', () => {
  it('completes the current step and moves to the next', () => {
    useJourneyStore.getState().advance(SLUG);
    const p = progressFor(useJourneyStore.getState(), SLUG);
    expect(p.stepIndex).toBe(1);
    expect(p.completedSteps).toEqual(['arrival']);
    expect(p.updatedAt).toBeGreaterThan(0);
    expect(currentStepId(p)).toBe('prepare');
  });

  it('never duplicates a completed step', () => {
    const { completeStep } = useJourneyStore.getState();
    completeStep(SLUG, 'arrival');
    completeStep(SLUG, 'arrival');
    expect(progressFor(useJourneyStore.getState(), SLUG).completedSteps).toEqual([
      'arrival',
    ]);
  });

  it('completing the last step keeps stepIndex in range and marks the journey complete', () => {
    const store = useJourneyStore.getState();
    for (let i = 0; i < JOURNEY_STEP_COUNT; i++) store.advance(SLUG);
    const p = progressFor(useJourneyStore.getState(), SLUG);
    expect(p.stepIndex).toBe(JOURNEY_STEP_COUNT - 1);
    expect(p.completedSteps).toEqual([...JOURNEY_STEPS]);
    expect(isJourneyComplete(p)).toBe(true);
    // A further advance is a no-op on shape: still in range, still complete.
    useJourneyStore.getState().advance(SLUG);
    expect(progressFor(useJourneyStore.getState(), SLUG).stepIndex).toBe(
      JOURNEY_STEP_COUNT - 1,
    );
  });

  it('isolates venues from each other', () => {
    useJourneyStore.getState().advance(SLUG);
    useJourneyStore.getState().advance(SLUG);
    expect(progressFor(useJourneyStore.getState(), OTHER)).toBe(EMPTY_JOURNEY_PROGRESS);
    useJourneyStore.getState().reset(SLUG);
    expect(progressFor(useJourneyStore.getState(), SLUG)).toBe(EMPTY_JOURNEY_PROGRESS);
  });

  it('ignores an empty slug', () => {
    useJourneyStore.getState().advance('');
    expect(useJourneyStore.getState().progress).toEqual({});
  });
});

describe('goToStep', () => {
  it('clamps out-of-range and non-integer indexes', () => {
    const { goToStep } = useJourneyStore.getState();
    goToStep(SLUG, 99);
    expect(progressFor(useJourneyStore.getState(), SLUG).stepIndex).toBe(
      JOURNEY_STEP_COUNT - 1,
    );
    goToStep(SLUG, -3);
    expect(progressFor(useJourneyStore.getState(), SLUG).stepIndex).toBe(0);
    goToStep(SLUG, 2.9);
    expect(progressFor(useJourneyStore.getState(), SLUG).stepIndex).toBe(2);
    goToStep(SLUG, Number.NaN);
    expect(progressFor(useJourneyStore.getState(), SLUG).stepIndex).toBe(0);
  });
});

describe('setLastStopKey / reset', () => {
  it('records the stop for resume and reset forgets only that venue', () => {
    useJourneyStore.getState().setLastStopKey(SLUG, 'the_pillars');
    useJourneyStore.getState().setLastStopKey(OTHER, 'gateway');
    expect(progressFor(useJourneyStore.getState(), SLUG).lastStopKey).toBe('the_pillars');

    useJourneyStore.getState().reset(SLUG);
    expect(progressFor(useJourneyStore.getState(), SLUG)).toBe(EMPTY_JOURNEY_PROGRESS);
    expect(progressFor(useJourneyStore.getState(), OTHER).lastStopKey).toBe('gateway');
  });

  it('treats a blank stop key as null', () => {
    useJourneyStore.getState().setLastStopKey(SLUG, '');
    expect(progressFor(useJourneyStore.getState(), SLUG).lastStopKey).toBeNull();
  });
});

describe('persistence', () => {
  it('writes progress under STORAGE_KEYS.JOURNEY.PROGRESS', async () => {
    useJourneyStore.getState().advance(SLUG);
    useJourneyStore.getState().setLastStopKey(SLUG, 'palace_overview');
    await flush();

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.JOURNEY.PROGRESS);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      state: { progress: Record<string, { stepIndex: number; lastStopKey: string }> };
      version: number;
    };
    expect(parsed.version).toBe(1);
    expect(parsed.state.progress[SLUG].stepIndex).toBe(1);
    expect(parsed.state.progress[SLUG].lastStopKey).toBe('palace_overview');
    // Actions are never persisted.
    expect(Object.keys(parsed.state)).toEqual(['progress']);
  });
});
