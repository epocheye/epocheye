/**
 * notificationsStore — the single source of truth for the notification unread
 * badge and a live "something arrived" signal.
 *
 * Why a store: in-app notifications used to only refresh when the user opened
 * the modal or re-focused Home. Now both the foreground FCM handler
 * (`fcmService`) and the WebSocket client (`notificationsSocketService`) push
 * into here via `noteIncoming()`, so the badge and an open modal update live —
 * no manual reopen needed.
 */
import { create } from 'zustand';

import { getUnreadCount } from '../utils/api/notifications';

export interface DailyBanner {
  title: string;
  message: string;
  /** Monotonic — a fresh nudge re-triggers the banner even with same copy. */
  seq: number;
}

interface NotificationsState {
  /** Current unread count for the Home bell badge. */
  unreadCount: number;
  /**
   * Monotonic counter bumped on every incoming push/WS event. Components (e.g.
   * the open NotificationsModal) subscribe to this to reload their list.
   */
  incomingTick: number;
  /**
   * In-app banner payload for a daily-content nudge that arrived while the app
   * is foregrounded (set by fcmService instead of a tray notification).
   * Rendered by DailyNudgeBanner at the main-stack root.
   */
  dailyBanner: DailyBanner | null;
  setUnreadCount: (n: number) => void;
  refreshUnread: () => Promise<void>;
  /** Call when a new notification arrives over FCM or the WebSocket. */
  noteIncoming: () => void;
  showDailyBanner: (title: string, message: string) => void;
  dismissDailyBanner: () => void;
  /** Clear all notification state on logout so the next user starts clean. */
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  unreadCount: 0,
  incomingTick: 0,
  dailyBanner: null,
  setUnreadCount: n => set({ unreadCount: Math.max(0, n) }),
  refreshUnread: async () => {
    const res = await getUnreadCount();
    if (res.success) set({ unreadCount: Math.max(0, res.data.count) });
  },
  noteIncoming: () => {
    set(s => ({ incomingTick: s.incomingTick + 1 }));
    void get().refreshUnread();
  },
  showDailyBanner: (title, message) =>
    set(s => ({
      dailyBanner: {
        title,
        message,
        seq: (s.dailyBanner?.seq ?? 0) + 1,
      },
    })),
  dismissDailyBanner: () => set({ dailyBanner: null }),
  reset: () => set({ unreadCount: 0, dailyBanner: null }),
}));
