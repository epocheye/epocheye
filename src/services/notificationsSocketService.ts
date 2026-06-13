/**
 * notificationsSocketService — opportunistic realtime notifications.
 *
 * Connects to the backend WebSocket (`/api/notifications/ws?token=`) for instant
 * in-app delivery while the app is foregrounded. The hub only runs on a
 * persistent server — on the Lambda deployment the endpoint returns 501 and the
 * socket simply never opens. To stay correct everywhere, a light foreground poll
 * of the unread count runs as a universal fallback (and FCM still delivers pushes
 * when the app is backgrounded/closed).
 *
 * Lifecycle: call startNotificationsRealtime() once the session is authenticated
 * and stopNotificationsRealtime() on logout. Foreground/background transitions
 * are handled internally.
 */
import { AppState, type AppStateStatus } from 'react-native';

import { API_CONFIG } from '../core/config';
import { getValidAccessToken } from '../utils/api/auth';
import { useNotificationsStore } from '../stores/notificationsStore';

const POLL_INTERVAL_MS = 120_000; // light unread-count safety net while foreground
const MAX_BACKOFF_MS = 30_000;

let socket: WebSocket | null = null;
let appStateSub: { remove: () => void } | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let backoffMs = 2_000;
let running = false;

function wsBaseUrl(): string | null {
  const base = API_CONFIG.BASE_URL;
  if (!base) return null;
  return base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
}

function clearReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function startPoll(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void useNotificationsStore.getState().refreshUnread();
  }, POLL_INTERVAL_MS);
}

function stopPoll(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function closeSocket(): void {
  if (socket) {
    // Detach handlers first so an intentional close doesn't trigger reconnect.
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      // ignore
    }
    socket = null;
  }
}

function scheduleReconnect(): void {
  if (!running || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
}

async function connect(): Promise<void> {
  if (!running || socket) return;

  const base = wsBaseUrl();
  const token = await getValidAccessToken();
  if (!base || !token) {
    // No endpoint/token — rely on the poll fallback + FCM.
    startPoll();
    return;
  }

  // Re-check after the await: we may have been stopped/backgrounded.
  if (!running || socket) return;

  try {
    const ws = new WebSocket(
      `${base}/api/notifications/ws?token=${encodeURIComponent(token)}`,
    );
    socket = ws;

    ws.onopen = () => {
      backoffMs = 2_000;
      // Socket is live — the poll is redundant; stop it to save requests.
      stopPoll();
      // Reconcile any unread accrued while disconnected.
      void useNotificationsStore.getState().refreshUnread();
    };

    ws.onmessage = () => {
      // Any server message means notification state changed.
      useNotificationsStore.getState().noteIncoming();
    };

    ws.onerror = () => {
      // onclose will follow; nothing to do here.
    };

    ws.onclose = () => {
      socket = null;
      // Keep the user fresh via polling while we try to reconnect.
      startPoll();
      scheduleReconnect();
    };
  } catch {
    socket = null;
    startPoll();
    scheduleReconnect();
  }
}

function handleAppState(state: AppStateStatus): void {
  if (!running) return;
  if (state === 'active') {
    backoffMs = 2_000;
    void useNotificationsStore.getState().refreshUnread();
    startPoll();
    void connect();
  } else {
    // Backgrounded: drop the socket + poll. FCM covers delivery while away.
    clearReconnect();
    closeSocket();
    stopPoll();
  }
}

export function startNotificationsRealtime(): void {
  if (running) return;
  running = true;
  backoffMs = 2_000;

  appStateSub = AppState.addEventListener('change', handleAppState);

  // Kick off immediately if already foregrounded.
  if (AppState.currentState === 'active') {
    void useNotificationsStore.getState().refreshUnread();
    startPoll();
    void connect();
  }
}

export function stopNotificationsRealtime(): void {
  running = false;
  clearReconnect();
  closeSocket();
  stopPoll();
  appStateSub?.remove();
  appStateSub = null;
}
