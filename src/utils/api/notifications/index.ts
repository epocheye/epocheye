/**
 * Notifications API Module Exports
 */

export {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerDevice,
  unregisterDevice,
} from './Notifications';

export type {
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
  NotificationPreferences,
  UpdatePreferencesRequest,
  RegisterDeviceRequest,
  DeviceType,
  ListNotificationsQuery,
  NotificationsError,
  NotificationsResult,
} from './types';
