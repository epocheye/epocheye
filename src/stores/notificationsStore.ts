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

interface NotificationsState {
  /** Current unread count for the Home bell badge. */
  unreadCount: number;
  /**
   * Monotonic counter bumped on every incoming push/WS event. Components (e.g.
   * the open NotificationsModal) subscribe to this to reload their list.
   */
  incomingTick: number;
  setUnreadCount: (n: number) => void;
  refreshUnread: () => Promise<void>;
  /** Call when a new notification arrives over FCM or the WebSocket. */
  noteIncoming: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  unreadCount: 0,
  incomingTick: 0,
  setUnreadCount: n => set({ unreadCount: Math.max(0, n) }),
  refreshUnread: async () => {
    const res = await getUnreadCount();
    if (res.success) set({ unreadCount: Math.max(0, res.data.count) });
  },
  noteIncoming: () => {
    set(s => ({ incomingTick: s.incomingTick + 1 }));
    void get().refreshUnread();
  },
}));
