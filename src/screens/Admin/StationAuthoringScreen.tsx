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
  type ElementTappedEvent,
  type EpocheyeDetectARHandle,
  type GeospatialAnchorEvent,
  type GeospatialStateEvent,
} from '../../native/EpocheyeDetectARView';
import {buildGlbUrl} from '../../config/glbDelivery';
import {
  discoveryLayerFor,
  scaleDiscoveryLayer,
} from '../../features/ar/discoveryLayers';
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

// Preview scales. Bangalore Fort is 47 x 48 x 13.5 m, so no single size answers
// every question indoors: TABLETOP shows the whole plan at once but its cards are
// 2 cm wide, WALK_IN makes the cards legible at the cost of seeing it all.
// TRUE_SCALE is the only value a pose may be captured at.
const TRUE_SCALE = 1;
const WALK_IN_SCALE = 0.1;
const TABLETOP_SCALE = 0.02;
const PREVIEW_CYCLE = [TRUE_SCALE, WALK_IN_SCALE, TABLETOP_SCALE];

function scaleLabel(k: number): string {
  if (k === TRUE_SCALE) return 'TRUE SCALE (47 m) — tap to shrink';
  if (k === WALK_IN_SCALE) return 'WALK-IN 1:10 (~4.8 m) — tap to shrink';
  return 'TABLETOP 1:50 (~1 m) — tap for true scale';
}

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
  // The form is a full-screen scrim over the camera. Aligning the reconstruction
  // against the real walls needs an unobstructed view, so it can be folded away
  // to a single pill without losing any entered state.
  const [panelHidden, setPanelHidden] = useState(false);
  // The native view emits real diagnostics ("not tracking yet", "model load
  // failed", "anchor creation failed") that nothing was listening for, so every
  // placement failure looked like the button doing nothing at all.
  const [arError, setArError] = useState<string | null>(null);
  const [planeFound, setPlaneFound] = useState(false);
  // Coarse gets the model roughly onto the wall; fine seats it. A single step
  // size cannot do both — 1 m is uselessly blunt at the end, 10 cm is an hour of
  // tapping at the start.
  const [coarse, setCoarse] = useState(true);
  // Desk preview. At true scale this reconstruction is 47 x 48 x 13.5 m, so
  // indoors you stand inside a wall and cannot judge whether the model, its
  // cards or its orientation are right at all.
  //
  // modelTrueScale stays ON in every mode and `modelScale` is used as a plain
  // multiplier, so ONE factor governs the model, the card positions, the card
  // widths and the tap-target boxes. (Normalising instead — modelTrueScale off —
  // would size the model from its bounding box and leave no factor to apply to
  // the layer.)
  const [previewScale, setPreviewScale] = useState<number>(TRUE_SCALE);
  const [showCards, setShowCards] = useState(false);
  const [tapped, setTapped] = useState<{
    title: string;
    meta?: string;
    body?: string;
  } | null>(null);
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

  /**
   * Ask native to put the model ~1.2 m ahead. Safe to call before the GLB prop
   * has reached native or before the camera is TRACKING: `tryPlacePending`
   * latches the request and runs it once BOTH preconditions hold (it is invoked
   * from placeInFront, setGlbUri and every frame), so JS never has to sequence
   * the prop update against the command.
   */
  const step = coarse ? 1 : 0.1;
  const yawStep = coarse ? 15 : 2;
  /**
   * Any alignment change invalidates an already-captured pose. Without this you
   * can capture, then keep nudging, then Save — and the station is written with
   * the pose from BEFORE the nudges, with nothing on screen saying so.
   */
  const invalidateCapture = useCallback(() => {
    setCaptured(prev => {
      if (prev) {
        setArError('Alignment changed — capture the pose again before saving.');
      }
      return null;
    });
  }, []);

  const move = useCallback(
    (dx: number, dy: number, dz: number) => {
      arRef.current?.nudgeModel(dx, dy, dz);
      invalidateCapture();
    },
    [invalidateCapture],
  );

  const rotate = useCallback(
    (deg: number) => {
      arRef.current?.nudgeYaw(deg);
      invalidateCapture();
    },
    [invalidateCapture],
  );

  const requestPlacement = useCallback(() => {
    placedOnceRef.current = true;
    setPlaced(false);
    arRef.current?.placeInFront();
  }, []);

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
        Alert.alert(
          'Load failed',
          `No GLB for "${id}". Expected ${buildGlbUrl(id) ?? '(no GLB_BASE_URL in this build)'}`,
        );
        return;
      }
      setGlbUri(uri);
      setCaptured(null);
      // Issue the placement HERE, not only from onARReady. onARReady fires on
      // the first ARCore session tick — seconds after the screen opens and long
      // before a model id has been typed — so a handler that only placed on
      // ready could never fire for a model loaded afterwards, and Load appeared
      // to do nothing at all.
      requestPlacement();
    } catch {
      Alert.alert('Load failed', 'Could not load that model GLB.');
    } finally {
      setBusy(false);
    }
  }, [modelId, requestPlacement]);

  // Covers the reverse order only: a model already resolved when AR becomes
  // ready (e.g. a fast re-entry). The Load path places on its own.
  const handleReady = useCallback(() => {
    if (glbUri && !placedOnceRef.current) {
      requestPlacement();
    }
  }, [glbUri, requestPlacement]);

  // Scale is read natively at PLACEMENT time, so changing it only takes effect
  // on the next place. Re-place from an effect rather than from the press
  // handler, so the new prop has reached native before the command goes.
  const previewScaleRef = useRef(previewScale);
  useEffect(() => {
    if (previewScaleRef.current === previewScale) return;
    previewScaleRef.current = previewScale;
    if (glbUri) requestPlacement();
  }, [previewScale, glbUri, requestPlacement]);

  /**
   * Put the authored discovery layer on the current anchor at the current
   * preview scale. The cards hang off the ANCHOR rather than the model node, so
   * they must be scaled by the same factor the model is rendered at or a 1 m
   * tabletop fort keeps its cards 48 m apart, out through the walls.
   */
  const layer = useMemo(
    () => discoveryLayerFor(monumentId.trim() || null),
    [monumentId],
  );

  const placeCards = useCallback(() => {
    if (!layer) {
      Alert.alert(
        'No discovery layer',
        `No authored cards for "${monumentId.trim()}".`,
      );
      return;
    }
    const scaled = scaleDiscoveryLayer(layer, previewScale);
    arRef.current?.setTapTargets(JSON.stringify(scaled.tapTargets));
    arRef.current?.placeDiscoveryCards(JSON.stringify(scaled.cards));
  }, [layer, monumentId, previewScale]);

  // Re-place the layer whenever it is on and the anchor or scale changed — the
  // native call attaches to whatever anchor is current, so a re-placed model
  // leaves the old cards behind otherwise.
  useEffect(() => {
    if (!showCards || !placed) return;
    placeCards();
  }, [showCards, placed, previewScale, placeCards]);

  const handleElementTapped = useCallback((e: ElementTappedEvent) => {
    let payload: {title?: string; meta?: string; body?: string; label?: string} =
      {};
    try {
      payload = e.payload ? JSON.parse(e.payload) : {};
    } catch {
      payload = {};
    }
    setTapped({
      title: payload.title || payload.label || e.id,
      meta: payload.meta,
      body: payload.body,
    });
  }, []);

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
    if (e.phase !== 'host') return;
    if (e.state === 'SUCCESS' && e.cloudAnchorId) {
      setCloudAnchorId(e.cloudAnchorId);
      setArError(null);
      return;
    }
    if (e.state === 'HOSTING') {
      setArError(`Hosting cloud anchor… (map quality ${e.quality ?? '?'})`);
      return;
    }
    // Every other terminal state is a FAILURE, and it used to be dropped on the
    // floor: the button still read "Host cloud anchor", nothing said the 365-day
    // lock had not happened, and the station would be saved geospatial-only
    // without anyone knowing. ERROR_NOT_AUTHORIZED here means the 365-day TTL was
    // refused — the anchor was not stored.
    setCloudAnchorId(null);
    setArError(
      `CLOUD ANCHOR FAILED: ${e.state}${e.message ? ` — ${e.message}` : ''}`,
    );
    Alert.alert(
      'Cloud anchor not hosted',
      `${e.state}${e.message ? `\n\n${e.message}` : ''}\n\n` +
        'You can still save: the station will be geospatial-only, which is less ' +
        'precise but correctly placed. Do not assume it was hosted.',
    );
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
    // Surface state first: it is the difference between a model that rests on a
    // real plane and one pinned to empty air, which drifts and tips away.
    const surface = planeFound
      ? 'Surface ✓'
      : 'NO SURFACE YET — sweep the phone slowly across a textured area';
    if (!geo) {
      return `${surface} · Move the phone so ARCore Geospatial starts…`;
    }
    const acc =
      geo.horizontalAccuracy != null
        ? `±${geo.horizontalAccuracy.toFixed(1)}m · yaw ±${(
            geo.orientationYawAccuracy ?? 0
          ).toFixed(1)}°`
        : '';
    return `${surface} · Earth: ${geo.earthState} · ${geo.trackingState} ${acc}`;
  }, [geo, planeFound]);

  if (!isAdminUser(email)) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <EpocheyeDetectARView
        ref={arRef}
        style={StyleSheet.absoluteFill}
        glbUri={glbUri}
        // Always true-scale semantics: modelScale is a plain multiplier here, not
        // a normalisation target. 1 = as surveyed (the only value a pose may be
        // captured at); the preview scales shrink model AND layer by one factor.
        modelTrueScale
        modelScale={previewScale}
        onElementTapped={handleElementTapped}
        geospatialEnabled
        cloudAnchorsEnabled
        onReady={handleReady}
        onError={setArError}
        // The plane grid is deliberately hidden, so without this there is no way
        // to tell "ARCore has found a surface" from "it never will" — which is
        // exactly the state that made the model float in mid-air and drift.
        onPlaneDetected={() => setPlaneFound(true)}
        onAnchorPlaced={handleAnchorPlaced}
        onGeospatialState={setGeo}
        onGeospatialAnchorEvent={handleGeoAnchorEvent}
        onCloudAnchorEvent={handleCloudAnchorEvent}
      />

      {panelHidden ? (
        <View style={[styles.hiddenBar, {top: insets.top + 8}]}>
          <Text style={styles.hiddenStatus} numberOfLines={1}>
            {statusLine}
          </Text>
          {arError ? (
            <Text style={styles.arError} numberOfLines={2}>
              AR: {arError}
            </Text>
          ) : null}
          <View style={styles.hiddenActions}>
            <Pressable
              onPress={() => arRef.current?.nudgeYaw(15)}
              disabled={!placed}
              style={[styles.btnSecondary, !placed && styles.btnDisabled]}>
              <Text style={styles.btnSecondaryText}>Yaw 15°</Text>
            </Pressable>
            <Pressable
              onPress={() => setPanelHidden(false)}
              style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>Show panel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          style={[styles.panel, {paddingTop: insets.top + 8}]}
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Author viewing station</Text>
          <Text style={styles.status}>{statusLine}</Text>
          {arError ? <Text style={styles.arError}>AR: {arError}</Text> : null}

          <Pressable
            onPress={() => setPanelHidden(true)}
            style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>
              Hide panel (see the model)
            </Text>
          </Pressable>

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

        {glbUri ? (
          <Text style={styles.status} numberOfLines={1}>
            {`GLB ✓ ${glbUri.startsWith('file://') ? 'cached' : 'remote'} · ${glbUri.split('/').pop()}`}
          </Text>
        ) : null}

        {glbUri ? (
          <View style={styles.row}>
            <Pressable
              onPress={() =>
                setPreviewScale(k => {
                  const i = PREVIEW_CYCLE.indexOf(k);
                  return PREVIEW_CYCLE[(i + 1) % PREVIEW_CYCLE.length];
                })
              }
              style={[
                styles.btnSecondary,
                styles.flex,
                previewScale !== TRUE_SCALE && styles.btnOverrideOn,
              ]}>
              <Text style={styles.btnSecondaryText}>
                {scaleLabel(previewScale)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowCards(v => !v)}
              style={[styles.btnSecondary, showCards && styles.btnOverrideOn]}>
              <Text style={styles.btnSecondaryText}>
                {showCards ? 'Cards ✓' : 'Show cards'}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {previewScale !== TRUE_SCALE ? (
          <Text style={styles.hint}>
            Preview only — the fort and its cards are scaled together. Saving is
            blocked: a pose captured at this scale would world-lock a toy.
          </Text>
        ) : null}

        {glbUri && !placed ? (
          <Text style={styles.hint}>
            Model loaded. It drops in as soon as the camera is TRACKING — sweep
            the phone slowly across a textured surface. Still nothing? Tap
            Re-place.
          </Text>
        ) : null}

        {/* Alignment pad — the on-site job. The anchor lands where you stand, so
            the model has to be walked onto the real wall in both rotation AND
            translation. Every adjustment here is folded into the pose that gets
            saved, so what you line up is what a visitor sees. */}
        {placed ? (
          <View style={styles.alignWrap}>
            <Text style={styles.label}>
              ALIGN TO THE REAL WALL{' '}
              {coarse ? '· 1 m / 15°' : '· 10 cm / 2°'}
            </Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => setCoarse(c => !c)}
                style={[styles.btnSecondary, styles.flex]}>
                <Text style={styles.btnSecondaryText}>
                  {coarse ? 'COARSE — tap for fine' : 'FINE — tap for coarse'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  arRef.current?.resetAlignment();
                  invalidateCapture();
                }}
                style={styles.btnSecondary}>
                <Text style={styles.btnSecondaryText}>Reset</Text>
              </Pressable>
            </View>

            <View style={styles.row}>
              <Pressable onPress={() => move(-step, 0, 0)} style={[styles.pad, styles.flex]}>
                <Text style={styles.padText}>◀ West</Text>
              </Pressable>
              <Pressable onPress={() => move(step, 0, 0)} style={[styles.pad, styles.flex]}>
                <Text style={styles.padText}>East ▶</Text>
              </Pressable>
            </View>
            <View style={styles.row}>
              <Pressable onPress={() => move(0, 0, -step)} style={[styles.pad, styles.flex]}>
                <Text style={styles.padText}>▲ Fwd</Text>
              </Pressable>
              <Pressable onPress={() => move(0, 0, step)} style={[styles.pad, styles.flex]}>
                <Text style={styles.padText}>▼ Back</Text>
              </Pressable>
            </View>
            <View style={styles.row}>
              <Pressable onPress={() => move(0, step, 0)} style={[styles.pad, styles.flex]}>
                <Text style={styles.padText}>↑ Up</Text>
              </Pressable>
              <Pressable onPress={() => move(0, -step, 0)} style={[styles.pad, styles.flex]}>
                <Text style={styles.padText}>↓ Down</Text>
              </Pressable>
            </View>
            <View style={styles.row}>
              <Pressable
                onPress={() => rotate(-yawStep)}
                style={[styles.pad, styles.flex]}>
                <Text style={styles.padText}>↺ {yawStep}°</Text>
              </Pressable>
              <Pressable
                onPress={() => rotate(yawStep)}
                style={[styles.pad, styles.flex]}>
                <Text style={styles.padText}>{yawStep}° ↻</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>
              Aim: the reconstruction's stone base meets the crest of the real
              wall — 5.39 m on the Delhi Gate run, 7.39 m on the other.
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={requestPlacement}
            disabled={!glbUri}
            style={[styles.btnSecondary, !glbUri && styles.btnDisabled]}>
            <Text style={styles.btnSecondaryText}>
              {placed ? 'Re-place' : 'Place'}
            </Text>
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
            disabled={!captured || busy || previewScale !== TRUE_SCALE}
            style={[
              styles.btn,
              (!captured || busy || previewScale !== TRUE_SCALE) &&
                styles.btnDisabled,
            ]}>
            <Text style={styles.btnText}>
              {previewScale !== TRUE_SCALE
                ? 'Save (blocked in preview)'
                : 'Save station'}
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={() => goBack()} style={styles.close}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
        </ScrollView>
      )}

      {/* Tap result — proves the 135 tap-target boxes and the card quads
          actually resolve, which nothing has ever exercised. */}
      {tapped ? (
        <Pressable
          onPress={() => setTapped(null)}
          style={[styles.tapSheet, {paddingBottom: insets.bottom + 16}]}>
          <Text style={styles.tapTitle}>{tapped.title}</Text>
          {tapped.meta ? (
            <Text style={styles.tapMeta}>{tapped.meta}</Text>
          ) : null}
          {tapped.body ? (
            <Text style={styles.tapBody} numberOfLines={6}>
              {tapped.body}
            </Text>
          ) : null}
          <Text style={styles.tapDismiss}>Tap to dismiss</Text>
        </Pressable>
      ) : null}
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
  hiddenBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: 'rgba(10,10,10,0.75)',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  hiddenStatus: {color: '#8ED0FF', fontSize: 12},
  arError: {color: '#FFB4A2', fontSize: 12},
  alignWrap: {
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.45)',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginTop: 8,
  },
  pad: {
    backgroundColor: 'rgba(201,168,76,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.45)',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  padText: {color: '#F5F0E8', fontSize: 14, fontWeight: '700'},
  tapSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,10,10,0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(201,168,76,0.5)',
    padding: 16,
    gap: 4,
  },
  tapTitle: {color: '#F5F0E8', fontSize: 16, fontWeight: '700'},
  tapMeta: {color: '#C9A84C', fontSize: 11, letterSpacing: 0.6},
  tapBody: {color: 'rgba(245,240,232,0.82)', fontSize: 13, lineHeight: 19},
  tapDismiss: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 6,
  },
  hiddenActions: {flexDirection: 'row', gap: 8},
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
