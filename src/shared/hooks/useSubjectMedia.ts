/**
 * useSubjectMedia — the media attached to one authored subject at one venue,
 * resolved and ready to render.
 *
 * WHY THIS EXISTS. `object_media` has held authored video since migration 090,
 * and migration 094 replaced its single `class_id` binding with a
 * (`subject_kind`, `subject_key`) pair so a row can hang off something a person
 * WROTE — an audio stop's `stop_key`, a figure's id — instead of a detector
 * class string that a language model mints at runtime and nobody can author
 * against ahead of time. Migration 095 then rebound the palace's five clips onto
 * that pair and guarded the move with a RAISE EXCEPTION.
 *
 * The backend served it. The typed client served it. Nothing in the app ever
 * asked. The one caller of `listObjectMedia` (PointLearnStep) asks for
 * `'class'`, which 095 guarantees is empty at this venue — so five videos sat
 * live on CloudFront, correctly bound in prod, and completely unreachable. This
 * hook is the missing half.
 *
 * WHAT IT GUARANTEES, and both are promises the schema makes that a renderer
 * cannot be trusted to remember:
 *
 *   1. A GENERATED ASSET NEVER COMES BACK WITHOUT ITS DISCLOSURE. `object_media`
 *      has a CHECK that refuses to STORE one without it; this is the other half,
 *      refusing to SERVE one. Enforced per clip, so a bad row is dropped on its
 *      own rather than taking its siblings with it. The rule and its wording are
 *      lifted from PointLearnStep's own resolution block rather than re-derived.
 *   2. AN EMPTY RESULT IS NORMAL. Seven of the palace's eight stops have no
 *      video at all. `videos` is simply empty and the caller renders nothing —
 *      never a tray, never a spinner that resolves to a hole.
 *
 * IT SERVES IMAGES TOO, and that is most of what it does at this venue. Seven of
 * the palace's eight stops had no picture of any kind — a voice over a dead
 * panel — while `object_media` already had somewhere to put one. Migration 097
 * added the nine `media_type = 'image'` rows and the two columns the third
 * promise below needs.
 *
 *   3. A PHOTOGRAPH NEVER COMES BACK WITHOUT ITS CREDIT. Exactly the same shape
 *      as the disclosure rule and for the same reason: `ck_object_media_credit`
 *      refuses to STORE one without it, this refuses to SERVE one. It also
 *      makes the app safe against a backend older than 097, which cannot send
 *      the field at all — those photographs simply do not appear, rather than
 *      appearing uncredited.
 *
 * Resolution goes through `getOrFetchMedia`, so a clip already in the LRU plays
 * from `file://` and a cold one streams from the CDN. It never rejects, so one
 * slow or absent clip cannot hold up or fail the others.
 */
import { useEffect, useState } from 'react';

import {
  listObjectMedia,
  type MediaSubjectKind,
} from '../../utils/api/objects/Objects';
import { buildMediaUrl, getOrFetchMedia } from '../../services/mediaCache';

/** One video, resolved to something a player can be handed. */
export interface SubjectVideo {
  /** Stable key for lists — the row id, which is unique per media row. */
  id: string;
  /** Playable URI: a cached `file://` when warm, the CDN URL when cold. */
  videoUrl: string;
  /** Poster frame, resolved the same way. Null when the row has none. */
  posterUrl: string | null;
  /** The row's own title — per-video, not the subject's name. */
  title: string;
  /** The row's caption, when it has one. */
  caption: string;
  /**
   * NON-EMPTY WHENEVER `is_generated`. A row that is generated and carries no
   * disclosure never reaches this array at all, so a renderer that draws this
   * string unconditionally cannot draw a generated clip without it.
   */
  disclosure: string;
  /** e.g. '16:9', so a layout can reserve the box before the first frame. */
  aspectRatio: string | null;
}

/** One still, resolved to something an <Image> can be handed. */
export interface SubjectImage {
  /** Stable key for lists — the row id. */
  id: string;
  /** Displayable URI: a cached `file://` when warm, the CDN URL when cold. */
  imageUrl: string;
  /** The row's own title. */
  title: string;
  /** The row's caption — a second edition of the narration, not a summary. */
  caption: string;
  /**
   * NON-EMPTY WHENEVER `is_generated`, by the same rule as SubjectVideo. A
   * generated still with no disclosure never reaches this array.
   */
  disclosure: string;
  /**
   * NON-EMPTY WHENEVER THE STILL IS A PHOTOGRAPH. A photographed row with no
   * credit never reaches this array either, so a renderer that draws this
   * unconditionally cannot show an uncredited photograph.
   *
   * A generated still has a credit too where one makes sense ("Rendered from
   * the Epocheye magic-window model"), but is not required to.
   */
  credit: string;
  /** Commons page or other licence source. Empty when there is none to give. */
  creditUrl: string;
  /** e.g. '4:3', so the box is reserved before the file decodes. */
  aspectRatio: string | null;
}

export interface SubjectMedia {
  videos: SubjectVideo[];
  /** Stills for this subject, in `sort_order`. Empty is normal. */
  images: SubjectImage[];
  /** True while the first request for the current subject is in flight. */
  loading: boolean;
}

const EMPTY: SubjectVideo[] = [];
const EMPTY_IMAGES: SubjectImage[] = [];

