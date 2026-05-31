/**
 * useVoiceInput — tap-to-dictate speech-to-text for the AI Guide input.
 *
 * Wraps `@react-native-voice/voice` (on-device STT). The flow is:
 *   tap mic → request microphone permission → start listening → partial +
 *   final transcripts are pushed to `onTranscript` (so the input box updates
 *   live) → tap again or natural end-of-speech stops. The transcript is left
 *   in the input for the user to edit before sending.
 *
 * Microphone permission is declared natively already (RECORD_AUDIO on Android,
 * NSMicrophoneUsageDescription on iOS) and surfaced via PermissionService.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Voice from '@react-native-voice/voice';
import type {
  SpeechErrorEvent,
  SpeechResultsEvent,
} from '@react-native-voice/voice';
import { PermissionService } from '../services/permission.service';

export interface UseVoiceInputOptions {
  /** Called with each partial + final transcript. */
  onTranscript: (text: string) => void;
  /** BCP-47 locale; defaults to en-US. */
  locale?: string;
}

export interface UseVoiceInputResult {
  isListening: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  toggle: () => void;
}

export function useVoiceInput({
  onTranscript,
  locale = 'en-US',
}: UseVoiceInputOptions): UseVoiceInputResult {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callback without re-binding the native listeners.
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    const handleResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0];
      if (text && text.length > 0) {
        onTranscriptRef.current(text);
      }
    };
    Voice.onSpeechResults = handleResults;
    Voice.onSpeechPartialResults = handleResults;
    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      setIsListening(false);
      setError(e.error?.message ?? 'Voice input failed');
    };

    return () => {
      Voice.destroy()
        .then(() => Voice.removeAllListeners())
        .catch(() => {});
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const granted = await PermissionService.request('microphone');
    if (!granted) {
      PermissionService.showSettingsAlert('microphone');
      return;
    }
    try {
      await Voice.start(locale);
    } catch {
      setError('Could not start voice input');
      setIsListening(false);
    }
  }, [locale]);

  const stop = useCallback(async () => {
    try {
      await Voice.stop();
    } catch {
      // ignore — already stopped
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      void stop();
    } else {
      void start();
    }
  }, [isListening, start, stop]);

  return { isListening, error, start, stop, toggle };
}
