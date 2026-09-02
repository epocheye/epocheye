/**
 * A figure's voice: one recorded line at a time, no transport, no chrome.
 *
 * WHY NOT <AudioPlayer/>. That component is the guide's transport — scrub bar,
 * speed, skip 15 s, lock-screen notification — and every one of those is wrong
 * here. A figure says a sentence when you tap him. There is nothing to scrub,
 * and a second media notification competing with the guide's would be a bug, not
 * a feature. So this is the <Video> element AudioPlayer wraps, and nothing else.
 *
 * WHY NOT DEVICE TTS, which is what this replaces. `SpeechModule.kt` hands the
 * text to Android's own TextToSpeech: whatever voice the handset ships, different
 * on every phone, and sharing nothing with the narrator the visitor has had in
 * their ears for the previous six stops. Figures are now recorded in
 * en-IN-Chirp3-HD-Achird — the same engine as the guide, a deliberately
 * different voice, because he is a person being quoted and not the narrator.
 *
 * The TTS path is NOT deleted. A person with no `voiceKeyPrefix` still falls
 * back to it, which is what the fort's Tipu figure does.
 *
 * `onSpeakingChange` is what lets the caller duck the guide narration under a
 * line, exactly as it ducked under TTS.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import Video, {type VideoRef} from 'react-native-video';

export interface FigureVoiceProps {
  /** Resolved clip URL, or null for silence (muted, no clip, no prefix). */
  uri: string | null;
  /**
   * Identifies the utterance, not the file. Tapping the SAME line twice should
   * replay it, and two lines can in principle share a file, so a change of uri
   * alone is not enough to know a new line started.
   */
  lineKey: string | null;
  onSpeakingChange?: (speaking: boolean) => void;
}

const FigureVoice: React.FC<FigureVoiceProps> = ({
  uri,
  lineKey,
  onSpeakingChange,
}) => {
  const videoRef = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(true);

  // Held in a ref so changing the callback identity cannot restart a line.
  const notify = useRef(onSpeakingChange);
  notify.current = onSpeakingChange;

  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastKey.current === lineKey) return;
    lastKey.current = lineKey;
    if (!uri || !lineKey) {
      setPaused(true);
      notify.current?.(false);
      return;
    }
    // Seek to 0 for the replay case, where the source is unchanged and the
    // native player would otherwise sit at the end of the previous play.
    videoRef.current?.seek(0);
    setPaused(false);
    notify.current?.(true);
  }, [lineKey, uri]);

  const finish = useCallback(() => {
    setPaused(true);
    notify.current?.(false);
  }, []);

  // A line that fails to load must not leave the guide ducked forever, so the
  // error path is the same as the end path. Silence is recoverable; a narration
  // that never comes back is not.
  if (!uri) return null;

  return (
    <Video
      ref={videoRef}
      source={{uri}}
      paused={paused}
      onEnd={finish}
      onError={finish}
      playInBackground={false}
      playWhenInactive={false}
      ignoreSilentSwitch="ignore"
      style={{height: 0, width: 0}}
    />
  );
};

export default FigureVoice;
