/**
 * Wire shapes for GET /api/v1/audio/stops — mirror apis/audio/model.go in the
 * backend one-to-one. Field names are the JSON tags; optionality follows the
 * Go `omitempty` pointers.
 *
 * TWO CALLERS, ONE CONTRACT. The audio guide screen and the palace journey were
 * built against this endpoint independently and each brought its own names for
 * the same things. Rather than pick a winner and break one of them, the pairs
 * are aliased below (`AudioTier`/`AudioClipTier`, `ApiResult`/`AudioResult`).
 * They are the SAME type — an alias, not a copy — so the two call sites cannot
 * drift apart, and either name can be retired later without a wire change.
 */

/**
 * Audience registers a clip can be recorded in. They mirror the keys authored
 * in monuments.content.narratives.by_persona (backend migration 037) and the
 * CHECK constraint on audio_clips.persona (migration 076), so the vocabularies
 * never drift. An unknown persona is a 400 from the server, not a silently
 * empty list.
 */
export type AudioPersona = 'casual' | 'history_buff' | 'child';

/** The three personas in display order, for a switcher. */
export const AUDIO_PERSONAS: AudioPersona[] = [
  'casual',
  'history_buff',
  'child',
];

/**
 * Evidence tier of a clip's script — CHECK-constrained server-side (migration
 * 076), so the union is closed rather than `| string`. A widened alias would
 * collapse to `string` and switch off every exhaustiveness check downstream.
 */
export type AudioTier = 'CONFIRMED' | 'INFERRED' | 'DISPUTED';

/** Alias kept for the journey's call site. Same type, not a second one. */
export type AudioClipTier = AudioTier;

/**
 * One pre-generated narration file for a stop, in one language and persona.
 * Produced offline and uploaded; the backend only serves the pointer.
 */
export interface AudioClip {
  /**
   * The language actually served, which may differ from the one requested when
   * this clip fell back to English. Per-stop truth: the response-level
   * `fallback_lang` only says that *something* fell back.
   */
  lang: string;
  persona: AudioPersona;
  /**
   * Either a CDN key ("audio/<venue>/<file>.mp3") or a fully qualified URL.
   * Always resolve through `buildAudioUrl()` (src/services/mediaCache.ts)
   * before handing it to the player.
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
   *
   * Optional, never null: model.go declares it `*string` with `,omitempty`, so a
   * NULL caption is omitted from the JSON rather than serialised as null.
   */
  restoration_caption?: string;
}

/**
 * One place at a venue where a visitor stands and listens.
 *
 * Every optional field below is `?: string`, never `| null`: model.go declares
 * them `*string` with `,omitempty`, so a NULL column is omitted from the JSON
 * entirely. Typing them nullable would force `?? undefined` at call sites for a
 * value the server cannot send.
 */
export interface AudioStop {
  stop_key: string;
  /** Display grouping only (e.g. 'exterior_lawn'); nothing queries it. */
  zone?: string;
  title: string;
  sort_order: number;
  /** Optional link to a monument_objects row (its class_id is UNIQUE). */
  class_id?: string;
  /**
   * The restored view of this place — a CDN key or absolute URL, resolved with
   * buildAudioUrl exactly like a clip's audio_url. Its PRESENCE is what gates
   * the "See it restored" entry point, so absent means "no restoration".
   */
  restoration_image_url?: string;
  /**
   * Omitted entirely when nothing is recorded for the requested persona in
   * either the requested language or 'en' — "authored but not recorded" stays
   * distinguishable from "no such stop", so the UI greys it out instead of
   * hiding it.
   */
  clip?: AudioClip;
  /**
   * True when this stop sits beyond the venue's free preview and the visitor
   * holds no pass for the site.
   *
   * A LOCKED STOP ARRIVES WITHOUT ITS PAYLOAD. The server strips `clip` and
   * `restoration_image_url` before responding (apis/audio/handler.go), so there
   * is no audio URL or transcript to leak — the lock is enforced on the wire,
   * not by this flag. Treat `locked` as "why is the clip missing", never as the
   * thing that keeps the audio shut.
   *
   * `title`, `zone` and `sort_order` still arrive, so the visitor can see what
   * the rest of the guide covers.
   */
  locked?: boolean;
}

export interface AudioStopsResponse {
  monument_id: string;
  /** Echo of the request after defaulting (lang 'en', persona 'casual'). */
  lang: string;
  persona: AudioPersona;
  /**
   * Set only when at least one stop could not be served in the requested
   * language and fell back (to 'en'). Absent when nothing fell back; per-stop
   * truth is on Clip.lang.
   */
  fallback_lang?: string;
  /**
   * How many stops this venue serves free, by sort_order. Absent means the whole
   * guide is free (monuments.free_preview_stops IS NULL — every venue that has
   * not been explicitly gated). Echoed so a "3 of 8 free" line never hardcodes
   * the number.
   */
  free_preview_stops?: number;
  /** How many stops came back stripped. Absent/0 when the visitor is entitled. */
  locked_count?: number;
  /**
   * What would unlock them — 'explorer_pass', the same vocabulary the scan
   * paywall uses, so both route through one purchase sheet. Set only when
   * `locked_count` > 0.
   */
  unlock?: string;
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

/**
 * The house result shape (see src/core/types/common.types.ts). Declared locally
 * like every other API module rather than imported, so this directory stays a
 * self-contained mirror of the Go package.
 */
export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; statusCode: number } };

/** Alias kept for the journey's call site. Same type, not a second one. */
export type AudioResult<T> = ApiResult<T>;
