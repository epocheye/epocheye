import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  Award,
  Bell,
  BellOff,
  CheckCheck,
  Flame,
  MapPin,
  Sparkles,
  Ticket,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '../utils/api/notifications';
import { useNotificationsStore } from '../stores/notificationsStore';
import { COLORS, FONTS } from '../core/constants/theme';

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

// Maps a notification `type` to a heritage-appropriate icon. Substring-keyed so
// new backend type strings degrade gracefully to the Bell default.
function iconForType(type: string): LucideIcon {
  const t = (type || '').toLowerCase();
  if (/(arriv|venue|geofence|near|approach)/.test(t)) return MapPin;
  if (/(streak|daily)/.test(t)) return Flame;
  if (/(tour|pass|purchase|order|payment)/.test(t)) return Ticket;
  if (/(level|badge|achiev|rank|stamp)/.test(t)) return Award;
  if (/(story|new|content|story)/.test(t)) return Sparkles;
  return Bell;
}

/** Pulsing skeleton row shown while the first page loads. */
const SkeletonRow: React.FC = () => {
  const o = useSharedValue(0.45);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.85, { duration: 800 }), -1, true);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={style}
      className="flex-row gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
      <View className="w-10 h-10 rounded-full bg-white/[0.06]" />
      <View className="flex-1 gap-2 py-1">
        <View className="h-3 rounded-full bg-white/[0.06] w-3/4" />
        <View className="h-2.5 rounded-full bg-white/[0.05] w-full" />
        <View className="h-2 rounded-full bg-white/[0.04] w-1/4 mt-1" />
      </View>
    </Animated.View>
  );
};

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
      const Icon = iconForType(item.type);
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => unread && void handleMarkRead(item.id)}
          className="flex-row gap-3 p-3.5 rounded-2xl"
          style={{
            backgroundColor: unread ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)',
            borderWidth: 1,
            borderColor: unread ? 'rgba(203,168,98,0.30)' : 'rgba(255,255,255,0.10)',
            opacity: unread ? 1 : 0.7,
          }}>
          {/* Gold accent bar — unread only */}
          {unread ? (
            <View
              style={{ width: 4, borderRadius: 999, alignSelf: 'stretch', backgroundColor: COLORS.gold }}
            />
          ) : null}
          {/* Type icon chip */}
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: unread ? 'rgba(203,168,98,0.14)' : 'rgba(255,255,255,0.05)' }}>
            <Icon size={20} color={unread ? COLORS.gold : COLORS.textTertiary} />
          </View>
          <View className="flex-1">
            <Text
              style={{ fontFamily: FONTS.uiSemiBold, fontSize: 15, color: COLORS.textPrimary, lineHeight: 20 }}
              numberOfLines={2}>
              {item.title}
            </Text>
            <Text
              style={{ fontFamily: FONTS.ui, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginTop: 2 }}
              numberOfLines={3}>
              {item.message}
            </Text>
            <Text
              style={{ fontFamily: FONTS.ui, fontSize: 11, color: COLORS.textTertiary, marginTop: 6 }}>
              {formatRelative(item.created_at)}
            </Text>
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
      {/* Tap-outside scrim — a centered, clearly-floating popup (not a full sheet). */}
      <TouchableOpacity
        className="flex-1 justify-center px-5"
        style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close notifications">
        <Animated.View entering={FadeInDown.duration(240)} style={{ maxHeight: '68%' }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            className="rounded-[28px] overflow-hidden border border-white/10 bg-card">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pt-5 pb-4">
              <View className="flex-row items-center gap-2.5">
                <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: COLORS.textPrimary }}>
                  Notifications
                </Text>
                {unreadCount > 0 ? (
                  <View
                    className="px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: 'rgba(203,168,98,0.15)' }}>
                    <Text style={{ fontFamily: FONTS.uiSemiBold, fontSize: 11, color: COLORS.gold }}>
                      {unreadCount} new
                    </Text>
                  </View>
                ) : null}
              </View>
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={handleMarkAllRead}
                  disabled={unreadCount === 0}
                  hitSlop={8}
                  className="w-9 h-9 rounded-full items-center justify-center border border-white/10"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', opacity: unreadCount === 0 ? 0.4 : 1 }}
                  accessibilityRole="button"
                  accessibilityLabel="Mark all as read">
                  <CheckCheck size={18} color={unreadCount === 0 ? COLORS.textTertiary : COLORS.gold} />
                </Pressable>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  className="w-9 h-9 rounded-full items-center justify-center border border-white/10"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  accessibilityRole="button"
                  accessibilityLabel="Close">
                  <X size={20} color={COLORS.textSecondary} />
                </Pressable>
              </View>
            </View>

            <View className="h-px bg-border" />

            {loading ? (
              <View className="px-4 pt-3.5 pb-5 gap-2.5">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </View>
            ) : error ? (
              <View className="py-12 justify-center items-center px-8">
                <Text style={{ fontFamily: FONTS.ui, fontSize: 14, color: COLORS.error, textAlign: 'center' }}>
                  {error}
                </Text>
              </View>
            ) : items.length === 0 ? (
              <View className="items-center px-8 pt-14 pb-16">
                <View
                  className="w-24 h-24 rounded-full items-center justify-center"
                  style={{ backgroundColor: 'rgba(203,168,98,0.06)' }}>
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center"
                    style={{ backgroundColor: 'rgba(203,168,98,0.14)' }}>
                    <BellOff size={28} color={COLORS.gold} />
                  </View>
                </View>
                <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: COLORS.textPrimary, marginTop: 16 }}>
                  All quiet
                </Text>
                <Text
                  style={{ fontFamily: FONTS.ui, fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19, marginTop: 6 }}>
                  We'll let you know the moment a story or heritage site is near.
                </Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={n => n.id}
                renderItem={renderItem}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 20,
                  gap: 10,
                }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

export default NotificationsModal;
