/**
 * Wire shapes for GET /api/v1/audio/stops — mirror apis/audio/model.go in the
 * backend one-to-one. Field names are the JSON tags; optionality follows the
 * Go `omitempty` pointers.
 */

/**
 * Audience registers a clip can be recorded in. They mirror the keys authored
 * in monuments.content.narratives.by_persona, so the vocabularies never drift.
 * An unknown persona is a 400 from the server, not a silently empty list.
 */
export type AudioPersona = 'casual' | 'history_buff' | 'child';

/** Evidence tier of a clip's script. */
export type AudioClipTier = 'CONFIRMED' | 'INFERRED' | 'DISPUTED' | string;

/**
 * One pre-generated narration file for a stop, in one language and persona.
 * Produced offline and uploaded; the backend only serves the pointer.
 */
export interface AudioClip {
  /** Language actually served — differs from the request when this clip fell back to 'en'. */
  lang: string;
  persona: AudioPersona | string;
  /**
   * A relative CDN key ("audio/<venue>/<file>.mp3") OR an absolute URL. Resolve
   * with `buildAudioUrl` (src/services/mediaCache.ts) before playing.
   */
  audio_url: string;
  duration_ms: number;
  transcript: string;
  source_ids: string[];
  tier: AudioClipTier;
  /**
   * Authored prose under the restored image — what the reconstruction is
   * evidenced by and which part is inference. Absent when the stop has no
   * restoration or no caption exists in this language yet.
   */
  restoration_caption?: string | null;
}

/** One place at a venue where a visitor stands and listens. */
export interface AudioStop {
  stop_key: string;
  /** Display grouping only (e.g. 'exterior_lawn'); nothing queries it. */
  zone?: string | null;
  title: string;
  sort_order: number;
  class_id?: string | null;
  /**
   * Restored view of this place — a CDN key or absolute URL, resolved like a
   * clip's audio_url. Its PRESENCE gates the "See it restored" entry point.
   */
  restoration_image_url?: string | null;
  /**
   * Omitted entirely when nothing is recorded for the requested persona in
   * either the requested language or 'en' — "authored but not recorded" stays
   * distinguishable from "no such stop", so the UI greys it out instead of
   * hiding it.
   */
  clip?: AudioClip;
}

export interface AudioStopsResponse {
  monument_id: string;
  /** Echo of the request after defaulting (lang 'en', persona 'casual'). */
  lang: string;
  persona: string;
  /** Set only when at least one stop fell back to 'en'; per-stop truth is on Clip.lang. */
  fallback_lang?: string;
  stops: AudioStop[];
}

export interface AudioStopsQuery {
  /** Defaults server-side to 'en'. */
  lang?: string;
  /** Defaults server-side to 'casual'. */
  persona?: AudioPersona;
}

/** Stops sharing a zone, in walking order. `zone` is null for ungrouped stops. */
export interface AudioStopGroup {
  zone: string | null;
  stops: AudioStop[];
}

export type AudioResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; statusCode: number } };
