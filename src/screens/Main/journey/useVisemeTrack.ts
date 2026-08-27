/**
 * useVisemeTrack — fetch the precomputed mouth track that goes with a narration.
 *
 * The host figure's mouth is seven glTF morph targets on tipu_figure_royal5.glb
 * (the Meshy rig has no facial bones, so there is nothing else to move). What
 * drives them is a per-40 ms track written offline by `tools/lipsync_envelope.py`
 * and published beside the audio as `<name>.lipsync.json`.
 *
 * WHY FETCH IT RATHER THAN BUNDLE IT. The narration itself is a CDN key chosen at
 * runtime — journeyConfig picks it per venue and the audio guide reads its clips
 * out of the database — so a bundled track would go stale the moment a clip is
 * re-recorded, and would then lip-sync the new words to the old envelope. Deriving
 * the track URL from the audio URL keeps the two together by construction: publish
 * a new mp3 without its .lipsync.json and the mouth simply stays shut, which is a
 * visible, harmless failure rather than a wrong one.
 *
 * The track is handed to native as an UNPARSED string. Native parses it once and
 * ticks it against the audio player's reported position, so per-frame mouth weights
 * never cross the bridge.
 */
import { useEffect, useRef, useState } from 'react';

/** How long to wait before giving up and letting him speak with a closed mouth. */
const FETCH_TIMEOUT_MS = 8000;

export type VisemeTrackState = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface VisemeTrack {
  /** Raw JSON, passed straight through to the native view. Null until ready. */
  track: string | null;
  state: VisemeTrackState;
}

/**
 * Turn an audio URL into its track URL.
 *
 * Exported for the test: the substitution has to survive a query string (CDN
 * cache-busting) and an uppercase extension, and getting it wrong fails silently
 * as "no mouth" rather than as an error.
 */
export function visemeTrackUrl(audioUrl: string | null | undefined): string | null {
  if (!audioUrl) return null;
  const [path, query] = audioUrl.split('?', 2);
  const replaced = path.replace(/\.(mp3|m4a|aac|wav|ogg)$/i, '.lipsync.json');
  if (replaced === path) return null; // not an audio file we recognise
  return query ? `${replaced}?${query}` : replaced;
}

export function useVisemeTrack(audioUrl: string | null | undefined): VisemeTrack {
  const [track, setTrack] = useState<string | null>(null);
  const [state, setState] = useState<VisemeTrackState>('idle');
  // The URL the current `track` belongs to, so a re-render cannot serve the
  // previous narration's mouth over a new one.
  const forUrl = useRef<string | null>(null);

  useEffect(() => {
    const url = visemeTrackUrl(audioUrl);
    if (!url) {
      forUrl.current = null;
      setTrack(null);
      setState('idle');
      return;
    }
    if (forUrl.current === url) return;

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    forUrl.current = url;
    setTrack(null);
    setState('loading');

    fetch(url, { signal: controller.signal })
      .then(res => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(text => {
        if (cancelled) return;
        // Validate here rather than in Kotlin: a 200 that is actually an S3 error
        // page would otherwise reach native as a parse warning nobody reads.
        const parsed = JSON.parse(text) as { viseme?: unknown[]; visemeNames?: unknown[] };
        if (!Array.isArray(parsed.viseme) || !Array.isArray(parsed.visemeNames)) {
          throw new Error('not a viseme track');
        }
        setTrack(text);
        setState('ready');
        console.log(
          `[journey] viseme track ready: ${parsed.viseme.length} frames from ${url}`,
        );
      })
      .catch(err => {
        if (cancelled) return;
        // Not an error state for the visitor — he speaks, his mouth just stays shut.
        setTrack(null);
        setState('unavailable');
        console.log(
          `[journey] viseme track unavailable (${String(err?.message ?? err)}) for ${url}`,
        );
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [audioUrl]);

  return { track, state };
}
