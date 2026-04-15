/**
 * Notifications API Types
 * Mirrors E:\epocheye_backend\apis\notifications\model.go
 */

export interface Notification {
  id: string;
  user_uuid: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface NotificationPreferences {
  user_uuid: string;
  push_enabled: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  preferences: Record<string, unknown>;
  updated_at: string;
}

export interface UpdatePreferencesRequest {
  push_enabled?: boolean;
  in_app_enabled?: boolean;
  email_enabled?: boolean;
  preferences?: Record<string, unknown>;
}

export type DeviceType = 'android' | 'ios' | 'web';

export interface RegisterDeviceRequest {
  device_token: string;
  device_type: DeviceType;
  device_info?: Record<string, unknown>;
}

export interface ListNotificationsQuery {
  limit?: number;
  offset?: number;
  unread_only?: boolean;
}

export interface NotificationsError {
  message: string;
  statusCode: number;
}

export type NotificationsResult<T> =
  | { success: true; data: T }
  | { success: false; error: NotificationsError };
