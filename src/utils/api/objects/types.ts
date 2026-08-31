/**
 * Wire types for /api/v1/objects/* — media attached to a catalogued object.
 *
 * Mirrors apis/objectmedia/model.go. Field names deliberately match the card
 * contract the native renderer already reads (video_url / poster_url), so a row
 * becomes a card without a translation layer.
 */

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
}

export interface ObjectMediaResponse {
  monument_id: string;
  class_id: string;
  media: ObjectMedia[];
}
