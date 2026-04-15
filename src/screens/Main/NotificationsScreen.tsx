import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BellOff, Check, CheckCheck } from 'lucide-react-native';
import { FONTS } from '../../core/constants/theme';
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
    // Optimistic update — roll back if the server rejects.
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
          style={[styles.card, unread && styles.cardUnread]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {unread ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={styles.cardBody} numberOfLines={3}>
            {item.message}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardMeta}>{formatRelative(item.created_at)}</Text>
            {unread ? (
              <View style={styles.markRow}>
                <Check size={12} color="#E8A020" />
                <Text style={styles.markLabel}>Tap to mark read</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [handleMarkRead],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.headerBack}
        >
          <ArrowLeft size={22} color="#F5F0E8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={unreadCount === 0}
          hitSlop={12}
          style={[
            styles.headerAction,
            unreadCount === 0 && styles.headerActionDisabled,
          ]}
        >
          <CheckCheck
            size={18}
            color={unreadCount === 0 ? '#4A4A4A' : '#E8A020'}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color="#E8A020" />
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <BellOff size={36} color="#4A4A4A" />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySub}>
            We'll let you know when history is near.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerBack: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    color: '#F5F0E8',
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    marginLeft: 8,
  },
  headerAction: {
    padding: 6,
  },
  headerActionDisabled: {
    opacity: 0.5,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: '#121212',
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardUnread: {
    borderColor: 'rgba(232,160,32,0.35)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    color: '#F5F0E8',
    fontFamily: FONTS.semiBold,
    fontSize: 15,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8A020',
  },
  cardBody: {
    color: '#B8B0A0',
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  cardFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    color: '#6E6A60',
    fontFamily: FONTS.regular,
    fontSize: 12,
  },
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markLabel: {
    color: '#E8A020',
    fontFamily: FONTS.medium,
    fontSize: 11,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    color: '#F5F0E8',
    fontFamily: FONTS.semiBold,
    fontSize: 16,
  },
  emptySub: {
    color: '#8C8578',
    fontFamily: FONTS.regular,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    fontFamily: FONTS.regular,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default NotificationsScreen;
