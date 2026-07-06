/**
 * crashJournal — lightweight crash/stability diagnostics (dev AND release).
 *
 * Three layers:
 *   1. A global JS error handler (chained onto RN's default, so RedBox in dev
 *      and default fatal behaviour in release are preserved) that records
 *      fatal/non-fatal JS errors with the current route.
 *   2. An unhandled-promise-rejection tracker (Hermes native tracker when
 *      available, RN's promise polyfill otherwise).
 *   3. A native-crash breadcrumb: the current route is persisted on every
 *      navigation, and an AppState listener marks foreground/background. If a
 *      launch finds the previous session's breadcrumb still marked 'fg', that
 *      run died in the foreground without a recorded JS error — i.e. a native
 *      crash (like the Fabric/react-native-maps addViewAt crash) — and we
 *      journal it as 'native-suspected' with the screen it died on.
 *
 * Everything is best-effort and wrapped so this module can never throw or
 * change app behaviour. The journal is surfaced in the dev Health-Check
 * screen; in release the only visible output is analytics 'app_crash' events.
 */

import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../core/constants';
import { analytics } from './analytics';

export type CrashKind =
  | 'js-fatal'
  | 'js-nonfatal'
  | 'promise-rejection'
  | 'native-suspected';

export interface CrashEntry {
  kind: CrashKind;
  route?: string;
  message: string;
  stack?: string;
  fatal: boolean;
  ts: string;
  sessionId: string;
}

interface Breadcrumb {
  route?: string;
  sessionId: string;
  ts: string;
  state: 'fg' | 'bg' | 'js-crash';
}

const MAX_ENTRIES = 50;

const sessionId = `${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

let initialized = false;
let currentRoute: string | undefined;
let lastRunDeath: { kind: CrashKind; route?: string; ts: string } | null =
  null;

function writeBreadcrumb(state: Breadcrumb['state']): void {
  const crumb: Breadcrumb = {
    route: currentRoute,
    sessionId,
    ts: new Date().toISOString(),
    state,
  };
  AsyncStorage.setItem(
    STORAGE_KEYS.DIAGNOSTICS.CRASH_BREADCRUMB,
    JSON.stringify(crumb),
  ).catch(() => {});
}

async function appendEntry(entry: CrashEntry): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(
      STORAGE_KEYS.DIAGNOSTICS.CRASH_JOURNAL,
    );
    const list: CrashEntry[] = raw ? JSON.parse(raw) : [];
    list.push(entry);
    while (list.length > MAX_ENTRIES) list.shift();
    await AsyncStorage.setItem(
      STORAGE_KEYS.DIAGNOSTICS.CRASH_JOURNAL,
      JSON.stringify(list),
    );
  } catch {
    // Diagnostics must never break the app.
  }
}

function recordJsError(error: unknown, fatal: boolean, kind: CrashKind): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    // Mark the breadcrumb first so a fatal death isn't double-counted as
    // native-suspected on the next launch.
    if (fatal) writeBreadcrumb('js-crash');
    const entry: CrashEntry = {
      kind,
      route: currentRoute,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 20).join('\n'),
      fatal,
      ts: new Date().toISOString(),
      sessionId,
    };
    void appendEntry(entry);
    analytics.track('app_crash', {
      kind,
      fatal,
      route: currentRoute,
      message: err.message.slice(0, 200),
    });
  } catch {
    // Never throw from a crash handler.
  }
}

async function detectDirtyExit(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(
      STORAGE_KEYS.DIAGNOSTICS.CRASH_BREADCRUMB,
    );
    if (raw) {
      const prev: Breadcrumb = JSON.parse(raw);
      if (prev.sessionId !== sessionId && prev.state === 'fg') {
        // Previous run died in the foreground with no JS crash recorded →
        // almost certainly a native crash. Journal it with the screen name.
        lastRunDeath = {
          kind: 'native-suspected',
          route: prev.route,
          ts: prev.ts,
        };
        void appendEntry({
          kind: 'native-suspected',
          route: prev.route,
          message: `App died in foreground on "${prev.route ?? 'unknown'}" without a JS error (native crash suspected).`,
          fatal: true,
          ts: prev.ts,
          sessionId: prev.sessionId,
        });
        analytics.track('app_crash', {
          kind: 'native_suspected',
          fatal: true,
          route: prev.route,
        });
      } else if (prev.sessionId !== sessionId && prev.state === 'js-crash') {
        // Already journaled by the JS handler last session; surface it in the
        // banner but don't re-append.
        lastRunDeath = { kind: 'js-fatal', route: prev.route, ts: prev.ts };
      }
    }
  } catch {
    // best-effort
  } finally {
    writeBreadcrumb('fg');
  }
}

function installJsHandler(): void {
  try {
    const errorUtils = (globalThis as any)?.ErrorUtils;
    if (!errorUtils?.setGlobalHandler) return;
    const prevHandler = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      recordJsError(error, !!isFatal, isFatal ? 'js-fatal' : 'js-nonfatal');
      prevHandler?.(error, isFatal);
    });
  } catch {
    // best-effort
  }
}

function installRejectionTracker(): void {
  try {
    const hermes = (globalThis as any)?.HermesInternal;
    if (hermes?.enablePromiseRejectionTracker) {
      hermes.enablePromiseRejectionTracker({
        allRejections: true,
        onUnhandled: (_id: number, rejection: unknown) => {
          recordJsError(rejection, false, 'promise-rejection');
          if (__DEV__) {
            console.warn('[crashJournal] Unhandled promise rejection:', rejection);
          }
        },
        onHandled: () => {},
      });
      return;
    }
    // Non-Hermes fallback: RN's bundled promise polyfill.
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (_id: number, rejection: unknown) => {
        recordJsError(rejection, false, 'promise-rejection');
        if (__DEV__) {
          console.warn('[crashJournal] Unhandled promise rejection:', rejection);
        }
      },
      onHandled: () => {},
    });
  } catch {
    // best-effort
  }
}

/**
 * Install all handlers. Idempotent; call once at app module scope so the
 * handlers are live before first render.
 */
export function initCrashJournal(): void {
  if (initialized) return;
  initialized = true;
  installJsHandler();
  installRejectionTracker();
  void detectDirtyExit();
  try {
    AppState.addEventListener('change', state => {
      // OS kills of a *backgrounded* app are normal lifecycle, not crashes —
      // only foreground deaths should count as native-suspected.
      writeBreadcrumb(
        state === 'active' ? 'fg' : 'bg',
      );
    });
  } catch {
    // best-effort
  }
}

/** Fire-and-forget: called from the navigation state listeners. */
export function recordNavBreadcrumb(route: string): void {
  currentRoute = route;
  writeBreadcrumb('fg');
}

/** How the previous run ended, if it died. Cached from launch detection. */
export function getLastRunDeath(): {
  kind: CrashKind;
  route?: string;
  ts: string;
} | null {
  return lastRunDeath;
}

export async function getCrashJournal(): Promise<CrashEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(
      STORAGE_KEYS.DIAGNOSTICS.CRASH_JOURNAL,
    );
    const list: CrashEntry[] = raw ? JSON.parse(raw) : [];
    return list.reverse(); // newest first
  } catch {
    return [];
  }
}

export async function clearCrashJournal(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.DIAGNOSTICS.CRASH_JOURNAL);
  } catch {
    // best-effort
  }
}
