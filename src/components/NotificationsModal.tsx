import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BellOff, Check, CheckCheck, X } from 'lucide-react-native';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '../utils/api/notifications';
import { useNotificationsStore } from '../stores/notificationsStore';

export interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  /** Bubbles the latest unread count up so a parent badge can stay in sync. */
  onUnreadChange?: (count: number) => void;
}

const PAGE_SIZE = 50;

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
  onUnreadChange,
}) => {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const setUnread = useCallback(
    (next: number) => {
      const safe = Math.max(0, next);
      setUnreadCount(safe);
      onUnreadChange?.(safe);
    },
    [onUnreadChange],
  );

  const load = useCallback(async () => {
    const result = await listNotifications({ limit: PAGE_SIZE, offset: 0 });
    if (result.success) {
      setItems(result.data.notifications);
      setUnread(result.data.unread_count);
      setError(null);
    } else {
      setError(result.error.message);
    }
  }, [setUnread]);

  // Load each time the modal opens; reset to a clean loading state on close.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, load]);

  // Live refresh: when a new notification arrives over FCM/WS while the modal is
  // open, reload the list in place (no spinner flash).
  const incomingTick = useNotificationsStore(s => s.incomingTick);
  useEffect(() => {
    if (visible && incomingTick > 0) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingTick]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      setItems(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnread(unreadCount - 1);

      const result = await markNotificationRead(id);
      if (!result.success) {
        setItems(prev =>
          prev.map(n => (n.id === id ? { ...n, is_read: false } : n)),
        );
        setUnread(unreadCount);
      }
    },
    [setUnread, unreadCount],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    const snapshot = items;
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);

    const result = await markAllNotificationsRead();
    if (!result.success) {
      setItems(snapshot);
      await load();
    }
  }, [items, unreadCount, load, setUnread]);

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => {
      const unread = !item.is_read;
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => unread && void handleMarkRead(item.id)}
          className="bg-[#121212] rounded-[14px] p-4"
          style={{
            borderWidth: 0.5,
            borderColor: unread
              ? 'rgba(232,160,32,0.35)'
              : 'rgba(255,255,255,0.05)',
          }}>
          <View className="flex-row items-center gap-x-2 mb-[6px]">
            <Text
              className="flex-1 text-parchment font-instrument-semibold text-[15px]"
              numberOfLines={1}>
              {item.title}
            </Text>
            {unread ? (
              <View className="w-2 h-2 rounded-full bg-accent-amber" />
            ) : null}
          </View>
          <Text
            className="text-[#B8B0A0] font-instrument text-[14px] leading-5"
            numberOfLines={3}>
            {item.message}
          </Text>
          <View className="mt-[10px] flex-row justify-between items-center">
            <Text className="text-[#6E6A60] font-instrument text-[12px]">
              {formatRelative(item.created_at)}
            </Text>
            {unread ? (
              <View className="flex-row items-center gap-x-1">
                <Check size={12} color="#E8A020" />
                <Text className="text-accent-amber font-instrument-medium text-[11px]">
                  Tap to mark read
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [handleMarkRead],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View className="flex-1 bg-black/70 justify-end">
        {/* Tap-outside scrim */}
        <TouchableOpacity
          className="flex-1"
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close notifications"
        />

        <View
          className="bg-[#141414] rounded-t-3xl border-t border-l border-r border-[rgba(255,255,255,0.06)]"
          style={{ maxHeight: '72%' }}>
          {/* Grab handle */}
          <View className="items-center pt-3">
            <View className="w-10 h-1 rounded-full bg-[rgba(255,255,255,0.15)]" />
          </View>

          {/* Header */}
          <View className="flex-row items-center px-5 pt-3 pb-3">
            <Text className="flex-1 text-parchment font-instrument-semibold text-[18px]">
              Notifications
            </Text>
            <TouchableOpacity
              onPress={handleMarkAllRead}
              disabled={unreadCount === 0}
              className={`p-[6px] mr-1${unreadCount === 0 ? ' opacity-50' : ''}`}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read">
              <CheckCheck
                size={18}
                color={unreadCount === 0 ? '#4A4A4A' : '#E8A020'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              className="p-[6px]"
              accessibilityRole="button"
              accessibilityLabel="Close">
              <X size={20} color="#8C8578" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View className="py-16 justify-center items-center px-8">
              <ActivityIndicator color="#E8A020" />
            </View>
          ) : error ? (
            <View className="py-16 justify-center items-center px-8">
              <Text className="text-[#FF6B6B] font-instrument text-[14px] text-center">
                {error}
              </Text>
            </View>
          ) : items.length === 0 ? (
            <View className="py-16 justify-center items-center px-8 gap-y-3">
              <BellOff size={36} color="#4A4A4A" />
              <Text className="text-parchment font-instrument-semibold text-[16px]">
                No notifications yet
              </Text>
              <Text className="text-[#8C8578] font-instrument text-[14px] text-center">
                We'll let you know when history is near.
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={n => n.id}
              renderItem={renderItem}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: 28,
                gap: 12,
              }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

export default NotificationsModal;
