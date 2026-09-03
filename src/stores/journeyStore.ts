/**
 * journeyStore — progress through the guided on-site journey, per venue.
 *
 * Persisted to AsyncStorage (STORAGE_KEYS.JOURNEY.PROGRESS) so a visitor who
 * backs out — a phone call, the safety notice, a flat battery — resumes at the
 * step and, inside the audio guide, the stop they left. Keyed by venue slug
 * because one account can walk more than one site; progress at one must never
 * bleed into another.
 *
 * Holds progress ONLY. Transient AR state (tracking, anchors, what is playing)
 * belongs to the screen; media bytes belong to src/services/mediaCache.ts.
 *
 * Hydration from AsyncStorage is async: a screen deciding whether to OFFER a
 * resume must wait for `useJourneyStore.persist.hasHydrated()` (or
 * `persist.onFinishHydration`) or it will read an empty record on cold start.
 */

import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from '../core/constants/storage-keys';

/**
 * The steps of the vertical slice, in walking order:
 *   arrival — on the lawn: the figure appears, faces the visitor, speaks the welcome
 *   prepare — move forward, earphones in, the once-only disclaimer
 *   guide   — zone-grouped audio stops in sort_order
 *   explore — point-and-learn: capture → recognize → world-anchored card
 */
/**
 * The journey, in order.
 *
 * 'explore' (point-and-recognise) WAS the fourth step and was removed on
 * 2026-09-03. Phase 2 measured retrieval grounding wrongly 7 times out of 7
 * where the margin admits, on a corpus whose objects sit 0.865 apart, and
 * established the shortfall is representational rather than a matter of data
 * volume. That is not a thing to put in front of a visitor.
 *
 * PointLearnStep IS NOT DELETED. It remains the surface the object-recognition
 * work is built on and is reachable outside the journey; only its place in this
 * sequence is gone. Shrinking this array has three consequences that are handled
 * rather than discovered:
 *
 *   - `completeStep('explore')` would compute clampStep(-1 + 1) = 0 and silently
 *     reset a finishing visitor to 'arrival'. The caller now completes 'guide'.
 *   - 'guide' becomes TERMINAL, so AudioGuideStep calls onFinish rather than
 *     onContinue; its old comment assumed completing 'guide' would unmount it,
 *     which was only true while a fourth step existed to advance into.
 *   - A persisted stepIndex of 3 rehydrates verbatim, because zustand only runs
 *     `migrate` when the stored version differs. Hence version 2 below.
 */
export const JOURNEY_STEPS = ['arrival', 'prepare', 'guide'] as const;
export type JourneyStepId = (typeof JOURNEY_STEPS)[number];
export const JOURNEY_STEP_COUNT = JOURNEY_STEPS.length;

export interface JourneyProgress {
  /** Index into JOURNEY_STEPS of the step the visitor is on. Always in range. */
  stepIndex: number;
  /** Steps finished so far, in the order they were finished (no duplicates). */
  completedSteps: JourneyStepId[];
  /** Last audio stop reached in the guide step, so the guide resumes there. */
  lastStopKey: string | null;
  /** Epoch ms of the last write; 0 for a venue never started. */
  updatedAt: number;
}

/**
 * Progress for a venue that has never been started. Frozen and shared so a
 * selector can return it for an unknown slug without minting a new object per
 * render (zustand compares selector results with Object.is).
 */
export const EMPTY_JOURNEY_PROGRESS: JourneyProgress = Object.freeze({
  stepIndex: 0,
  completedSteps: [],
  lastStopKey: null,
  updatedAt: 0,
}) as JourneyProgress;

export interface JourneyState {
  /** venue slug → progress. Absent = never started. */
  progress: Record<string, JourneyProgress>;
}

export interface JourneyActions {
  /** Jump to a step (clamped to the valid range). Does not touch completion. */
  goToStep: (slug: string, stepIndex: number) => void;
  /**
   * Mark a step finished and move to the one after it. Completing the last
   * step keeps stepIndex there — `isJourneyComplete` is then true and the
   * screen can offer "start over" via `reset`.
   */
  completeStep: (slug: string, step: JourneyStepId) => void;
  /** Convenience: complete whichever step the visitor is currently on. */
  advance: (slug: string) => void;
  setLastStopKey: (slug: string, stopKey: string | null) => void;
  /** Forget everything for one venue. Other venues are untouched. */
  reset: (slug: string) => void;
}

