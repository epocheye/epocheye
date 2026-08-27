/**
 * Speech for the magic window's figures, over Android's own TextToSpeech.
 *
 * Returns a no-op shim wherever the native module is absent (iOS, or an older
 * build), so a caller never has to guard. `prepare()` resolving false is the
 * signal to hide the speaker control rather than offer a button that silently
 * does nothing — some devices ship with no TTS voice data at all.
 */

import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

interface SpeechNative {
  prepare(): Promise<boolean>;
  speak(text: string, options?: {utteranceId?: string}): void;
  stop(): void;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const native: SpeechNative | null =
  Platform.OS === 'android'
    ? ((NativeModules.EpocheyeSpeech as SpeechNative) ?? null)
    : null;

export type SpeechState = 'start' | 'done' | 'error';

export interface SpeechEvent {
  state: SpeechState;
  utteranceId: string | null;
}

export const isSpeechAvailable = native != null;

export async function prepareSpeech(): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.prepare();
  } catch {
    return false;
  }
}

export function speak(text: string, utteranceId = 'mw'): void {
  if (!native) return;
  try {
    native.speak(text, {utteranceId});
  } catch {
    // Silence is an acceptable failure here; the text is on screen regardless.
  }
}

export function stopSpeaking(): void {
  if (!native) return;
  try {
    native.stop();
  } catch {
    // ignore
  }
}

export function addSpeechListener(
  fn: (e: SpeechEvent) => void,
): {remove: () => void} {
  if (!native) return {remove: () => {}};
  const emitter = new NativeEventEmitter(
    NativeModules.EpocheyeSpeech as never,
  );
  const sub = emitter.addListener('EpocheyeSpeech', fn);
  return {remove: () => sub.remove()};
}
