/**
 * First-party product analytics — the single client entry point for capturing
 * every screen view and user action.
 *
 * Design goals:
 *  - Best-effort: never throws, never blocks the UI (mirrors usageTelemetryService).
 *  - Works pre- AND post-login: events are attributed by a persistent `anon_id`;
 *    when a valid access token exists it is attached so the backend can stitch
 *    the anon identity to the user.
 *  - Offline-safe: events are buffered in memory + AsyncStorage and flushed in
 *    batches (on a timer, when the buffer fills, and when the app backgrounds),
 *    so nothing is lost on a flaky connection or an app kill.
 *
 * Usage:
 *   import { analytics, track } from '../services/analytics';
 *   analytics.track('scan_started', { venue: slug });
 *   track('onboarding_step', { step: 'name' }); // legacy named export
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {AppState, Platform, type AppStateStatus} from 'react-native';
import DeviceInfo from 'react-native-device-info';

import {BACKEND_URL} from '../constants/onboarding';
import {STORAGE_KEYS} from '../core/constants/storage-keys';
import {getValidAccessToken} from '../utils/api/auth';

interface QueuedEvent {
  event_name: string;
  screen?: string;
  props?: Record<string, unknown>;
  session_id: string;
  anon_id: string;
  zone_id?: string;
  client_ts: string;
}

interface DeviceContext {
  platform: string;
  app_version: string;
  os_version: string;
  device_model: string;
}

const FLUSH_INTERVAL_MS = 15_000;
const MAX_BATCH = 50;
const MAX_QUEUE = 500; // bound memory + AsyncStorage footprint
const ENDPOINT = `${BACKEND_URL}/api/v1/analytics/batch`;

let anonId: string | null = null;
let sessionId = genId();
let currentScreen: string | undefined;
let activeZoneId: string | undefined;
let queue: QueuedEvent[] = [];
let device: DeviceContext | null = null;
let started = false;
let lastAppState: AppStateStatus = AppState.currentState;
let flushing = false;

function genId(): string {
  return [
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 10),
    Math.random().toString(36).slice(2, 10),
  ].join('-');
}

function safe(fn: () => string): string {
  try {
    return fn();
  } catch {
    return '';
  }
}

async function ensureAnonId(): Promise<string> {
  if (anonId) return anonId;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.ANALYTICS.ANON_ID);
    if (stored) {
      anonId = stored;
      return stored;
    }
  } catch {}
  const fresh = genId();
  anonId = fresh;
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ANALYTICS.ANON_ID, fresh);
  } catch {}
  return fresh;
}

function deviceContext(): DeviceContext {
  if (device) return device;
  device = {
    platform: Platform.OS,
    app_version: safe(() => DeviceInfo.getVersion()),
    os_version: String(Platform.Version),
    device_model: safe(() => DeviceInfo.getModel()),
  };
  return device;
}

async function persistQueue(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.ANALYTICS.QUEUE,
      JSON.stringify(queue),
    );
  } catch {}
}

async function restoreQueue(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ANALYTICS.QUEUE);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) queue = arr.slice(-MAX_QUEUE);
    }
  } catch {}
}

async function enqueue(
  eventName: string,
  props?: Record<string, unknown>,
): Promise<void> {
  try {
    const anon = await ensureAnonId();
    queue.push({
      event_name: eventName,
      screen: currentScreen,
      props,
      session_id: sessionId,
      anon_id: anon,
      zone_id: activeZoneId,
      client_ts: new Date().toISOString(),
    });
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    void persistQueue();
    if (queue.length >= MAX_BATCH) void flushQueue();
  } catch {}
}

async function flushQueue(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    const batch = queue.slice(0, MAX_BATCH);
    let token: string | null = null;
    try {
      token = await getValidAccessToken();
    } catch {}

    await axios.post(
      ENDPOINT,
      {device: deviceContext(), events: batch},
      {
        timeout: 10_000,
        headers: token ? {Authorization: `Bearer ${token}`} : undefined,
      },
    );

    // Drop only what we successfully sent; new events may have arrived meanwhile.
    queue = queue.slice(batch.length);
    void persistQueue();
  } catch {
    // Keep the events for the next attempt — best-effort, never throws.
  } finally {
    flushing = false;
  }
}

function onAppStateChange(next: AppStateStatus): void {
  if (next === 'background' || next === 'inactive') {
    void flushQueue();
  } else if (next === 'active' && lastAppState !== 'active') {
    // Returning to foreground starts a fresh session.
    sessionId = genId();
    void enqueue('app_foreground');
  }
  lastAppState = next;
}

export const analytics = {
  /** Initialize the pipeline once at app startup. Safe to call repeatedly. */
  async init(): Promise<void> {
    if (started) return;
    started = true;
    await ensureAnonId();
    await restoreQueue();
    sessionId = genId();
    setInterval(() => void flushQueue(), FLUSH_INTERVAL_MS);
    AppState.addEventListener('change', onAppStateChange);
    void enqueue('app_open');
    void flushQueue();
  },

  /** Record an event. Fire-and-forget. */
  track(eventName: string, props?: Record<string, unknown>): void {
    void enqueue(eventName, props);
  },

  /** Set the current screen so subsequent events carry it automatically. */
  setScreen(name?: string): void {
    currentScreen = name;
  },

  /** Set the active venue/zone UUID for venue-scoped events (or clear it). */
  setZone(zoneId?: string): void {
    activeZoneId = zoneId;
  },

  /**
   * Mark that the user just authenticated. Attribution is by token on the next
   * flush; this records the moment so funnels can pinpoint login/signup.
   */
  identify(userUuid?: string): void {
    void enqueue('identify', userUuid ? {user_uuid: userUuid} : undefined);
    void flushQueue();
  },

  /** Force a flush (e.g. before logout). */
  flush(): void {
    void flushQueue();
  },
};

/**
 * Legacy named export kept for existing call sites (onboarding screens).
 * Delegates to the full pipeline.
 */
export function track(
  event: string,
  props?: Record<string, unknown>,
): void {
  analytics.track(event, props);
}
