/**
 * Notifications API Module
 *
 * Wraps every user-facing endpoint under /api/notifications/*.
 * Backend: E:\epocheye_backend\apis\notifications\handler.go
 */

import { createAuthenticatedClient } from '../auth/Login';
import { createErrorResult } from '../helpers';
import {
  ListNotificationsQuery,
  Notification,
  NotificationListResponse,
  NotificationPreferences,
  NotificationsResult,
  RegisterDeviceRequest,
  UnreadCountResponse,
  UpdatePreferencesRequest,
} from './types';

export async function listNotifications(
  query: ListNotificationsQuery = {},
): Promise<NotificationsResult<NotificationListResponse>> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get<NotificationListResponse>(
      '/api/notifications/',
      {
        params: {
          limit: query.limit,
          offset: query.offset,
          unread_only: query.unread_only ? 'true' : undefined,
        },
      },
    );
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function getUnreadCount(): Promise<
  NotificationsResult<UnreadCountResponse>
> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get<UnreadCountResponse>(
      '/api/notifications/unread-count',
    );
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function markNotificationRead(
  id: string,
): Promise<NotificationsResult<null>> {
  try {
    const client = await createAuthenticatedClient();
    await client.put(`/api/notifications/${id}/read`);
    return { success: true, data: null };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function markAllNotificationsRead(): Promise<
  NotificationsResult<null>
> {
  try {
    const client = await createAuthenticatedClient();
    await client.put('/api/notifications/read-all');
    return { success: true, data: null };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function deleteNotification(
  id: string,
): Promise<NotificationsResult<null>> {
  try {
    const client = await createAuthenticatedClient();
    await client.delete(`/api/notifications/${id}`);
    return { success: true, data: null };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function getNotificationPreferences(): Promise<
  NotificationsResult<NotificationPreferences>
> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get<NotificationPreferences>(
      '/api/notifications/preferences',
    );
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function updateNotificationPreferences(
  body: UpdatePreferencesRequest,
): Promise<NotificationsResult<null>> {
  try {
    const client = await createAuthenticatedClient();
    await client.put('/api/notifications/preferences', body);
    return { success: true, data: null };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function registerDevice(
  body: RegisterDeviceRequest,
): Promise<NotificationsResult<null>> {
  try {
    const client = await createAuthenticatedClient();
    await client.post('/api/notifications/register-device', body);
    return { success: true, data: null };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function unregisterDevice(
  tokenId: string,
): Promise<NotificationsResult<null>> {
  try {
    const client = await createAuthenticatedClient();
    await client.delete(`/api/notifications/device/${tokenId}`);
    return { success: true, data: null };
  } catch (error) {
    return createErrorResult(error);
  }
}

export type { Notification };
