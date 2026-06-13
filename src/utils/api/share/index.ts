/**
 * Share API module — wraps POST /api/v1/share on the Go backend.
 *
 * Mints a short, public, deep-linkable URL (https://epocheye.com/s/<id>) for the
 * "share your experience" flow. The returned URL opens the website's /s/[id] page,
 * which renders a preview and deep-links into the app (epocheye://site/<slug>) with
 * a store fallback.
 */

import {createAuthenticatedClient} from '../auth';
import {createErrorResult} from '../helpers';

export interface ShareLink {
  id: string;
  url: string;
}

export interface CreateShareParams {
  siteSlug: string;
  objectClassId?: string;
  title?: string;
  imageUrl?: string;
}

export type ApiResult<T> =
  | {success: true; data: T}
  | {success: false; error: {message: string; statusCode: number}};

/** Create a shareable link for a heritage site (optionally a scanned object). */
export async function createShareLink(
  params: CreateShareParams,
): Promise<ApiResult<ShareLink>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<ShareLink>('/api/v1/share', {
      site_slug: params.siteSlug,
      object_class_id: params.objectClassId ?? '',
      title: params.title ?? '',
      image_url: params.imageUrl ?? '',
    });
    return {success: true, data: resp.data};
  } catch (error) {
    return createErrorResult(error);
  }
}
