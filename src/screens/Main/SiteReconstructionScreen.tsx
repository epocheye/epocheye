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
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {X} from 'lucide-react-native';

import EpocheyeDetectARView, {
  type ElementTappedEvent,
  type EpocheyeDetectARHandle,
  type GeospatialAnchorEvent,
  type GeospatialStateEvent,
} from '../../native/EpocheyeDetectARView';
import {
  discoveryLayerFor,
  discoveryTextFor,
  type DiscoveryCard,
  type TapTarget,
} from '../../features/ar/discoveryLayers';
import type {ViewingStation} from '../../utils/api/ar';
import {listViewingStations} from '../../utils/api/ar';
import {resolveModelGlb} from '../../services/glbSource';
import {ROUTES} from '../../core/constants';
import ARSafetyNotice from '../../components/ui/ARSafetyNotice';
import ARCapabilityNotice from '../../components/ui/ARCapabilityNotice';
import RecordingWatermark from '../../components/ar/RecordingWatermark';
import ClipReadySheet from '../../components/ar/ClipReadySheet';
import {useScreenRecording} from '../../shared/hooks/useScreenRecording';
import {siteBrandingFor} from '../../features/ar/siteBranding';
import {
  useARCapability,
  isNonArCapability,
} from '../../shared/hooks/useARCapability';
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
// A hard 3 m / 12 deg gate with no timeout and no escape means a site that never
// reaches it — tree cover, tall buildings, thin VPS coverage — leaves the visitor
// staring at "move the phone slowly" forever, with no way to see the thing they
// walked to. The geospatial pose is the COARSE lock; a hosted cloud anchor is
// what makes it precise. So past this wider bound we offer an explicit
// "lock on anyway", and the achieved accuracy is shown on the button.
const OVERRIDE_HORIZ_ACC_M = 8;
const OVERRIDE_YAW_ACC_DEG = 25;
/** Only offer the override once it is clear waiting is not working. */
const OVERRIDE_OFFER_AFTER_MS = 12000;

