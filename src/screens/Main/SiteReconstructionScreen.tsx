/**
 * SiteReconstructionScreen — the prod "site-readiness" experience.
 *
 * Loads the viewing stations an admin authored for this site, guides the visitor
 * to the nearest one (distance + a bearing arrow + turn cues from the device
 * compass), then world-locks the reconstruction:
 *
 *   guiding   → walk to the standing spot / face the right way
 *   resolving → within range + Earth TRACKING with good accuracy → place the
 *               model at the geospatial (WGS84) anchor, then snap to the Cloud
 *               Anchor (cm) if the station has one
 *   locked    → reconstruction shown in place
 *
 * Fine placement precision comes from Geospatial + Cloud Anchor, not GPS — the
 * GPS guidance only needs to walk the visitor into view range.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {X} from 'lucide-react-native';

import EpocheyeDetectARView, {
  isDetectARAvailable,
  type EpocheyeDetectARHandle,
  type GeospatialAnchorEvent,
  type GeospatialStateEvent,
} from '../../native/EpocheyeDetectARView';
import type {ViewingStation} from '../../utils/api/ar';
import {listViewingStations} from '../../utils/api/ar';
import {resolveModelGlb} from '../../services/glbSource';
import ARSafetyNotice from '../../components/ui/ARSafetyNotice';
import {useActiveMonument} from '../../shared/hooks/useActiveMonument';
import {usePlacesStore} from '../../stores/placesStore';
import {useARSafetyGate} from '../../shared/hooks/useARSafetyGate';
import {useHeading} from '../../shared/hooks/useHeading';
import {
  bearingBetween,
  calculateDistance,
  formatDistance,
  formatTurnInstruction,
  relativeBearing,
} from '../../shared/utils/geo.utils';
import type {MainScreenProps} from '../../core/types/navigation.types';

const MAX_HORIZ_ACC_M = 3;
const MAX_YAW_ACC_DEG = 12;

type Phase = 'loading' | 'none' | 'error' | 'guiding' | 'resolving' | 'locked';

function standCoords(s: ViewingStation): {lat: number; lng: number} | null {
  const lat = s.stand_lat ?? s.geo_lat;
  const lng = s.stand_lng ?? s.geo_lng;
  if (lat == null || lng == null) {
    return null;
  }
  return {lat, lng};
}

const SiteReconstructionScreen: React.FC<
  MainScreenProps<'SiteReconstruction'>
> = ({route}) => {
  // Families-policy safety gate. `safety.exit` is the safe-back callback (and
  // owns the Android hardware-back interception for this camera screen), so it
  // doubles as this screen's close handler.
  const safety = useARSafetyGate();
  const goBack = safety.exit;
  const activeMonument = useActiveMonument();
  const slug = route.params?.venueSlug ?? activeMonument?.slug ?? null;
  const arRef = useRef<EpocheyeDetectARHandle>(null);

  const loc = usePlacesStore(s => s.currentLocation);
  const [phase, setPhase] = useState<Phase>('loading');
  const [target, setTarget] = useState<ViewingStation | null>(null);
  const [glbUri, setGlbUri] = useState<string | undefined>(undefined);
  const [geo, setGeo] = useState<GeospatialStateEvent | null>(null);
  const resolvedRef = useRef(false);
  const pendingStationsRef = useRef<ViewingStation[] | null>(null);

  const heading = useHeading(
    loc ? {latitude: loc.latitude, longitude: loc.longitude} : null,
    phase === 'guiding',
  );

  // 1. Load the site's stations.
  useEffect(() => {
    if (!isDetectARAvailable) {
      // Non-ARCore device — geospatial resolve isn't possible here.
      setPhase('error');
      return;
    }
    if (!slug) {
      setPhase('none');
      return;
    }
    let cancelled = false;
    void listViewingStations(slug).then(res => {
      if (cancelled) {
        return;
      }
      if (!res.success) {
        setPhase('error');
        return;
      }
      const stations = res.data.stations ?? [];
      if (stations.length === 0) {
        setPhase('none');
        return;
      }
      setPhase('guiding');
      // Remember the stations so the nearest can be chosen once we have a fix.
      pendingStationsRef.current = stations;
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // 2. Pick the nearest station once (frozen so guidance doesn't flip-flop).
  useEffect(() => {
    if (target || !loc) {
      return;
    }
    const stations = pendingStationsRef.current;
    if (!stations || stations.length === 0) {
      return;
    }
    let best: ViewingStation | null = null;
    let bestD = Infinity;
    for (const s of stations) {
      const c = standCoords(s);
      if (!c) {
        continue;
      }
      const d = calculateDistance(loc.latitude, loc.longitude, c.lat, c.lng);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    setTarget(best ?? stations[0]);
  }, [target, loc, phase]);

  // 3. Resolve the target's model GLB.
  useEffect(() => {
    const id = target?.model_id;
    if (!id) {
      return;
    }
    let cancelled = false;
    void resolveModelGlb(id).then(uri => {
      if (!cancelled && uri) {
        setGlbUri(uri);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [target?.model_id]);

  // Guidance geometry.
  const stand = target ? standCoords(target) : null;
  const distance =
    loc && stand
      ? calculateDistance(loc.latitude, loc.longitude, stand.lat, stand.lng)
      : null;
  const bearing =
    loc && stand
      ? bearingBetween(loc.latitude, loc.longitude, stand.lat, stand.lng)
      : null;
  const rel =
    bearing != null && heading != null
      ? relativeBearing(bearing, heading.heading)
      : null;
  const maxR = target?.view_radius_max_m ?? 30;
  const inRange = distance != null && distance <= maxR;
  const tracking =
    geo?.earthState === 'ENABLED' && geo?.trackingState === 'TRACKING';
  const accuracyOk =
    tracking &&
    (geo?.horizontalAccuracy ?? 99) <= MAX_HORIZ_ACC_M &&
    (geo?.orientationYawAccuracy ?? 99) <= MAX_YAW_ACC_DEG;

  // 4. When in range + localised, place the geospatial anchor.
  useEffect(() => {
    if (phase !== 'guiding' || !target || resolvedRef.current) {
      return;
    }
    if (!inRange || !accuracyOk) {
      return;
    }
    if (target.geo_lat == null || target.geo_lng == null) {
      return;
    }
    resolvedRef.current = true;
    setPhase('resolving');
    arRef.current?.placeGeospatialAnchor(
      target.geo_lat,
      target.geo_lng,
      target.geo_alt ?? 0,
      target.geo_qx ?? 0,
      target.geo_qy ?? 0,
      target.geo_qz ?? 0,
      target.geo_qw ?? 1,
    );
  }, [phase, target, inRange, accuracyOk]);

  const handleGeoAnchor = useCallback(
    (e: GeospatialAnchorEvent) => {
      if (e.phase !== 'place') {
        return;
      }
      if (e.state === 'SUCCESS') {
        // cm snap when the station has a live (non-expired) cloud anchor. If it's
        // missing or expired the model stays at the geospatial pose — degraded but
        // never absent (the 365-day TTL is refreshed by re-authoring).
        const expiry = target?.cloud_anchor_expiry
          ? Date.parse(target.cloud_anchor_expiry)
          : NaN;
        const cloudLive =
          !!target?.cloud_anchor_id &&
          (Number.isNaN(expiry) || expiry > Date.now());
        if (cloudLive && target?.cloud_anchor_id) {
          arRef.current?.resolveCloudAnchor(target.cloud_anchor_id);
        }
        setPhase('locked');
      } else {
        // Placement failed — let the visitor try again.
        resolvedRef.current = false;
        setPhase('guiding');
      }
    },
    [target],
  );

  const banner = useMemo(() => {
    switch (phase) {
      case 'loading':
        return 'Loading…';
      case 'none':
        return 'No reconstruction is set up here yet.';
      case 'error':
        return 'Could not load this site.';
      case 'resolving':
        return 'Hold steady — locking the reconstruction in place…';
      case 'locked':
        return target?.title || 'Reconstruction in place';
      case 'guiding': {
        if (distance == null) {
          return 'Finding your position…';
        }
        if (inRange && !accuracyOk) {
          return 'You’re here — move the phone slowly to lock on…';
        }
        const turn =
          rel != null ? formatTurnInstruction(rel) : 'Point the phone around';
        return `${formatDistance(distance)} away · ${turn}`;
      }
    }
  }, [phase, distance, inRange, accuracyOk, rel, target]);

  const showAr = phase === 'resolving' || phase === 'locked' || inRange;

  // Families-policy gate (Google Play): the safety warning is the FIRST thing
  // rendered when this AR section opens — before the station data has loaded and
  // regardless of how far the visitor is from a viewing station — so it is
  // reachable off-site. A Play reviewer is never physically at a heritage site,
  // so a warning gated behind `showAr` would be a warning they could never see.
  // Nothing below this line mounts until "I understand" is tapped, so the ARCore
  // camera can never appear first.
  if (!safety.acknowledged) {
    return (
      <ARSafetyNotice
        onAcknowledge={safety.acknowledge}
        onExit={safety.exit}
      />
    );
  }

  return (
    <View style={styles.root}>
      {showAr ? (
        <EpocheyeDetectARView
          ref={arRef}
          style={StyleSheet.absoluteFill}
          glbUri={glbUri}
          geospatialEnabled
          cloudAnchorsEnabled={!!target?.cloud_anchor_id}
          onGeospatialState={setGeo}
          onGeospatialAnchorEvent={handleGeoAnchor}
        />
      ) : (
        <View style={styles.mapPlaceholder} />
      )}

      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable onPress={() => goBack()} hitSlop={12} style={styles.close}>
            <X size={18} color="#FFF" />
          </Pressable>
          <View style={styles.bannerWrap}>
            <Text style={styles.banner}>{banner}</Text>
          </View>
        </View>

        {phase === 'guiding' && rel != null && !inRange ? (
          <View style={styles.arrowWrap} pointerEvents="none">
            <Text style={[styles.arrow, {transform: [{rotate: `${rel}deg`}]}]}>
              ↑
            </Text>
          </View>
        ) : null}

        {phase === 'resolving' ? (
          <View style={styles.center} pointerEvents="none">
            <ActivityIndicator color="#8ED0FF" />
          </View>
        ) : null}
      </SafeAreaView>

      {(phase === 'none' || phase === 'error') && (
        <View style={styles.center}>
          <Pressable onPress={() => goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>Go back</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  mapPlaceholder: {...StyleSheet.absoluteFillObject, backgroundColor: '#0A0A0A'},
  overlay: {...StyleSheet.absoluteFillObject},
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bannerWrap: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.7)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  banner: {color: '#FFF', fontSize: 14, fontWeight: '600'},
  arrowWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  arrow: {color: '#8ED0FF', fontSize: 120, fontWeight: '900'},
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backText: {color: '#FFF', fontSize: 14, fontWeight: '600'},
});

export default SiteReconstructionScreen;
