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
  /**
   * Ready-to-render attribution, e.g. 'Photograph by X, CC BY-SA 4.0'.
   *
   * NON-EMPTY FOR A PHOTOGRAPHED IMAGE. The database refuses the row otherwise
   * (ck_object_media_credit, migration 097), so a renderer that draws this
   * unconditionally cannot put an uncredited photograph on screen.
   *
   * It is a column rather than a convention because the convention was tried
   * and failed: six CC BY 2.0 photographs ship bundled in this app today
   * (src/assets/images/palace-rooms/), and roomPhotos.ts:16 asserts the magic
   * window's credits line covers them when that line names one different file.
   *
   * Empty on a generated asset, which owes a `disclosure` instead — there is no
   * photographer to name. Also empty from any backend older than 097, which is
   * why `useSubjectMedia` drops a photograph that arrives without one rather
   * than showing it bare.
   */
  credit?: string;
  /**
   * Where the licence and the original can be checked — normally the Wikimedia
   * Commons file page. Optional even where `credit` is required: a render of
   * our own model has a credit and no page to point at.
   */
  credit_url?: string;
}

export interface ObjectMediaResponse {
  monument_id: string;
  subject_kind: MediaSubjectKind;
  subject_key: string;
  /** Echoed only when the subject IS a detector class. Kept for older builds. */
  class_id?: string;
  media: ObjectMedia[];
}