type Phase =
  | 'loading'
  | 'none'
  | 'error'
  /** This device cannot do world-locked AR — explained, never blamed on the site. */
  | 'no-ar'
  | 'guiding'
  | 'resolving'
  | 'locked';

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
> = ({route, navigation}) => {
  // Families-policy safety gate. `safety.exit` is the safe-back callback (and
  // owns the Android hardware-back interception for this camera screen), so it
  // doubles as this screen's close handler.
  const {t} = useTranslation();
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
  const layer = useMemo(() => discoveryLayerFor(slug), [slug]);
  const {capability} = useARCapability();
  const branding = useMemo(() => siteBrandingFor(slug), [slug]);
  const rec = useScreenRecording({fileNameHint: slug ?? undefined});
  const [lockOverride, setLockOverride] = useState(false);
  const [waitedForLock, setWaitedForLock] = useState(false);
  const [tapped, setTapped] = useState<{
    title: string;
    meta?: string;
    body?: string;
  } | null>(null);

  const heading = useHeading(
    loc ? {latitude: loc.latitude, longitude: loc.longitude} : null,
    phase === 'guiding',
  );

  // 1. Load the site's stations.
  useEffect(() => {
    // Capability is resolved by useARCapability, not by isDetectARAvailable —
    // that constant only says whether the native view is REGISTERED, so
    // branching on it told ARCore-less phones "Could not load this site",
    // blaming the site for the handset. 'checking' is not an answer yet.
    if (capability === 'checking') {
      return;
    }
    if (!slug) {
      setPhase('none');
      return;
    }
    // Fetch stations even on a non-AR device: the station carries the model_id
    // the 3D fallback needs, so this is what lets the notice offer a real
    // alternative instead of a dead end.
    const nonAr = isNonArCapability(capability);
    let cancelled = false;
    void listViewingStations(slug).then(res => {
      if (cancelled) {
        return;
      }
      if (!res.success) {
        setPhase(nonAr ? 'no-ar' : 'error');
        return;
      }
      const stations = res.data.stations ?? [];
      pendingStationsRef.current = stations;
      if (stations.length === 0) {
        setPhase('none');
        return;
      }
      setPhase(nonAr ? 'no-ar' : 'guiding');
    });
    return () => {
      cancelled = true;
    };
  }, [slug, capability]);

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
  const accuracyIdeal =
    tracking &&
    (geo?.horizontalAccuracy ?? 99) <= MAX_HORIZ_ACC_M &&
    (geo?.orientationYawAccuracy ?? 99) <= MAX_YAW_ACC_DEG;
  /** Wide enough to still be worth placing, once waiting has clearly failed. */
  const overrideAvailable =
    tracking &&
    !accuracyIdeal &&
    waitedForLock &&
    (geo?.horizontalAccuracy ?? 99) <= OVERRIDE_HORIZ_ACC_M &&
    (geo?.orientationYawAccuracy ?? 99) <= OVERRIDE_YAW_ACC_DEG;
  const accuracyOk = accuracyIdeal || (lockOverride && overrideAvailable);

  // Start the clock once the visitor is actually standing at the station: only
  // then is "it isn't locking" a real answer rather than impatience.
  useEffect(() => {
    if (phase !== 'guiding' || !inRange || accuracyIdeal) {
      return;
    }
    const timer = setTimeout(
      () => setWaitedForLock(true),
      OVERRIDE_OFFER_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, [phase, inRange, accuracyIdeal]);

  const placeLayer = useCallback(() => {
    if (!layer) {
      return;
    }
    arRef.current?.setTapTargets(JSON.stringify(layer.tapTargets));
    arRef.current?.placeDiscoveryCards(JSON.stringify(layer.cards));
  }, [layer]);

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
        // Hang the discovery layer off the geospatial anchor now. If a cloud
        // anchor is also resolving it will REPLACE this anchor (the native resolve
        // clears the current one), so the layer is placed again on that event —
        // placeDiscoveryCards clears its own nodes first, so re-placing is safe.
        placeLayer();
        setPhase('locked');
      } else {
        // Placement failed — let the visitor try again.
        resolvedRef.current = false;
        setPhase('guiding');
      }
    },
    [target, placeLayer],
  );

  // Re-place the layer whenever the cloud anchor swaps the anchor underneath it.
  const handleCloudAnchorEvent = useCallback(
    (e: {phase: string; state: string}) => {
      if (e.phase === 'resolve' && e.state === 'SUCCESS') {
        placeLayer();
      }
    },
    [placeLayer],
  );

  const handleElementTapped = useCallback(
    (e: ElementTappedEvent) => {
      if (e.kind === 'card') {
        const card = layer?.cards.find((c: DiscoveryCard) => c.id === e.id);
        if (card) {
          setTapped({title: card.title, meta: card.meta, body: card.body});
        }
        return;
      }
      const box = layer?.tapTargets.find(
        (target_: TapTarget) => target_.id === e.id,
      );
      setTapped({
        title: box?.label ?? t('reconstruction.thisPart'),
        meta: e.id,
        body: undefined,
      });
    },
    [layer, t],
  );

  /**
   * Hand a non-AR visitor the reconstruction anyway: the same GLB, in the 3D
   * orbit viewer, carrying the same authored history. `preferParamGlb` is not
   * optional — without it Ar3dViewer silently prefers the site's era table and
   * can show "coming soon" instead of the model we just passed it.
   */
  const goToFallback = useCallback(() => {
    const station = pendingStationsRef.current?.[0];
    const modelId = station?.model_id;
    const finish = (url: string | null) => {
      if (!url) {
        goBack();
        return;
      }
      navigation.replace(ROUTES.MAIN.AR_3D_VIEWER, {
        monumentId: slug ?? '',
        objectLabel: station?.title ?? slug ?? '',
        glbUrl: url,
        preferParamGlb: true,
        siteName: station?.title ?? undefined,
        knowledgeText: discoveryTextFor(slug) ?? undefined,
      });
    };
    if (!modelId) {
      finish(null);
      return;
    }
    void resolveModelGlb(modelId).then(finish);
  }, [navigation, slug, goBack]);

  /** ARCore is missing but the phone is capable — one tap from fixed. */
  const openArCoreInstall = useCallback(() => {
    Linking.openURL('market://details?id=com.google.ar.core').catch(() =>
      Linking.openURL(
        'https://play.google.com/store/apps/details?id=com.google.ar.core',
      ).catch(() => {
        // Never leave the user on a screen whose primary button does nothing.
        goToFallback();
      }),
    );
  }, [goToFallback]);

  const banner = useMemo(() => {
    switch (phase) {
      case 'loading':
        return t('reconstruction.loading');
      case 'none':
        return t('reconstruction.none');
      case 'error':
        return t('reconstruction.error');
      case 'no-ar':
        return t('arCapability.eyebrow');
      case 'resolving':
        return t('reconstruction.resolving');
      case 'locked':
        return target?.title || t('reconstruction.locked');
      case 'guiding': {
        if (distance == null) {
          return t('reconstruction.finding');
        }
        if (inRange && !accuracyOk) {
          return t('reconstruction.hereMoveSlowly');
        }
        const turn =
          rel != null
            ? formatTurnInstruction(rel)
            : t('reconstruction.pointAround');
        return t('reconstruction.away', {
          distance: formatDistance(distance),
          turn,
        });
      }
    }
  }, [phase, distance, inRange, accuracyOk, rel, target, t]);

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

  // This device cannot do world-locked AR. Say so plainly, and hand the visitor
  // the 3D reconstruction instead — never a dead end, and never "the site failed
  // to load", which is what this screen used to say.
  if (phase === 'no-ar') {
    return (
      <ARCapabilityNotice
        capability={capability}
        intent="reconstruction"
        onPrimary={
          capability === 'arcore-missing' ? openArCoreInstall : goToFallback
        }
        onSecondary={
          capability === 'arcore-missing' ? goToFallback : undefined
        }
        onExit={goBack}
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
          // A surveyed reconstruction must keep the GLB's own metres. Without this
          // SceneView normalises the model to `modelScale` metres across, which would
          // render a 48 m fort at half a metre.
          // Depth occlusion: this reconstruction is built ON the surviving fabric,
          // so the real wall in the camera feed SHOULD hide the parts of the model
          // behind it — including the rampart core's far face. Armed at session
          // creation; ARCore checks isDepthModeSupported and degrades to no
          // occlusion on devices without depth, so this is safe everywhere.
          depthArmed
          depthOcclusionEnabled
          modelTrueScale
          modelScale={target?.model_scale && target.model_scale > 0 ? target.model_scale : 1}
          onElementTapped={handleElementTapped}
          geospatialEnabled
          cloudAnchorsEnabled={!!target?.cloud_anchor_id}
          onGeospatialState={setGeo}
          onGeospatialAnchorEvent={handleGeoAnchor}
          onCloudAnchorEvent={handleCloudAnchorEvent}
        />
      ) : (
        <View style={styles.mapPlaceholder} />
      )}

      {/*
        MediaProjection records the literal screen, so every pixel of chrome
        visible here is burned into the user's clip forever. All of it goes
        away for the duration, and the watermark takes its place.
      */}
      {!rec.chromeHidden ? (
      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable onPress={() => goBack()} hitSlop={12} style={styles.close}>
            <X size={18} color="#FFF" />
          </Pressable>
          <View style={styles.bannerWrap}>
            <Text style={styles.banner}>{banner}</Text>
          </View>
        </View>

        {/*
          Waiting has visibly failed and the accuracy is still usable. Offer the
          lock rather than leaving the visitor stuck: the geospatial pose is the
          coarse lock, and a hosted cloud anchor is what makes it precise. The
          achieved accuracy is on the button so the choice is informed.
        */}
        {phase === 'guiding' && overrideAvailable && !lockOverride ? (
          <View style={styles.overrideWrap}>
            <Pressable
              onPress={() => setLockOverride(true)}
              accessibilityRole="button"
              style={({pressed}) => [
                styles.overrideHit,
                pressed && {opacity: 0.85},
              ]}>
              <Text style={styles.overrideText}>
                {t('reconstruction.lockAnyway', {
                  acc: (geo?.horizontalAccuracy ?? 0).toFixed(1),
                })}
              </Text>
            </Pressable>
          </View>
        ) : null}

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
      ) : null}

      <RecordingWatermark
        title={branding.title ?? target?.title ?? ''}
        era={branding.era}
        visible={rec.chromeHidden}
      />

      {/*
        The stop control is INVISIBLE and full-screen. A visible button would be
        permanently in the corner of every clip; the trade is that tapping the
        model for a card is disabled while recording, which a 30 s cap makes
        acceptable. The instruction is given during the preroll, which is not
        recorded.
      */}
      {rec.state === 'recording' ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            void rec.stop();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('clip.stop')}
        />
      ) : null}

      {rec.state === 'preroll' ? (
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.preroll}>{rec.prerollCount}</Text>
          <Text style={styles.prerollHint}>{t('clip.tapToStop')}</Text>
        </View>
      ) : null}

      {/* Offered only once the reconstruction is actually in place — recording
          the walk-up guidance would be pointless. */}
      {rec.supported && rec.state === 'idle' && phase === 'locked' ? (
        <View style={styles.recWrap} pointerEvents="box-none">
          <Pressable
            onPress={() => {
              void rec.begin();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('clip.record')}
            style={({pressed}) => [styles.recHit, pressed && {opacity: 0.85}]}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>{t('clip.record')}</Text>
          </Pressable>
        </View>
      ) : null}

      {rec.clip && rec.state === 'ready' ? (
        <ClipReadySheet
          clip={rec.clip}
          siteName={branding.title ?? target?.title ?? ''}
          onClose={rec.discard}
        />
      ) : null}

      {tapped && !rec.chromeHidden ? (
        <Pressable style={styles.sheetScrim} onPress={() => setTapped(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{tapped.title}</Text>
            {tapped.meta ? (
              <Text style={styles.sheetMeta}>{tapped.meta}</Text>
            ) : null}
            {tapped.body ? (
              <Text style={styles.sheetBody}>{tapped.body}</Text>
            ) : null}
            <Text style={styles.sheetHint}>
              {t('reconstruction.tapToClose')}
            </Text>
          </View>
        </Pressable>
      ) : null}

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
  overrideWrap: {alignItems: 'center', marginTop: 12},
  overrideHit: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(224,167,60,0.55)',
    backgroundColor: 'rgba(224,167,60,0.14)',
  },
  overrideText: {color: '#E0A73C', fontSize: 13, fontWeight: '600'},
  preroll: {color: '#FFF', fontSize: 96, fontWeight: '800'},
  prerollHint: {color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 8},
  recWrap: {position: 'absolute', right: 18, bottom: 38},
  recHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: 'rgba(10,10,10,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  recDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5484D'},
  recText: {color: '#FFF', fontSize: 13, fontWeight: '600'},
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
  sheetScrim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: 'rgba(10,8,12,0.96)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopWidth: 2,
    borderTopColor: '#4CAF50',
  },
  sheetTitle: {color: '#F5F0E8', fontSize: 20, fontWeight: '700'},
  sheetMeta: {color: '#4CAF50', fontSize: 12, marginTop: 6},
  sheetBody: {color: '#E2DCD2', fontSize: 14, lineHeight: 21, marginTop: 12},
  sheetHint: {color: '#7A7A7A', fontSize: 11, marginTop: 16},
});

export default SiteReconstructionScreen;