/**
 * The disclosure a row is allowed to be shown with, or null to DROP the row.
 *
 * Exported and pure so the promise can be tested directly rather than inferred
 * from a rendered tree. The rule, in one place:
 *
 *   - generated + a disclosure  → show it, carrying that disclosure
 *   - generated + no disclosure → DROP. `object_media`'s CHECK refuses to store
 *     this (migration 090); if one exists anyway — a hand-written row, a future
 *     migration that relaxes the constraint — it must not reach a visitor.
 *   - not generated             → show it, with no disclosure. A photograph
 *     needs no warning that it is a photograph.
 *
 * Per row, deliberately: a bad row is dropped on its own instead of taking its
 * siblings with it.
 */
export function disclosureFor(clip: {
  is_generated: boolean;
  disclosure?: string;
}): string | null {
  if (!clip.is_generated) return '';
  const disclosure = clip.disclosure ?? '';
  return disclosure.trim().length > 0 ? disclosure : null;
}

/**
 * The credit a still is allowed to be shown with, or null to DROP the row.
 *
 * The twin of `disclosureFor`, exported and pure for the same reason — a
 * licence obligation that is only ever kept by a renderer remembering to keep
 * it is not kept. The rule:
 *
 *   - photographed + a credit  → show it, carrying that credit
 *   - photographed + no credit → DROP. `ck_object_media_credit` (migration 097)
 *     refuses to store this, but a backend older than 097 cannot send the field
 *     at all, so the same row arrives credit-less from a stale deploy. Dropping
 *     it means an out-of-date server shows NO photographs rather than showing
 *     them uncredited, which is the failure that actually matters.
 *   - generated                → show it, with whatever credit it has. It owes a
 *     `disclosure` instead, and that is enforced separately; a render of our own
 *     model has no photographer to name.
 *
 * Per row, like the disclosure rule: a bad row is dropped on its own.
 */
export function creditFor(clip: {
  is_generated: boolean;
  credit?: string;
}): string | null {
  const credit = clip.credit ?? '';
  if (clip.is_generated) return credit;
  return credit.trim().length > 0 ? credit : null;
}

/**
 * @param slug    venue slug (`monuments.slug`)
 * @param kind    'stop' | 'figure' | 'class'
 * @param key     the subject's key — an `audio_stops.stop_key`, a
 *                `MagicWindowPerson.id`, or a detector class
 *
 * Pass a null/empty `key` to stand the hook down (no request, empty result).
 * That is the normal state on a stop nobody has attached media to, and on the
 * magic window at a viewpoint with no figure.
 */
export function useSubjectMedia(
  slug: string | null | undefined,
  kind: MediaSubjectKind,
  key: string | null | undefined,
): SubjectMedia {
  const [videos, setVideos] = useState<SubjectVideo[]>(EMPTY);
  const [images, setImages] = useState<SubjectImage[]>(EMPTY_IMAGES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug || !key) {
      setVideos(EMPTY);
      setImages(EMPTY_IMAGES);
      setLoading(false);
      return;
    }
    // `cancelled` rather than an AbortController: the work we must not let land
    // is the setState, and the network call is cheap enough that racing it is
    // not worth a second mechanism. A stale response simply never writes.
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const res = await listObjectMedia(slug, kind, key);
      if (cancelled) return;
      if (!res.success) {
        // Silent. "This one has no video" and "the request failed" look the
        // same to a visitor, and neither is worth interrupting them for — the
        // surrounding content stands on its own.
        setVideos(EMPTY);
        setImages(EMPTY_IMAGES);
        setLoading(false);
        return;
      }

      const clips = res.data.media.filter(m => m.media_type === 'video');
      const stills = res.data.media.filter(m => m.media_type === 'image');

      // Both kinds resolve in one pass so a stop with a picture AND a video
      // does not render the second one a beat after the first.
      const [resolvedClips, resolvedStills] = await Promise.all([
        Promise.all(
          clips.map(async clip => {
            const url = buildMediaUrl(clip.media_url);
            if (!url) return null;
            // A GENERATED ASSET NEVER PLAYS WITHOUT ITS DISCLOSURE.
            const disclosure = disclosureFor(clip);
            if (disclosure === null) return null;
            const posterRemote = buildMediaUrl(clip.poster_url);
            const [videoUrl, posterUrl] = await Promise.all([
              getOrFetchMedia(url),
              posterRemote
                ? getOrFetchMedia(posterRemote)
                : Promise.resolve(null),
            ]);
            return {
              id: clip.id,
              videoUrl,
              posterUrl,
              title: clip.title ?? '',
              caption: clip.caption ?? '',
              disclosure,
              aspectRatio: clip.aspect_ratio ?? null,
            } as SubjectVideo;
          }),
        ),
        Promise.all(
          stills.map(async still => {
            const url = buildMediaUrl(still.media_url);
            if (!url) return null;
            // BOTH PROMISES, ON EVERY STILL. A generated picture without its
            // disclosure and a photograph without its credit are the same
            // failure wearing different clothes.
            const disclosure = disclosureFor(still);
            if (disclosure === null) return null;
            const credit = creditFor(still);
            if (credit === null) return null;
            const imageUrl = await getOrFetchMedia(url);
            return {
              id: still.id,
              imageUrl,
              title: still.title ?? '',
              caption: still.caption ?? '',
              disclosure,
              credit,
              creditUrl: still.credit_url ?? '',
              aspectRatio: still.aspect_ratio ?? null,
            } as SubjectImage;
          }),
        ),
      ]);
      if (cancelled) return;

      const keptClips = resolvedClips.filter(
        (v): v is SubjectVideo => v !== null,
      );
      const keptStills = resolvedStills.filter(
        (v): v is SubjectImage => v !== null,
      );
      setVideos(keptClips.length > 0 ? keptClips : EMPTY);
      setImages(keptStills.length > 0 ? keptStills : EMPTY_IMAGES);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, kind, key]);

  return { videos, images, loading };
}
