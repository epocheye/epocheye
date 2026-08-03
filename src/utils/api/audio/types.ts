/**
 * Wire types for the audio guide, mirroring the Go shapes in
 * epocheye_backend/apis/audio/model.go. Keep them in step — the field names are
 * the contract.
 */

/**
 * Audience register a clip is recorded in. Matches the personas already authored
 * in monuments.content.narratives.by_persona (backend migration 037) and the
 * CHECK constraint on audio_clips.persona (migration 076). Not a new taxonomy.
 */
export type AudioPersona = 'casual' | 'history_buff' | 'child';

export const AUDIO_PERSONAS: AudioPersona[] = [
  'casual',
  'history_buff',
  'child',
];

/** Provenance confidence for the narration, carried through from the clip row. */
export type AudioTier = 'CONFIRMED' | 'INFERRED' | 'DISPUTED';

export interface AudioClip {
  /**
   * The language actually served, which may differ from the one requested when
   * this clip fell back to English. Per-stop truth: the response-level
   * `fallback_lang` only says that *something* fell back.
   */
  lang: string;
  persona: AudioPersona;
  /**
   * Either a CDN key ("audio/konark/walls_en.m4a") or a fully qualified URL.
   * Always resolve through `buildAudioUrl()` (src/config/glbDelivery.ts) before
   * handing it to the player.
   */
  audio_url: string;
  duration_ms: number;
  /** Full spoken text — the non-audio and accessibility path. */
  transcript: string;
  source_ids: string[];
  tier: AudioTier;
  /**
   * Authored prose shown under the restored image: what the reconstruction is
   * evidenced by, and which part of it is inference. Lives on the clip so it
   * translates with the transcript. Never composed client-side from `tier` and
   * `source_ids` — those say how confident and from where, not which part of the
   * picture is a guess.
   */
  restoration_caption?: string;
}

export interface AudioStop {
  stop_key: string;
  /** Optional grouping label, e.g. 'upper_floor'. Absent for ungrouped stops. */
  zone?: string;
  title: string;
  sort_order: number;
  /** Optional link to a monument_objects row. */
  class_id?: string;
  /**
   * The restored view of this place — a CDN key or absolute URL, resolved with
   * buildAudioUrl exactly like a clip's audio_url. Its presence is what gates
   * the "See it restored" entry point, so absent means "no restoration".
   */
  restoration_image_url?: string;
  /**
   * Absent when nothing is recorded for this stop in the requested persona, in
   * either the requested language or English. The stop is still listed so
   * "not recorded yet" stays distinguishable from "no such stop".
   */
  clip?: AudioClip;
}

export interface AudioStopsResponse {
  monument_id: string;
  /** Echoes the request after server-side defaulting. */
  lang: string;
  persona: AudioPersona;
  /**
   * Set only when at least one stop could not be served in the requested
   * language and fell back (to 'en'). Absent when nothing fell back.
   */
  fallback_lang?: string;
  stops: AudioStop[];
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; statusCode: number } };
