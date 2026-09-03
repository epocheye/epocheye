/**
 * Wire types for /api/v1/objects/* — media attached to a catalogued object.
 *
 * Mirrors apis/objectmedia/model.go. Field names deliberately match the card
 * contract the native renderer already reads (video_url / poster_url), so a row
 * becomes a card without a translation layer.
 */

import type { MediaSubjectKind } from './Objects';

export interface ObjectMedia {
  id: string;
  class_id: string;
  media_type: string;
  /**
   * RELATIVE CDN key ("media/<venue>/<file>.mp4") or an absolute URL. Always
   * resolve through `buildMediaUrl()` (src/services/mediaCache.ts) — the domain
   * is deliberately kept out of the database.
   */
  media_url: string;
  poster_url?: string;
  title?: string;
  caption?: string;
  /**
   * The asset was produced rather than photographed. When true, `disclosure` is
   * guaranteed non-empty: the database refuses the row otherwise
   * (ck_object_media_disclosure, migration 090). A generated asset must never
   * be shown without it.
   */
  is_generated: boolean;
  disclosure?: string;
  sort_order: number;
  /**
   * ffprobe reading of the exact file behind `media_url` (migration 092), never
   * carried from a sibling encode. Absent means unmeasured or not applicable —
   * a still image has no duration.
   */
  duration_ms?: number;
  /**
   * Lets a card reserve the right box BEFORE the first frame decodes, so the
   * layout does not jump. A string ('16:9'), because that is what a layout reads.
   */
  aspect_ratio?: string;
  /**
   * Provenance, on the audio_clips model. A generated asset needs this more than
   * a photographed one does, not less: `disclosure` says "this is not a
   * photograph", `source_ids` says what the depiction was built from.
   */
  source_ids?: string[];
  /**
   * What this media hangs off, since migration 094. 'stop' + an
   * audio_stops.stop_key, 'figure' + a MagicWindowPerson id, or 'class' + a
   * detector class. The first two are authored; the third is minted at runtime
   * at an explore-mode venue, which is why it stopped being the only key.
   */
  subject_kind: MediaSubjectKind;
  subject_key: string;
}

export interface ObjectMediaResponse {
  monument_id: string;
  subject_kind: MediaSubjectKind;
  subject_key: string;
  /** Echoed only when the subject IS a detector class. Kept for older builds. */
  class_id?: string;
  media: ObjectMedia[];
}
