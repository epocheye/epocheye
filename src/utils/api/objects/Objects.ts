/**
 * Object-media requests. One place the endpoint is built, as with ./audio.
 */
import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';
import type { ApiResult } from '../audio/types';
import type { ObjectMediaResponse } from './types';

/**
 * What a piece of media hangs off. Mirrors ck_object_media_subject_kind.
 *
 * 'stop' and 'figure' are authored by a person and exist before a visitor
 * arrives. 'class' is a detector class — real and curator-authored at the Indian
 * Museum, but MINTED AT RUNTIME at an explore-mode venue from whatever Gemini
 * called the object, which is why it could not be the only key.
 */
export type MediaSubjectKind = 'class' | 'stop' | 'figure';

/**
 * GET /api/v1/objects/media — the media attached to one subject at one venue.
 *
 * Something with nothing attached returns an empty `media` array and 200, not an
 * error: "no video for this one" is the normal case, and the card renders fine
 * without one.
 */
export async function listObjectMedia(
  monumentId: string,
  subjectKind: MediaSubjectKind,
  subjectKey: string,
): Promise<ApiResult<ObjectMediaResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<ObjectMediaResponse>(
      '/api/v1/objects/media',
      {
        params: {
          monument_id: monumentId,
          subject_kind: subjectKind,
          subject_key: subjectKey,
        },
      },
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
