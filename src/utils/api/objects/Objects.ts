/**
 * Object-media requests. One place the endpoint is built, as with ./audio.
 */
import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';
import type { ApiResult } from '../audio/types';
import type { ObjectMediaResponse } from './types';

/**
 * GET /api/v1/objects/media — the media attached to one object at one venue.
 *
 * An object with nothing attached returns an empty `media` array and 200, not an
 * error: "no video for this one" is the normal case, and the card renders fine
 * without one.
 */
export async function listObjectMedia(
  monumentId: string,
  classId: string,
): Promise<ApiResult<ObjectMediaResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<ObjectMediaResponse>(
      '/api/v1/objects/media',
      { params: { monument_id: monumentId, class_id: classId } },
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
