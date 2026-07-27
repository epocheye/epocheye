/**
 * StationAuthoringScreen — on-site AR authoring for the site-readiness pipeline.
 *
 * Admin-only. The author stands at the viewing spot, loads a reconstruction GLB,
 * places + aligns it in AR, then captures a hybrid anchor and saves a "viewing
 * station" so prod visitors can be guided to it and see the model world-locked:
 *
 *   1. Load model  → resolveModelGlb(model_id) → place ~1.2 m ahead (placeInFront)
 *   2. Align       → nudge yaw; walk a slow arc so ARCore/Geospatial converge
 *   3. Capture     → captureGeospatialPose() reads the model's WGS84 pose; the
 *                    current camera geospatial fix becomes the standing spot and
 *                    face bearing is derived (stand → model)
 *   4. Cloud lock  → hostCloudAnchor(365) for the cm-precise final lock (optional
 *                    but recommended; falls back to geospatial-only if skipped)
 *   5. Save        → POST /api/v1/ar/viewing-stations
 *
 * Gated so capture is only allowed once Earth is TRACKING with good accuracy.
 */
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import EpocheyeDetectARView, {
  type CloudAnchorEvent,
  type EpocheyeDetectARHandle,
  type GeospatialAnchorEvent,
  type GeospatialStateEvent,
} from '../../native/EpocheyeDetectARView';
import {resolveModelGlb} from '../../services/glbSource';
import {useActiveMonument} from '../../shared/hooks/useActiveMonument';
import {useSafeGoBack} from '../../shared/hooks/useSafeGoBack';
import {isAdminUser} from '../../shared/auth/isAdminUser';
import {useUserStore} from '../../stores/userStore';
import {bearingBetween} from '../../shared/utils/geo.utils';
import {upsertViewingStation} from '../../utils/api/ar';

// Author only when localisation is this good (metres / degrees).
const MAX_HORIZ_ACC_M = 2.5;
const MAX_YAW_ACC_DEG = 8;
const CLOUD_ANCHOR_TTL_DAYS = 365;

interface CapturedPose {
  lat: number;
  lng: number;
  alt: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  horizAcc?: number;
  yawAcc?: number;
}

const StationAuthoringScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const goBack = useSafeGoBack();
  const email = useUserStore(s => s.profile?.email);
  const activeMonument = useActiveMonument();
  const arRef = useRef<EpocheyeDetectARHandle>(null);

  const [monumentId, setMonumentId] = useState(activeMonument?.slug ?? '');
  const [modelId, setModelId] = useState('');
  const [title, setTitle] = useState('');
  const [viewRadiusMax, setViewRadiusMax] = useState('30');
  const [glbUri, setGlbUri] = useState<string | undefined>(undefined);
  const [placed, setPlaced] = useState(false);
  const [geo, setGeo] = useState<GeospatialStateEvent | null>(null);
  const [captured, setCaptured] = useState<CapturedPose | null>(null);
  const [cloudAnchorId, setCloudAnchorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const placedOnceRef = useRef(false);

  const tracking =
    geo?.earthState === 'ENABLED' && geo?.trackingState === 'TRACKING';
  const accuracyOk =
    tracking &&
    (geo?.horizontalAccuracy ?? 99) <= MAX_HORIZ_ACC_M &&
    (geo?.orientationYawAccuracy ?? 99) <= MAX_YAW_ACC_DEG;

  const loadAndPlace = useCallback(async () => {
    const id = modelId.trim();
    if (!id) {
      Alert.alert('Model required', 'Enter a model id to place.');
      return;
    }
    setBusy(true);
    try {
      const uri = await resolveModelGlb(id);
      if (!uri) {
        Alert.alert('Load failed', 'Could not resolve that model GLB.');
        return;
      }
      setGlbUri(uri);
      placedOnceRef.current = false;
      setPlaced(false);
      setCaptured(null);
    } catch {
      Alert.alert('Load failed', 'Could not load that model GLB.');
    } finally {
      setBusy(false);
    }
  }, [modelId]);

  // Once the model URI is set and AR is ready, auto-place it ~1.2 m ahead.
  const handleReady = useCallback(() => {
    if (glbUri && !placedOnceRef.current) {
      placedOnceRef.current = true;
      arRef.current?.placeInFront();
    }
  }, [glbUri]);

  const handleAnchorPlaced = useCallback(() => setPlaced(true), []);

  const handleGeoAnchorEvent = useCallback((e: GeospatialAnchorEvent) => {
    if (e.phase !== 'capture') {
      return;
    }
    if (e.state !== 'SUCCESS' || e.lat == null || e.lng == null) {
      Alert.alert('Capture failed', e.message ?? e.state);
      return;
    }
    setCaptured({
      lat: e.lat,
      lng: e.lng,
      alt: e.alt ?? 0,
      qx: e.qx ?? 0,
      qy: e.qy ?? 0,
      qz: e.qz ?? 0,
      qw: e.qw ?? 1,
      horizAcc: e.horizontalAccuracy,
      yawAcc: e.orientationYawAccuracy,
    });
  }, []);

  const handleCloudAnchorEvent = useCallback((e: CloudAnchorEvent) => {
    if (e.phase === 'host' && e.state === 'SUCCESS' && e.cloudAnchorId) {
      setCloudAnchorId(e.cloudAnchorId);
    }
  }, []);

  const save = useCallback(async () => {
    if (!captured) {
      return;
    }
    const slug = monumentId.trim();
    if (!slug) {
      Alert.alert('Site required', 'Enter the monument slug.');
      return;
    }
    // Standing spot = the author's current geospatial fix; facing = toward the model.
    const standLat = geo?.latitude;
    const standLng = geo?.longitude;
    const faceBearing =
      standLat != null && standLng != null
        ? bearingBetween(standLat, standLng, captured.lat, captured.lng)
        : undefined;
    const radiusMax = Number(viewRadiusMax) || 30;

    setBusy(true);
    try {
      const res = await upsertViewingStation({
        monument_id: slug,
        title: title.trim(),
        active: true,
        stand_lat: standLat ?? undefined,
        stand_lng: standLng ?? undefined,
        stand_alt: geo?.altitude ?? undefined,
        face_bearing_deg: faceBearing,
        view_radius_max_m: radiusMax,
        geo_lat: captured.lat,
        geo_lng: captured.lng,
        geo_alt: captured.alt,
        geo_qx: captured.qx,
        geo_qy: captured.qy,
        geo_qz: captured.qz,
        geo_qw: captured.qw,
        cloud_anchor_id: cloudAnchorId ?? undefined,
        model_id: modelId.trim(),
        captured_horiz_acc_m: captured.horizAcc,
        captured_yaw_acc_deg: captured.yawAcc,
      });
      if (res.success) {
        Alert.alert('Saved', 'Viewing station saved.', [
          {text: 'OK', onPress: () => goBack()},
        ]);
      } else if ('error' in res) {
        Alert.alert('Save failed', res.error.message);
      }
    } finally {
      setBusy(false);
    }
  }, [
    captured,
    monumentId,
    geo,
    viewRadiusMax,
    title,
    cloudAnchorId,
    modelId,
    goBack,
  ]);

  const statusLine = useMemo(() => {
    if (!geo) {
      return 'Move the phone so ARCore Geospatial starts…';
    }
    const acc =
      geo.horizontalAccuracy != null
        ? `±${geo.horizontalAccuracy.toFixed(1)}m · yaw ±${(
            geo.orientationYawAccuracy ?? 0
          ).toFixed(1)}°`
        : '';
    return `Earth: ${geo.earthState} · ${geo.trackingState} ${acc}`;
  }, [geo]);

  if (!isAdminUser(email)) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <EpocheyeDetectARView
        ref={arRef}
        style={StyleSheet.absoluteFill}
        glbUri={glbUri}
        geospatialEnabled
        cloudAnchorsEnabled
        onReady={handleReady}
        onAnchorPlaced={handleAnchorPlaced}
        onGeospatialState={setGeo}
        onGeospatialAnchorEvent={handleGeoAnchorEvent}
        onCloudAnchorEvent={handleCloudAnchorEvent}
      />

      <ScrollView
        style={[styles.panel, {paddingTop: insets.top + 8}]}
        contentContainerStyle={styles.panelContent}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Author viewing station</Text>
        <Text style={styles.status}>{statusLine}</Text>

        <Text style={styles.label}>Monument slug</Text>
        <TextInput
          style={styles.input}
          value={monumentId}
          onChangeText={setMonumentId}
          autoCapitalize="none"
          placeholder="e.g. bangalore-fort"
          placeholderTextColor="rgba(255,255,255,0.35)"
        />

        <Text style={styles.label}>Model id</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            value={modelId}
            onChangeText={setModelId}
            autoCapitalize="none"
            placeholder="GLB model id"
            placeholderTextColor="rgba(255,255,255,0.35)"
          />
          <Pressable
            onPress={loadAndPlace}
            disabled={busy}
            style={[styles.btn, busy && styles.btnDisabled]}>
            <Text style={styles.btnText}>Load</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Title (optional)</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Main gate reconstruction"
          placeholderTextColor="rgba(255,255,255,0.35)"
        />

        <Text style={styles.label}>Max view radius (m)</Text>
        <TextInput
          style={styles.input}
          value={viewRadiusMax}
          onChangeText={setViewRadiusMax}
          keyboardType="numeric"
          placeholder="30"
          placeholderTextColor="rgba(255,255,255,0.35)"
        />

        <View style={styles.actions}>
          <Pressable
            onPress={() => arRef.current?.nudgeYaw(15)}
            disabled={!placed}
            style={[styles.btnSecondary, !placed && styles.btnDisabled]}>
            <Text style={styles.btnSecondaryText}>Nudge yaw 15°</Text>
          </Pressable>

          <Pressable
            onPress={() => arRef.current?.captureGeospatialPose()}
            disabled={!placed || !accuracyOk}
            style={[
              styles.btn,
              (!placed || !accuracyOk) && styles.btnDisabled,
            ]}>
            <Text style={styles.btnText}>
              {captured ? 'Re-capture pose' : 'Capture pose'}
            </Text>
          </Pressable>
        </View>
        {!accuracyOk && placed ? (
          <Text style={styles.hint}>
            Waiting for accuracy ≤ {MAX_HORIZ_ACC_M} m / {MAX_YAW_ACC_DEG}° — walk
            a slow arc.
          </Text>
        ) : null}

        {captured ? (
          <Text style={styles.captured}>
            {`Captured: ${captured.lat.toFixed(6)}, ${captured.lng.toFixed(
              6,
            )} · horiz ±${(captured.horizAcc ?? 0).toFixed(1)}m`}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={() => arRef.current?.hostCloudAnchor(CLOUD_ANCHOR_TTL_DAYS)}
            disabled={!placed}
            style={[styles.btnSecondary, !placed && styles.btnDisabled]}>
            <Text style={styles.btnSecondaryText}>
              {cloudAnchorId ? 'Cloud anchor ✓' : 'Host cloud anchor'}
            </Text>
          </Pressable>

          <Pressable
            onPress={save}
            disabled={!captured || busy}
            style={[styles.btn, (!captured || busy) && styles.btnDisabled]}>
            <Text style={styles.btnText}>Save station</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => goBack()} style={styles.close}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  panel: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.6)',
  },
  panelContent: {padding: 16, gap: 6, paddingBottom: 48},
  title: {color: '#FFF', fontSize: 16, fontWeight: '700'},
  status: {color: '#8ED0FF', fontSize: 12, marginBottom: 6},
  label: {color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 6},
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    color: '#FFF',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  row: {flexDirection: 'row', gap: 8, alignItems: 'center'},
  flex: {flex: 1},
  actions: {flexDirection: 'row', gap: 8, marginTop: 10},
  btn: {
    backgroundColor: '#8ED0FF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    flex: 1,
  },
  btnText: {color: '#0A0A0A', fontSize: 13, fontWeight: '700'},
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(142,208,255,0.5)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    flex: 1,
  },
  btnSecondaryText: {color: '#8ED0FF', fontSize: 13, fontWeight: '700'},
  btnDisabled: {opacity: 0.35},
  hint: {color: 'rgba(255,220,150,0.9)', fontSize: 11, marginTop: 4},
  captured: {color: '#7BE38B', fontSize: 11, fontFamily: 'monospace', marginTop: 4},
  close: {alignSelf: 'center', marginTop: 16, padding: 8},
  closeText: {color: 'rgba(255,255,255,0.6)', fontSize: 13},
});

export default StationAuthoringScreen;
