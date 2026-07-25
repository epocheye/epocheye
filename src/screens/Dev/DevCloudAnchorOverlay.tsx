/**
 * DEV-ONLY Cloud Anchor test harness overlay (host / resolve round trip).
 *
 * Rendered by DetectArScreen's native AR path when the `devCloudAnchor` route
 * param is set (only ever passed by the dev Health-Check board). This file is
 * loaded via `__DEV__ ? require(...) : null`, so it is dead-code-eliminated
 * from release bundles entirely.
 *
 * Deliberately minimal test-harness UI: raw ARCore CloudAnchorState names are
 * shown verbatim so a misconfigured GCP project (ERROR_NOT_AUTHORIZED) is
 * self-diagnosing on-device.
 */

import React, {useEffect, useState} from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {CloudAnchorEvent} from '../../native/EpocheyeDetectARView';
import {STORAGE_KEYS} from '../../core/constants/storage-keys';

export interface DevCloudAnchorOverlayProps {
  /**
   * Cloud Anchor sub-mode. Undefined on the plain scan screen (admin overlay),
   * where only the VPS probe + depth-occlusion toggle show; 'host'/'resolve' are
   * set by the Health-Check board.
   */
  mode?: 'host' | 'resolve';
  /** ARCore camera TRACKING (resolve precondition). */
  tracking: boolean;
  /** status === 'placed' — a local anchor exists to host. */
  placed: boolean;
  /** Last onCloudAnchorEvent from native (null = idle / session rebuilt). */
  lastEvent: CloudAnchorEvent | null;
  onHost: (ttlDays: number) => void;
  onResolve: (cloudAnchorId: string) => void;
  /** Probe ARCore VPS availability at the device's CURRENT location; result is
   *  logged natively (tag "VPS"). */
  onCheckVps: () => void;
  // ADMIN-HARNESS (REMOVE AFTER KONARK)
  /** Current depth-occlusion toggle state. */
  depthOcclusion: boolean;
  /** Flip depth occlusion on the AR render path. */
  onToggleDepthOcclusion: (enabled: boolean) => void;
  /** Current Geospatial harness state (START/STOP). */
  geospatial: boolean;
  /** Start/stop ARCore Geospatial mode + Earth pose logging (native tag "GEO"). */
  onToggleGeospatial: (enabled: boolean) => void;
}

/** Extra operator hint for the states that always mean the same thing. */
function hintFor(state: string): string | null {
  switch (state) {
    case 'ERROR_NOT_AUTHORIZED':
      return 'GCP keyless setup missing? (ARCore API + Android OAuth client)';
    case 'ERROR_CLOUD_ID_NOT_FOUND':
      return 'wrong or expired anchor ID';
    case 'INSUFFICIENT_QUALITY':
      return 'walk a slow arc around the spot, then retry';
    default:
      return null;
  }
}

const HOST_TTL_DAYS = 365;
// Backgrounding mid-host/resolve has undocumented ARCore future behavior and a
// post-detach native event is silently swallowed — never trust that a terminal
// event arrives. After this long, treat the operation as dead and re-enable.
const WATCHDOG_MS = 60_000;

