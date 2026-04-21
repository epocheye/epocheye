/**
 * Contract tests for the notifications API module — verifies each function
 * hits the expected endpoint path/method.
 */

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../src/utils/api/auth/Login', () => ({
  createAuthenticatedClient: () => mockClient,
}));

import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerDevice,
  unregisterDevice,
} from '../../src/utils/api/notifications/Notifications';

beforeEach(() => {
  mockClient.get.mockReset();
  mockClient.post.mockReset();
  mockClient.put.mockReset();
  mockClient.delete.mockReset();
});

test('listNotifications hits GET /api/notifications/', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { notifications: [], total: 0 } });
  await listNotifications();
  expect(mockClient.get).toHaveBeenCalledWith('/api/notifications/', {
    params: { limit: undefined, offset: undefined, unread_only: undefined },
  });
});

test('listNotifications passes query params', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { notifications: [], total: 0 } });
  await listNotifications({ limit: 10, offset: 5, unread_only: true });
  expect(mockClient.get).toHaveBeenCalledWith('/api/notifications/', {
    params: { limit: 10, offset: 5, unread_only: 'true' },
  });
});

test('getUnreadCount hits GET /api/notifications/unread-count', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { count: 3 } });
  const res = await getUnreadCount();
  expect(mockClient.get).toHaveBeenCalledWith('/api/notifications/unread-count');
  expect(res.success).toBe(true);
});

test('markNotificationRead hits PUT /api/notifications/:id/read', async () => {
  mockClient.put.mockResolvedValueOnce({});
  await markNotificationRead('notif-123');
  expect(mockClient.put).toHaveBeenCalledWith('/api/notifications/notif-123/read');
});

test('markAllNotificationsRead hits PUT /api/notifications/read-all', async () => {
  mockClient.put.mockResolvedValueOnce({});
  await markAllNotificationsRead();
  expect(mockClient.put).toHaveBeenCalledWith('/api/notifications/read-all');
});

test('deleteNotification hits DELETE /api/notifications/:id', async () => {
  mockClient.delete.mockResolvedValueOnce({});
  await deleteNotification('notif-456');
  expect(mockClient.delete).toHaveBeenCalledWith('/api/notifications/notif-456');
});

test('getNotificationPreferences hits GET /api/notifications/preferences', async () => {
  mockClient.get.mockResolvedValueOnce({ data: { push_enabled: true } });
  await getNotificationPreferences();
  expect(mockClient.get).toHaveBeenCalledWith('/api/notifications/preferences');
});

test('updateNotificationPreferences hits PUT /api/notifications/preferences', async () => {
  mockClient.put.mockResolvedValueOnce({});
  await updateNotificationPreferences({ push_enabled: false });
  expect(mockClient.put).toHaveBeenCalledWith('/api/notifications/preferences', {
    push_enabled: false,
  });
});

test('registerDevice hits POST /api/notifications/register-device', async () => {
  mockClient.post.mockResolvedValueOnce({});
  await registerDevice({ device_token: 'fcm-xyz', device_type: 'android' });
  expect(mockClient.post).toHaveBeenCalledWith('/api/notifications/register-device', {
    device_token: 'fcm-xyz',
    device_type: 'android',
  });
});

test('unregisterDevice hits DELETE /api/notifications/device/:tokenId', async () => {
  mockClient.delete.mockResolvedValueOnce({});
  await unregisterDevice('tok-789');
  expect(mockClient.delete).toHaveBeenCalledWith('/api/notifications/device/tok-789');
});

test('returns success=false on thrown error', async () => {
  mockClient.get.mockRejectedValueOnce(new Error('boom'));
  const res = await listNotifications();
  expect(res.success).toBe(false);
});
