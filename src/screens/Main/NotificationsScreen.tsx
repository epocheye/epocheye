import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BellOff, Check, CheckCheck } from 'lucide-react-native';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '../../utils/api/notifications';
import type { MainScreenProps } from '../../core/types/navigation.types';

type Props = MainScreenProps<'Notifications'>;

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

const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    const result = await listNotifications({ limit: PAGE_SIZE, offset: 0 });
    if (result.success) {
      setItems(result.data.notifications);
      setUnreadCount(result.data.unread_count);
      setError(null);
    } else {
      setError(result.error.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleMarkRead = useCallback(async (id: string) => {
    setItems(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount(c => Math.max(0, c - 1));

    const result = await markNotificationRead(id);
    if (!result.success) {
      setItems(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: false } : n)),
      );
      setUnreadCount(c => c + 1);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    const snapshot = items;
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    const result = await markAllNotificationsRead();
    if (!result.success) {
      setItems(snapshot);
      await load();
    }
  }, [items, unreadCount, load]);

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
            borderColor: unread ? 'rgba(232,160,32,0.35)' : 'rgba(255,255,255,0.05)',
          }}>
          <View className="flex-row items-center gap-x-2 mb-[6px]">
            <Text className="flex-1 text-parchment font-instrument-semibold text-[15px]" numberOfLines={1}>
              {item.title}
            </Text>
            {unread ? <View className="w-2 h-2 rounded-full bg-accent-amber" /> : null}
          </View>
          <Text className="text-[#B8B0A0] font-instrument text-[14px] leading-5" numberOfLines={3}>
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
    <SafeAreaView className="flex-1 bg-surface-1" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <View
        className="flex-row items-center px-4 pb-3 pt-2"
        style={{borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)'}}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          className="p-[6px]">
          <ArrowLeft size={22} color="#F5F0E8" />
        </TouchableOpacity>
        <Text className="flex-1 text-parchment font-instrument-semibold text-[18px] ml-2">
          Notifications
        </Text>
        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={unreadCount === 0}
          className={`p-[6px]${unreadCount === 0 ? ' opacity-50' : ''}`}
          hitSlop={12}>
          <CheckCheck
            size={18}
            color={unreadCount === 0 ? '#4A4A4A' : '#E8A020'}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center px-8 gap-y-3">
          <ActivityIndicator color="#E8A020" />
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-8 gap-y-3">
          <Text className="text-[#FF6B6B] font-instrument text-[14px] text-center">
            {error}
          </Text>
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8 gap-y-3">
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
          contentContainerStyle={{paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 12}}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#E8A020"
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

export default NotificationsScreen;