const DevCloudAnchorOverlay: React.FC<DevCloudAnchorOverlayProps> = ({
  mode,
  tracking,
  placed,
  lastEvent,
  onHost,
  onResolve,
  onCheckVps,
  depthOcclusion,
  onToggleDepthOcclusion,
  geospatial,
  onToggleGeospatial,
}) => {
  const [anchorId, setAnchorId] = useState('');
  const [hostedId, setHostedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  // Optimistic in-flight flag set on press — busy would otherwise stay false
  // during the JS→native→event round trip, leaving a double-tap window. Cleared
  // by the next native event (HOSTING/RESOLVING or an immediate error).
  const [localPending, setLocalPending] = useState(false);

  // Prefill the last hosted ID so the resolve flow works across an app kill.
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEYS.DEV.CLOUD_ANCHOR_ID).then(id => {
      if (!cancelled && id) setAnchorId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist + log the ID the moment hosting succeeds. The await-then-flag order
  // means "saved" on screen implies the write actually committed.
  useEffect(() => {
    if (
      lastEvent?.phase !== 'host' ||
      lastEvent.state !== 'SUCCESS' ||
      !lastEvent.cloudAnchorId
    ) {
      return;
    }
    const id = lastEvent.cloudAnchorId;
    setHostedId(id);
    setAnchorId(id);
    // Reset before the write so "(saved)" never shows for a NEW id while its
    // own write is still in flight (a second host reuses this mounted overlay).
    setSaved(false);
    console.log('[cloud-anchor] hosted:', id);
    void AsyncStorage.setItem(STORAGE_KEYS.DEV.CLOUD_ANCHOR_ID, id).then(() =>
      setSaved(true),
    );
  }, [lastEvent]);

  // Any native event (or the parent's session-rebuild reset to null) means the
  // dispatched command was answered — the optimistic flag hands over to it.
  useEffect(() => {
    setLocalPending(false);
  }, [lastEvent]);

  // Watchdog: any fresh event restarts the clock; a stuck HOSTING/RESOLVING
  // flips to timed-out so the harness never wedges. A retry press re-dispatches
  // and the native side cancel-and-replaces its stale future.
  const inFlight =
    localPending ||
    lastEvent?.state === 'HOSTING' ||
    lastEvent?.state === 'RESOLVING';
  useEffect(() => {
    setTimedOut(false);
    if (!inFlight) return;
    const timer = setTimeout(() => setTimedOut(true), WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [lastEvent, inFlight]);
  const busy = inFlight && !timedOut;

  let statusLine: string;
  if (timedOut) {
    statusLine = 'TIMED_OUT — no response from ARCore (app backgrounded?)';
  } else if (lastEvent) {
    const hint = hintFor(lastEvent.state);
    statusLine = [
      lastEvent.state,
      lastEvent.quality ? `quality ${lastEvent.quality}` : null,
      lastEvent.message ?? hint,
    ]
      .filter(Boolean)
      .join(' · ');
  } else if (mode === 'host') {
    statusLine = placed
      ? 'Model placed — walk a slow arc around it, then host'
      : 'Waiting for the test model to place…';
  } else if (mode === 'resolve') {
    statusLine = tracking
      ? 'Aim at the hosted spot, then resolve'
      : 'Move the phone until ARCore is tracking…';
  } else {
    // ADMIN-HARNESS (REMOVE AFTER KONARK) — mode-less admin tools (plain scan).
    statusLine = 'Admin tools · VPS probe + depth-occlusion toggle';
  }

  const canHost = placed && !busy;
  const canResolve = tracking && anchorId.trim().length > 0 && !busy;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.panel}>
        <Text style={styles.title}>
          {mode === 'host'
            ? 'Cloud Anchor — HOST'
            : mode === 'resolve'
              ? 'Cloud Anchor — RESOLVE'
              : 'AR admin tools'}
        </Text>
        <Text style={styles.status}>{statusLine}</Text>

        {mode === 'host' ? (
          <>
            {hostedId ? (
              <Text style={styles.anchorId} selectable>
                {hostedId}
                {saved ? '  (saved)' : ''}
              </Text>
            ) : null}
            <Pressable
              onPress={() => {
                setLocalPending(true);
                onHost(HOST_TTL_DAYS);
              }}
              disabled={!canHost}
              style={[styles.button, !canHost && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>
                {busy ? 'Hosting…' : `Host anchor (${HOST_TTL_DAYS}d)`}
              </Text>
            </Pressable>
          </>
        ) : mode === 'resolve' ? (
          <>
            <TextInput
              value={anchorId}
              onChangeText={setAnchorId}
              placeholder="cloud anchor id"
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Pressable
              onPress={() => {
                // adjustResize would otherwise resize the live AR surface and
                // jolt tracking right when resolve needs it most.
                Keyboard.dismiss();
                setLocalPending(true);
                onResolve(anchorId.trim());
              }}
              disabled={!canResolve}
              style={[styles.button, !canResolve && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>
                {busy ? 'Resolving…' : 'Resolve'}
              </Text>
            </Pressable>
          </>
        ) : null}

        {/* ADMIN-HARNESS (REMOVE AFTER KONARK)
            Depth-occlusion toggle — flips ARCore depth occlusion on the live
            render path so real-world geometry (a hand, a person) cuts into the
            model. Independent of host/resolve state. */}
        <Pressable
          onPress={() => onToggleDepthOcclusion(!depthOcclusion)}
          style={[
            styles.button,
            depthOcclusion ? styles.buttonToggleOn : styles.buttonSecondary,
          ]}>
          <Text
            style={
              depthOcclusion
                ? styles.buttonText
                : styles.buttonSecondaryText
            }>
            {`Depth occlusion: ${depthOcclusion ? 'ON' : 'OFF'}`}
          </Text>
        </Pressable>

        {/* ADMIN-HARNESS (REMOVE AFTER KONARK)
            Geospatial pipeline probe — START enables ARCore Geospatial mode
            (rebuilds the session) and logs Earth state + pose accuracies under
            native tag "GEO"; STOP restores the normal session. */}
        <Pressable
          onPress={() => onToggleGeospatial(!geospatial)}
          style={[
            styles.button,
            geospatial ? styles.buttonToggleOn : styles.buttonSecondary,
          ]}>
          <Text style={geospatial ? styles.buttonText : styles.buttonSecondaryText}>
            {`Geospatial tracking: ${geospatial ? 'STOP' : 'START'}`}
          </Text>
        </Pressable>

        {/* Independent VPS coverage probe — its own throwaway session, so it is
            never gated by the host/resolve busy state. Result → native log tag "VPS". */}
        <Pressable
          onPress={onCheckVps}
          style={[styles.button, styles.buttonSecondary]}>
          <Text style={styles.buttonSecondaryText}>Check VPS here</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    paddingTop: 108,
    paddingHorizontal: 16,
  },
  panel: {
    backgroundColor: 'rgba(10,10,10,0.82)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 12,
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  status: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  anchorId: {
    color: '#8ED0FF',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'monospace',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  button: {
    backgroundColor: '#8ED0FF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    color: '#1A0F00',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(142,208,255,0.5)',
  },
  // ADMIN-HARNESS (REMOVE AFTER KONARK)
  buttonToggleOn: {
    backgroundColor: '#7BE38B',
  },
  buttonSecondaryText: {
    color: '#8ED0FF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default DevCloudAnchorOverlay;
