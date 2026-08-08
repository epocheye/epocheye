/**
 * The recording state machine, kept out of the screens.
 *
 * `chromeHidden` is the important export. MediaProjection records the literal
 * screen, so anything visible while recording is burned into the clip
 * permanently — including a stop button. Hosts gate their overlay on this flag,
 * and it goes true at the START of the preroll so the very first recorded frame
 * is already clean.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  RECORDING_EVENT,
  cancelRecording,
  isRecordingSupported,
  isScreenRecorderAvailable,
  recordingEmitter,
  requestConsent,
  startRecording,
  stopRecording,
  type ClipResult,
  type RecorderErrorCode,
  type RecordingEvent,
} from '../../native/ScreenRecorder';

export type RecordingState =
  | 'idle'
  | 'preparing'
  | 'preroll'
  | 'recording'
  | 'finalizing'
  | 'ready'
  | 'error';

const PREROLL_FROM = 3;
const DEFAULT_MAX_MS = 30_000;

export interface UseScreenRecordingOptions {
  /** Site slug, used in the filename. */
  fileNameHint?: string;
  maxDurationMs?: number;
}

export function useScreenRecording(options?: UseScreenRecordingOptions) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [prerollCount, setPrerollCount] = useState<number | null>(null);
  const [clip, setClip] = useState<ClipResult | null>(null);
  const [error, setError] = useState<{
    code: RecorderErrorCode;
    message?: string;
  } | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prerollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxDurationMs = options?.maxDurationMs ?? DEFAULT_MAX_MS;

  useEffect(() => {
    let cancelled = false;
    if (!isScreenRecorderAvailable) {
      return;
    }
    void isRecordingSupported().then(r => {
      if (!cancelled) setSupported(r.supported);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (prerollRef.current) clearInterval(prerollRef.current);
    tickRef.current = null;
    prerollRef.current = null;
  }, []);

  useEffect(() => {
    const sub = recordingEmitter?.addListener(
      RECORDING_EVENT,
      (e: RecordingEvent) => {
        if (e.state === 'recording') {
          startedAtRef.current = Date.now();
          setState('recording');
          setPrerollCount(null);
          if (tickRef.current) clearInterval(tickRef.current);
          tickRef.current = setInterval(() => {
            setElapsedMs(Date.now() - startedAtRef.current);
          }, 1000);
        } else if (e.state === 'finalizing') {
          clearTimers();
          setState('finalizing');
        } else if (e.state === 'error') {
          clearTimers();
          setError({ code: e.code, message: e.message });
          setState('error');
          setPrerollCount(null);
        }
      },
    );
    return () => {
      sub?.remove();
      clearTimers();
    };
  }, [clearTimers]);

  const begin = useCallback(async () => {
    setError(null);
    setClip(null);
    setState('preparing');
    try {
      await requestConsent({
        maxDurationMs,
        fileNameHint: options?.fileNameHint,
      });
    } catch (e) {
      const code = (e as { code?: RecorderErrorCode })?.code ?? 'consent_denied';
      setError({ code });
      // A denial is a decision — return quietly to idle rather than to an
      // error screen the user has to dismiss.
      setState(code === 'consent_denied' ? 'idle' : 'error');
      return;
    }

    // Preroll runs BEFORE start(), so the countdown itself is never recorded.
    setState('preroll');
    setPrerollCount(PREROLL_FROM);
    await new Promise<void>(resolve => {
      let n = PREROLL_FROM;
      prerollRef.current = setInterval(() => {
        n -= 1;
        if (n <= 0) {
          if (prerollRef.current) clearInterval(prerollRef.current);
          prerollRef.current = null;
          setPrerollCount(null);
          resolve();
        } else {
          setPrerollCount(n);
        }
      }, 1000);
    });

    try {
      setElapsedMs(0);
      await startRecording({
        audio: audioEnabled,
        maxDurationMs,
        fileNameHint: options?.fileNameHint,
      });
    } catch (e) {
      const code =
        (e as { code?: RecorderErrorCode })?.code ?? 'service_start_failed';
      setError({ code });
      setState('error');
    }
  }, [audioEnabled, maxDurationMs, options?.fileNameHint]);

  const stop = useCallback(async () => {
    clearTimers();
    setState('finalizing');
    try {
      const result = await stopRecording();
      setClip(result);
      setState('ready');
    } catch (e) {
      const code = (e as { code?: RecorderErrorCode })?.code ?? 'encoder_failed';
      setError({ code });
      setState('error');
    }
  }, [clearTimers]);

  const discard = useCallback(() => {
    clearTimers();
    void cancelRecording();
    setClip(null);
    setError(null);
    setState('idle');
    setPrerollCount(null);
  }, [clearTimers]);

  const toggleAudio = useCallback(() => setAudioEnabled(v => !v), []);

  /** True whenever the host must hide every piece of chrome. */
  const chromeHidden = state === 'preroll' || state === 'recording';

  return {
    supported,
    state,
    elapsedMs,
    prerollCount,
    clip,
    error,
    audioEnabled,
    toggleAudio,
    begin,
    stop,
    discard,
    chromeHidden,
  };
}
