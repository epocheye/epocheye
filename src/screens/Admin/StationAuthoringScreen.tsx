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
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import {
  listViewingStations,
  upsertViewingStation,
  type ViewingStation,
} from '../../utils/api/ar';

// Author only when localisation is this good (metres / degrees).
const MAX_HORIZ_ACC_M = 2.5;
const MAX_YAW_ACC_DEG = 8;
// Absolute floor for an explicit override. The geospatial pose is the COARSE lock —
// a hosted cloud anchor is what makes it centimetre-precise — so a hard 2.5 m gate is
// stricter than the pipeline actually needs, and a site that only ever reports 2.6 m
// would otherwise be unauthorable. The achieved accuracy is stored either way
// (captured_horiz_acc_m / captured_yaw_acc_deg), so the quality signal is never lost.
const OVERRIDE_HORIZ_ACC_M = 6;
const OVERRIDE_YAW_ACC_DEG = 18;
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
  const [modelId, setModelId] = useState(
    // Convenience only: saves typing the id at the site. Any value can be entered.
    activeMonument?.slug === 'bangalore-fort' ? 'bangalore_fort_recon' : '',
  );
  const [title, setTitle] = useState('');
  const [viewRadiusMax, setViewRadiusMax] = useState('30');
  const [glbUri, setGlbUri] = useState<string | undefined>(undefined);
  const [placed, setPlaced] = useState(false);
  const [geo, setGeo] = useState<GeospatialStateEvent | null>(null);
  const [captured, setCaptured] = useState<CapturedPose | null>(null);
  const [cloudAnchorId, setCloudAnchorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState(false);
  // Correction workflow. Saving with no id INSERTS a new row, so re-authoring a
  // mis-placed station used to leave the bad one behind — and the prod screen
  // picks the NEAREST station, so the bad row could still win. Carrying the id
  // makes the save an UPDATE of the row you are fixing.
  const [existing, setExisting] = useState<ViewingStation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const placedOnceRef = useRef(false);

  const tracking =
    geo?.earthState === 'ENABLED' && geo?.trackingState === 'TRACKING';
  const accuracyIdeal =
    tracking &&
    (geo?.horizontalAccuracy ?? 99) <= MAX_HORIZ_ACC_M &&
    (geo?.orientationYawAccuracy ?? 99) <= MAX_YAW_ACC_DEG;
  const overrideAvailable =
    tracking &&
    !accuracyIdeal &&
    (geo?.horizontalAccuracy ?? 99) <= OVERRIDE_HORIZ_ACC_M &&
    (geo?.orientationYawAccuracy ?? 99) <= OVERRIDE_YAW_ACC_DEG;
  const accuracyOk = accuracyIdeal || (override && overrideAvailable);

  const refreshExisting = useCallback(async (slug: string) => {
    if (!slug.trim()) {
      setExisting([]);
      return;
    }
    const res = await listViewingStations(slug.trim());
    setExisting(res.success ? res.data.stations ?? [] : []);
  }, []);

  useEffect(() => {
    void refreshExisting(monumentId);
  }, [monumentId, refreshExisting]);

  /** Fix the station that is already there rather than stacking another on top. */
  const startCorrection = useCallback((station: ViewingStation) => {
    setEditingId(station.id);
    setTitle(station.title || '');
    if (station.model_id) setModelId(station.model_id);
    setViewRadiusMax(String(station.view_radius_max_m ?? 30));
    setCaptured(null);
    setCloudAnchorId(null);
    setPlaced(false);
    placedOnceRef.current = false;
    Alert.alert(
      'Correcting a station',
      'Re-place the model, capture a new pose and save. This UPDATES the existing station instead of adding a second one.',
    );
  }, []);

  /** Take a bad placement out of the visitor experience without deleting it. */
  const deactivate = useCallback(
    async (station: ViewingStation) => {
      setBusy(true);
      try {
        // The read type allows nulls where the write type wants undefined, so
        // the pose is copied field by field rather than spread — a spread would
        // also carry created_at/updated_at, which the write endpoint ignores.
        const res = await upsertViewingStation({
          id: station.id,
          monument_id: station.monument_id,
          title: station.title,
          active: false,
          stand_lat: station.stand_lat ?? undefined,
          stand_lng: station.stand_lng ?? undefined,
          stand_alt: station.stand_alt ?? undefined,
          face_bearing_deg: station.face_bearing_deg ?? undefined,
          view_radius_max_m: station.view_radius_max_m,
          geo_lat: station.geo_lat ?? undefined,
          geo_lng: station.geo_lng ?? undefined,
          geo_alt: station.geo_alt ?? undefined,
          geo_qx: station.geo_qx ?? undefined,
          geo_qy: station.geo_qy ?? undefined,
          geo_qz: station.geo_qz ?? undefined,
          geo_qw: station.geo_qw ?? undefined,
          cloud_anchor_id: station.cloud_anchor_id || undefined,
          model_id: station.model_id,
          model_scale: station.model_scale,
        });
        if (res.success) {
          Alert.alert(
            'Deactivated',
            'Visitors will no longer be guided to it. The row and its audit trail are kept.',
          );
          await refreshExisting(monumentId);
        } else if ('error' in res) {
          Alert.alert('Could not deactivate', res.error.message);
        }
      } finally {
        setBusy(false);
      }
    },
    [monumentId, refreshExisting],
  );

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
        // Present only when correcting: the backend inserts on a blank id and
        // updates on a real one.
        ...(editingId ? {id: editingId} : {}),
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
        // Surveyed reconstructions are authored at true scale, so the stored scale
        // is a 1.0 trim, not a normalisation target. See modelTrueScale.
        model_scale: 1,
        captured_horiz_acc_m: captured.horizAcc,
        captured_yaw_acc_deg: captured.yawAcc,
      });
      if (res.success) {
        Alert.alert(
          'Saved',
          editingId
            ? 'Viewing station corrected. The change is recorded against your account.'
            : 'Viewing station saved. The placement is recorded against your account.',
          [{text: 'OK', onPress: () => goBack()}],
        );
      } else if ('error' in res) {
        Alert.alert('Save failed', res.error.message);
      }
    } finally {
      setBusy(false);
    }
  }, [
    captured,
    editingId,
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
        // Author at the model's real size. Without this SceneView normalises the
        // GLB to `modelScale` metres across, and the pose captured below would
        // world-lock a scaled-down toy.
        modelTrueScale
        modelScale={1}
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

        {existing.length > 0 ? (
          <View style={styles.existingWrap}>
            <Text style={styles.label}>
              Already placed here ({existing.length})
            </Text>
            <Text style={styles.existingHint}>
              A visitor is guided to the NEAREST active station. If one of these
              is in the wrong place, correct it or take it down — do not just
              save another on top.
            </Text>
            {existing.map(st => (
              <View
                key={st.id}
                style={[
                  styles.existingRow,
                  editingId === st.id && styles.existingRowEditing,
                ]}>
                <View style={{flex: 1}}>
                  <Text style={styles.existingTitle} numberOfLines={1}>
                    {st.title || '(untitled)'}
                    {editingId === st.id ? '  · CORRECTING' : ''}
                  </Text>
                  <Text style={styles.existingMeta} numberOfLines={1}>
                    {st.model_id || 'no model'}
                    {st.captured_horiz_acc_m != null
                      ? ` · ±${st.captured_horiz_acc_m.toFixed(1)} m`
                      : ''}
                    {st.cloud_anchor_id ? ' · cloud' : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => startCorrection(st)}
                  disabled={busy}
                  style={styles.existingBtn}>
                  <Text style={styles.existingBtnText}>Correct</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void deactivate(st);
                  }}
                  disabled={busy}
                  style={[styles.existingBtn, styles.existingBtnDanger]}>
                  <Text style={styles.existingBtnText}>Off</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

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
            {`Waiting for accuracy ≤ ${MAX_HORIZ_ACC_M} m / ${MAX_YAW_ACC_DEG}° — walk a slow arc.`}
            {geo?.horizontalAccuracy != null
              ? ` Now ±${geo.horizontalAccuracy.toFixed(1)} m / ${(
                  geo.orientationYawAccuracy ?? 0
                ).toFixed(0)}°.`
              : ''}
          </Text>
        ) : null}

        {overrideAvailable && placed ? (
          <Pressable
            onPress={() => setOverride(v => !v)}
            style={[styles.btnSecondary, override && styles.btnOverrideOn]}>
            <Text style={styles.btnSecondaryText}>
              {override
                ? `Override ON — capturing at ±${(
                    geo?.horizontalAccuracy ?? 0
                  ).toFixed(1)} m (recorded)`
                : 'Capture anyway at this accuracy'}
            </Text>
          </Pressable>
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
  existingWrap: {marginTop: 6},
  existingHint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  existingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  existingRowEditing: {
    borderColor: 'rgba(224,167,60,0.7)',
    backgroundColor: 'rgba(224,167,60,0.12)',
  },
  existingTitle: {color: '#FFFFFF', fontSize: 13, fontWeight: '600'},
  existingMeta: {color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2},
  existingBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  existingBtnDanger: {borderColor: 'rgba(224,90,80,0.6)'},
  existingBtnText: {color: '#FFFFFF', fontSize: 12, fontWeight: '600'},
  btnOverrideOn: {borderColor: '#E0A73C', backgroundColor: 'rgba(224,167,60,0.16)'},
  btnDisabled: {opacity: 0.35},
  hint: {color: 'rgba(255,220,150,0.9)', fontSize: 11, marginTop: 4},
  captured: {color: '#7BE38B', fontSize: 11, fontFamily: 'monospace', marginTop: 4},
  close: {alignSelf: 'center', marginTop: 16, padding: 8},
  closeText: {color: 'rgba(255,255,255,0.6)', fontSize: 13},
});

export default StationAuthoringScreen;