function clampStep(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(JOURNEY_STEP_COUNT - 1, Math.max(0, Math.trunc(index)));
}

function isStepId(v: unknown): v is JourneyStepId {
  return typeof v === 'string' && (JOURNEY_STEPS as readonly string[]).includes(v);
}

/**
 * Coerce whatever came back from storage into a valid record. Runs on
 * migration and defensively on every write, so a truncated or hand-edited
 * entry can never leave a screen indexing past the last step.
 */
function sanitizeProgress(raw: unknown): JourneyProgress {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<JourneyProgress>;
  const completed = Array.isArray(p.completedSteps)
    ? p.completedSteps.filter(isStepId)
    : [];
  return {
    stepIndex: clampStep(typeof p.stepIndex === 'number' ? p.stepIndex : 0),
    completedSteps: Array.from(new Set(completed)),
    lastStopKey: typeof p.lastStopKey === 'string' && p.lastStopKey ? p.lastStopKey : null,
    updatedAt: typeof p.updatedAt === 'number' && p.updatedAt > 0 ? p.updatedAt : 0,
  };
}

/** Read a venue's progress from a state snapshot (never undefined). */
export function progressFor(state: JourneyState, slug: string): JourneyProgress {
  return state.progress[slug] ?? EMPTY_JOURNEY_PROGRESS;
}

/** Selector factory for `useJourneyStore(selectJourneyProgress(slug))`. */
export function selectJourneyProgress(slug: string) {
  return (state: JourneyState) => progressFor(state, slug);
}

/** True once every step has been completed. */
export function isJourneyComplete(p: JourneyProgress): boolean {
  return JOURNEY_STEPS.every(step => p.completedSteps.includes(step));
}

/** The step id for a progress record (already clamped). */
export function currentStepId(p: JourneyProgress): JourneyStepId {
  return JOURNEY_STEPS[clampStep(p.stepIndex)];
}

export const useJourneyStore = create<JourneyState & JourneyActions>()(
  persist(
    (set, get) => {
      // Every action funnels through here so the sanitize + timestamp rules
      // hold no matter which path wrote the record.
      const write = (slug: string, patch: Partial<JourneyProgress>) => {
        if (!slug) return;
        const prev = progressFor(get(), slug);
        const next = sanitizeProgress({...prev, ...patch, updatedAt: Date.now()});
        set(state => ({progress: {...state.progress, [slug]: next}}));
      };

      return {
        progress: {},

        goToStep: (slug, stepIndex) => write(slug, {stepIndex: clampStep(stepIndex)}),

        completeStep: (slug, step) => {
          const prev = progressFor(get(), slug);
          const completedSteps = prev.completedSteps.includes(step)
            ? prev.completedSteps
            : [...prev.completedSteps, step];
          const stepIndex = clampStep(JOURNEY_STEPS.indexOf(step) + 1);
          write(slug, {completedSteps, stepIndex});
        },

        advance: slug => {
          const prev = progressFor(get(), slug);
          get().completeStep(slug, currentStepId(prev));
        },

        setLastStopKey: (slug, stopKey) => write(slug, {lastStopKey: stopKey}),

        reset: slug =>
          set(state => {
            if (!(slug in state.progress)) return state;
            const progress = {...state.progress};
            delete progress[slug];
            return {progress};
          }),
      };
    },
    {
      name: STORAGE_KEYS.JOURNEY.PROGRESS,
      storage: createJSONStorage(() => AsyncStorage),
      // BUMPED 1 -> 2 WHEN 'explore' LEFT THE SEQUENCE. zustand only calls
      // `migrate` when the stored version differs, so leaving this at 1 would
      // rehydrate a saved `stepIndex: 3` verbatim against a 3-entry array:
      // "Step 4 of 3", a title falling back to "On the lawn" over the guide, and
      // a dot row with no current dot, until the first write repaired it.
      version: 2,
      // Sanitize every record rather than trusting the persisted shape: a
      // stepIndex past the end would crash the step switch on resume.
      migrate: (persisted: unknown) => {
        const prev = (persisted as Partial<JourneyState> | undefined) ?? {};
        const progress: Record<string, JourneyProgress> = {};
        for (const [slug, raw] of Object.entries(prev.progress ?? {})) {
          if (slug) progress[slug] = sanitizeProgress(raw);
        }
        return {progress};
      },
      partialize: state =>
        ({progress: state.progress}) as Partial<JourneyState & JourneyActions>,
    },
  ),
);
