/**
 * MagicWindowScreen — Bangalore Fort as it stood in 1791, camera off.
 *
 * Every AR route at this site failed on the EVIDENCE, not the engineering: the
 * breach is 103 m east in a bus yard behind a treeline, the photogrammetry scan
 * has no metric scale, and no ground anchor exists. A magic window needs none of
 * those — the visitor stands anywhere, and the gyroscope turns the view.
 *
 * What this does that the Acropolis and Saline Royale reconstructions do not:
 * it carries the B5 two-axis evidence convention on its face. Opacity encodes
 * dimensional confidence, surface encodes material confidence, and nothing is
 * given a height or a depth that no source records. The legend says so.
 *
 * PRODUCT RULE: gyroscope rotation only, no translation. Walking must never
 * change the view, and this is never presented as navigation.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {
  Compass,
  Crosshair,
  Footprints,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';

import EpocheyeMagicWindowView, {
  isMagicWindowAvailable,
  type EpocheyeMagicWindowHandle,
  type MagicWindowLoadErrorEvent,
  type MagicWindowModelLoadedEvent,
  type MagicWindowWalk,
  type MagicWindowFigure,
  type MagicWindowFigureTappedEvent,
  type MagicWindowDriftEvent,
  type MagicWindowRigProbeEvent,
  type MagicWindowCameraDebugEvent,
  type MagicWindowHeadingEvent,
} from '../../native/EpocheyeMagicWindowView';
import {toNativeViewpoint} from '../../features/magicwindow/viewpoints';
import {
  getMagicWindowScene,
  type MagicWindowScene,
} from '../../features/magicwindow/scenes';
import {
  peopleFor,
  RIG_TEST_MODEL_ID,
  RIG_TEST_PLACEMENT,
  type MagicWindowPerson,
} from '../../features/magicwindow/people';
import {
  useSiteWalk,
  SITE_WALK_RADIUS_M,
} from '../../features/magicwindow/useSiteWalk';
import {
  addSpeechListener,
  prepareSpeech,
  speak,
  stopSpeaking,
} from '../../native/EpocheyeSpeech';
import AudioPlayer from '../../components/AudioPlayer';
import {listAudioStops} from '../../utils/api/audio/Audio';
import type {AudioStopsResponse} from '../../utils/api/audio/types';
import {
  buildAudioUrl,
  getOrFetchMedia,
  prefetchMedia,
} from '../../services/mediaCache';
import {
  useMuseumPrefsStore,
  useNarrationLang,
} from '../../stores/museumPrefsStore';
import {tourFor, type TourStop} from '../../features/magicwindow/tour';
import {roomPhotoFor} from '../../features/magicwindow/roomPhotos';
import PalacePlanIndicator from '../../features/magicwindow/PalacePlanIndicator';
import {TEXTURE_CREDITS} from '../../features/magicwindow/palace';
import {ASSAULT} from '../../features/magicwindow/assault';
import {FORT_STATES} from '../../features/magicwindow/timeline';
import {resolveModelGlb} from '../../services/glbSource';
import {isAdminUser} from '../../shared/auth/isAdminUser';
import {useSafeBackHandler} from '../../shared/hooks/useSafeGoBack';
import {COLORS, FONTS, RADIUS, SPACING} from '../../core/constants/theme';

/**
 * The true-scale span of the whole scene, in metres.
 *
 * Measured against the SCENE, not the fort. `ModelNode.size` is the bounding box
 * of everything in the GLB, and the scene is dominated by the sky dome (radius
 * 1500 m) and the ground disc (radius 1400 m) — so at true scale the box is
 * 3000 x 1500 x 3000 m and the circuit sits well inside it. It is one rigid
 * model at uniform scale, so the dome span proves the fort's scale exactly as
 * well as measuring the fort would.
 *
 * The failure being caught is `scaleToUnits` normalisation, which would resize
 * the largest dimension to a target of a metre or two. That must never ship
 * silently, because a 0.5 m fort still looks like a fort.
 */
const SCALE_TOLERANCE = 0.25;

/** Radius of the walk pad, in points. */
const STICK_R = 46;
const ZERO_WALK = {forward: 0, right: 0} as const;

interface MagicWindowScreenProps {
  route?: {params?: {slug?: string; viewpointId?: string}};
}

const MagicWindowScreen: React.FC<MagicWindowScreenProps> = ({route}) => {
  const safeGoBack = useSafeBackHandler();
  const viewRef = useRef<EpocheyeMagicWindowHandle>(null);

  // ONE screen, several sites. Everything site-specific — the model, the
  // viewpoints, the legend, and which of the fort-only affordances exist at all
  // — comes from the scene registry. See features/magicwindow/scenes.ts for why
  // this is a registry rather than a second copy of this file.
  const scene: MagicWindowScene = useMemo(
    () => getMagicWindowScene(route?.params?.slug),
    [route?.params?.slug],
  );

  const [glbUri, setGlbUri] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scaleWarning, setScaleWarning] = useState<string | null>(null);

  // ---- THE GUIDED TOUR ----------------------------------------------------
  //
  // The rail of viewpoint names was the visitor interface and it should never
  // have been: choosing the right chip needs you to already know which room you
  // are in. The tour leads instead. It cannot SENSE where the visitor is - see
  // features/magicwindow/tour.ts for the three sensing routes and why each one
  // fails indoors - so it says where to walk and the visitor confirms.
  const tour = useMemo(() => tourFor(scene.slug), [scene.slug]);
  const [tourIndex, setTourIndex] = useState(0);
  /** The visitor has said "I'm here" for the CURRENT tour stop. */
  const [arrived, setArrived] = useState(false);
  /** Stops walked past without confirming, so progress can say so honestly. */
  const [skipped, setSkipped] = useState<string[]>([]);
  // A caller that already knows where the visitor is (the journey's audio guide,
  // whose stop maps 1:1 onto a viewpoint) opens straight at it and skips the
  // tour. An unknown id is ignored rather than throwing.
  const routeViewpointId = route?.params?.viewpointId;
  const [tourActive, setTourActive] = useState(
    () => tour.length > 0 && !routeViewpointId,
  );

  // THE VIEW OPENS WHERE THE TOUR OPENS. This was `useState(0)`, which is P2
  // "Down the arcade" - an interior - while the tour's first stop is P0, the
  // front lawn. The screen therefore opened inside the building and captioned it
  // "You are standing in The front lawn", because the facing line reads
  // `tourStop.place` while the camera reads `viewpoint`. They only agreed once
  // the visitor tapped "I'm here", which set the index from the tour stop.
  //
  // Deriving the initial index from the same tour stop makes them agree from the
  // first frame, and it is the right way round: the tour is the visitor
  // interface, so the tour decides where the view starts. A scene with no tour
  // (the fort) still opens at its own first viewpoint.
  const [index, setIndex] = useState(() => {
    const first = tour.length > 0 && !routeViewpointId ? tour[0] : undefined;
    if (!first) return 0;
    const i = scene.viewpoints.findIndex(v => v.id === first.viewpointId);
    return i >= 0 ? i : 0;
  });
  useEffect(() => {
    if (!routeViewpointId) return;
    const i = scene.viewpoints.findIndex(v => v.id === routeViewpointId);
    if (i >= 0) setIndex(i);
  }, [routeViewpointId, scene.viewpoints]);

  const tourStop: TourStop | undefined = tourActive
    ? tour[tourIndex]
    : undefined;

  const viewpoint = scene.viewpoints[index];

  // SITE MODE. When the visitor is actually standing at Bangalore Fort, their
  // real position drives the camera. Off-site it is inert, and the on-screen pad
  // does the walking instead — see useSiteWalk for why that boundary exists.
  const [siteMode, setSiteMode] = useState(false);
  const site = useSiteWalk(siteMode && scene.hasSiteWalk);

  const nativeViewpoint = useMemo(() => {
    const base = toNativeViewpoint(viewpoint);
    if (!site.active || !site.position) return base;
    // Their feet decide east/north; everything else stays authored, and the
    // gyro still decides where they are looking.
    return {
      ...base,
      east: site.position.east,
      north: site.position.north,
      up: viewpoint.position[2] > 5 ? 1.6 : viewpoint.position[2],
    };
  }, [viewpoint, site.active, site.position]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Reuse the existing resolver: CloudFront → on-device LRU cache →
        // bundled fallback. No bespoke fetching here.
        const uri = await resolveModelGlb(scene.modelId);
        if (cancelled) return;
        if (!uri) {
          setError('The reconstruction is not available on this device yet.');
          return;
        }
        setGlbUri(uri);
      } catch {
        if (!cancelled) setError('The reconstruction could not be loaded.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scene.modelId]);

  // PHASE 4 blocking test. Admin-only, and reported rather than assumed: a rig
  // can load with animations present and never tick, which looks exactly like a
  // static mesh.
  // ORIENTATION HUD. Debug + admin only, and it exists for one reason: the
  // palace scene pointed at the ground from every viewpoint and every
  // explanation offered for it was a hypothesis. `fwd` is the vector actually
  // handed to the Filament camera; `pos` must not move while the device only
  // rotates. Held upright and level, fwdY near 0 means the basis is right and
  // fwdY near -1 means the camera is aimed at the nadir.
  const [camDebug, setCamDebug] = useState<MagicWindowCameraDebugEvent | null>(
    null,
  );
  const onCameraDebug = useCallback(
    ({nativeEvent}: {nativeEvent: MagicWindowCameraDebugEvent}) => {
      setCamDebug(nativeEvent);
    },
    [],
  );

  // WHERE AM I. The palace is five identical bays of colonnade, so from inside
  // it one stop looks much like another; the rail names them only while you are
  // reading it and the caption scrolls away. Heading comes from the native view,
  // derived from the same forward vector that aims the camera.
  const [headingDeg, setHeadingDeg] = useState<number | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const onHeading = useCallback(
    ({nativeEvent}: {nativeEvent: MagicWindowHeadingEvent}) => {
      setHeadingDeg(nativeEvent.headingDeg);
    },
    [],
  );

  // IMAGE CREDITS. A licence obligation, not a nicety: the palace's painted
  // wall ships as a photograph of the real surface under CC BY 2.0, which
  // requires attribution. Shown on demand rather than permanently so it does
  // not compete with the view, but always reachable from the legend.
  const [creditsOpen, setCreditsOpen] = useState(false);

  const [rigTest, setRigTest] = useState(false);
  const [rigResult, setRigResult] = useState<string | null>(null);
  const onRigProbe = useCallback(
    ({nativeEvent}: {nativeEvent: MagicWindowRigProbeEvent}) => {
      setRigResult(
        `animations ${nativeEvent.animations} · skins ${nativeEvent.skins} · ` +
          (nativeEvent.advancing ? 'ADVANCING' : 'NOT advancing'),
      );
    },
    [],
  );

  // The figure is resolved separately from the fort, through the same cache.
  // Deliberately non-blocking and failure-tolerant: if the person cannot be
  // fetched the fort still opens. A missing model must never cost you the site.
  const [figure, setFigure] = useState<MagicWindowFigure | null>(null);
  // Whose figure this is depends on the SITE, not on a fixed index. It was
  // MAGIC_WINDOW_PEOPLE[0] — the fort's Tipu — which would have put him in the
  // palace's darbar hall the moment the palace grew a figure.
  // peopleFor(...)[0] was hardcoded, so a site could only ever have one
  // figure however many were authored (the fort has two). Pick the first who
  // can actually be seen from where the visitor is standing, and fall back to
  // the first authored so a scene never silently loses its figure.
  const people = useMemo(
    () => (scene.hasFigure ? peopleFor(scene.slug) : []),
    [scene.hasFigure, scene.slug],
  );
  const person: MagicWindowPerson | undefined = useMemo(
    () =>
      people.find(
        pp => !pp.visibleFrom || pp.visibleFrom.includes(viewpoint.id),
      ) ?? people[0],
    [people, viewpoint.id],
  );
  /**
   * The figure can actually be SEEN from where the visitor is standing.
   *
   * ONE predicate, two consumers. It used to be written inline in the point
   * hint and simply omitted from the person tab, so at a viewpoint the figure
   * is not visible from - every palace stop except P5, since Purnaiah is
   * `visibleFrom: ['P5']` - the hint correctly stayed away while the tab still
   * announced him by name. `person` falls back to `people[0]` so that a scene
   * never silently loses its figure, which is what put a name on screen for
   * someone standing a storey above the visitor.
   */
  const personVisible =
    !!person &&
    (!person.visibleFrom || person.visibleFrom.includes(viewpoint.id));

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    (async () => {
      try {
        const uri = await resolveModelGlb(
          rigTest ? RIG_TEST_MODEL_ID : person.modelId,
        );
        if (cancelled || !uri) return;
        setFigure(
          rigTest
            ? {uri, ...RIG_TEST_PLACEMENT}
            : {
                uri,
                east: person.position[0],
                north: person.position[1],
                up: person.floorM ?? 0,
                heading: person.headingDeg,
              },
        );
      } catch {
        // Silent: the fort is the deliverable, the figure is an addition.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [person, rigTest]);

  // ---- PHASE 2: real walking --------------------------------------------
  //
  // ARCore runs for 6DoF; the camera feed is never displayed. The visitor's
  // start pins to the DELHI GATE PASSAGE - the reconstruction's own plan origin
  // (0, 0), a place they can physically stand in, and the only surveyed point on
  // this site. The fort centroid was rejected: it is under the market.
  const [arWalk, setArWalk] = useState(false);
  const [drift, setDrift] = useState<MagicWindowDriftEvent | null>(null);
  // TELEPORT IS A RE-PIN.
  //
  // The fort is a mile round and the visitor is standing in a 50 m compound, so
  // most of it can never be walked to. Jumping does not move the camera: it
  // moves the FORT, so that wherever the visitor is physically standing now
  // becomes the chosen destination. Real walking then resumes from there with
  // no special case - the same one transform on the world node, rewritten.
  //
  // Off-site (no AR) the same destination drives the camera directly instead.
  const arPin = useMemo(
    () => ({
      east: viewpoint.position[0],
      north: viewpoint.position[1],
      heading: viewpoint.headingDeg,
      deviceHeight: 1.5,
    }),
    [viewpoint],
  );
  const onDriftSample = useCallback(
    ({nativeEvent}: {nativeEvent: MagicWindowDriftEvent}) => setDrift(nativeEvent),
    [],
  );

  // PHASE 5. The visitor drives the state; the rendering, not just the caption,
  // carries how well evidenced each one is.
  const [stateId, setStateId] = useState(2);
  const fortState = useMemo(
    () => FORT_STATES.find(f => f.id === stateId) ?? FORT_STATES[1],
    [stateId],
  );

  // PHASE 6. The visitor drives the sequence; nothing auto-plays over them.
  const [step, setStep] = useState(0);
  const assault = step > 0 ? ASSAULT[step - 1] : null;
  const advanceAssault = useCallback(() => {
    setStep(v => {
      const next = v >= ASSAULT.length ? 0 : v + 1;
      if (next > 0) {
        // Standing in the right place is part of the account.
        const vpId = ASSAULT[next - 1].viewpoint;
        if (vpId) {
          const i = scene.viewpoints.findIndex(x => x.id === vpId);
          if (i >= 0) setIndex(i);
        }
        setStateId(3); // the fort as it stood, with the siege marked on it
      }
      return next;
    });
  }, [scene.viewpoints]);

  const [lineIndex, setLineIndex] = useState<number | null>(null);
  const [everSpoke, setEverSpoke] = useState(false);

  // VOICE. Android's own TextToSpeech, prepared once. `canSpeak` false means the
  // device has no voice data installed, in which case the control is hidden
  // rather than shown as a button that does nothing.
  const [canSpeak, setCanSpeak] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void prepareSpeech().then(ok => {
      if (!cancelled) setCanSpeak(ok);
    });
    const sub = addSpeechListener(e => {
      if (!cancelled) setSpeaking(e.state === 'start');
    });
    return () => {
      cancelled = true;
      sub.remove();
      stopSpeaking();
    };
  }, []);

  // ---- VIEWPOINT NARRATION -------------------------------------------------
  //
  // Eight stops were written, recorded and applied for this site and none of
  // them could be heard here: they play in AudioGuideScreen, so standing in the
  // darbar hall gave silence. Each viewpoint now names an `audio_stops.stop_key`
  // (emitted from the build, see STOP_KEY in build_palace_magicwindow.py) and
  // arriving at it plays that clip.
  //
  // Deliberately the EXISTING audio path and not a second one: the same
  // `listAudioStops` the guide and the journey call, the same lang/persona
  // resolution, the same mediaCache, and the same <AudioPlayer/>. A scene whose
  // viewpoints carry no stopKey (the fort) fetches nothing at all.
  const narrationLang = useNarrationLang();
  const narrationPersona = useMuseumPrefsStore(st => st.narrationPersona);
  const [stops, setStops] = useState<AudioStopsResponse | null>(null);
  const hasNarration = useMemo(
    () => scene.viewpoints.some(v => v.stopKey),
    [scene.viewpoints],
  );
  useEffect(() => {
    if (!hasNarration) return;
    let cancelled = false;
    void listAudioStops(scene.slug, {
      lang: narrationLang,
      persona: narrationPersona,
    }).then(res => {
      if (cancelled) return;
      // Silence on failure. Narration is an addition to this screen, not its
      // deliverable, and an error banner over a reconstruction is worse than
      // no sound.
      setStops(res.success ? res.data : null);
    });
    return () => {
      cancelled = true;
    };
  }, [hasNarration, scene.slug, narrationLang, narrationPersona]);

  const stopForView = useMemo(() => {
    if (!viewpoint.stopKey || !stops) return undefined;
    return stops.stops.find(st => st.stop_key === viewpoint.stopKey);
  }, [stops, viewpoint.stopKey]);

  // Warm the whole site's audio once, so moving along the rail does not stall
  // on a download each time. Never throws; failures just mean a stream.
  useEffect(() => {
    if (!stops) return;
    const urls = stops.stops.map(st => buildAudioUrl(st.clip?.audio_url));
    const controller = new AbortController();
    void prefetchMedia(urls, {signal: controller.signal});
    return () => controller.abort();
  }, [stops]);

  // Prefer the cached copy, fall back to the CDN so the first visit still plays.
  const [clipUri, setClipUri] = useState<string | null>(null);
  useEffect(() => {
    const url = buildAudioUrl(stopForView?.clip?.audio_url);
    if (!url) {
      setClipUri(null);
      return;
    }
    let cancelled = false;
    void getOrFetchMedia(url)
      .then(u => {
        if (!cancelled) setClipUri(u);
      })
      .catch(() => {
        if (!cancelled) setClipUri(url);
      });
    return () => {
      cancelled = true;
    };
  }, [stopForView]);

  const advance = useCallback(() => {
    if (!person) return;
    setEverSpoke(true);
    setLineIndex(i => {
      const next = i === null ? 0 : (i + 1) % person.lines.length;
      if (voiceOn && canSpeak) {
        speak(person.lines[next].text, `${person.id}-${next}`);
      }
      return next;
    });
  }, [person, voiceOn, canSpeak]);

  // Pointing at him in the world is the real gesture; the card is the fallback
  // for anyone who cannot find him.
  const onFigureTapped = useCallback(
    (_e: {nativeEvent: MagicWindowFigureTappedEvent}) => advance(),
    [advance],
  );

  const onModelLoaded = useCallback(
    ({nativeEvent}: {nativeEvent: MagicWindowModelLoadedEvent}) => {
      setReady(true);
      const {sizeEastM, sizeNorthM, sizeUpM} = nativeEvent;
      const span = Math.max(sizeEastM, sizeNorthM, sizeUpM);
      const ratio = span / scene.sceneSpanM;
      if (ratio < 1 - SCALE_TOLERANCE || ratio > 1 + SCALE_TOLERANCE) {
        // Say it out loud rather than rendering a convincing miniature. Report
        // the implied size of the CIRCUIT, since that is the number a reader can
        // judge — the raw span is the sky dome and means nothing on its own.
        setScaleWarning(
          `Scale check failed: the reconstruction is at ${(ratio * 100).toFixed(0)}% ` +
            `of true scale — the circuit would measure ` +
            `${(scene.extentEwM * ratio).toFixed(1)} × ` +
            `${(scene.extentNsM * ratio).toFixed(1)} m instead of ` +
            `${scene.extentEwM} × ${scene.extentNsM} m.`,
        );
      } else {
        setScaleWarning(null);
      }
    },
    [scene.sceneSpanM, scene.extentEwM, scene.extentNsM],
  );

  const onLoadError = useCallback(
    ({nativeEvent}: {nativeEvent: MagicWindowLoadErrorEvent}) => {
      setError(nativeEvent.message || 'The reconstruction could not be loaded.');
    },
    [],
  );

  const selectViewpoint = useCallback((next: number) => {
    setIndex(next);
    // A new pin drops a new drift anchor, so the old measurement no longer
    // describes anything. Clear it rather than show a stale number.
    setDrift(null);
  }, []);

  /** The visitor says they have arrived. The only "positioning" this has. */
  const confirmArrived = useCallback(() => {
    if (!tourStop) return;
    const i = scene.viewpoints.findIndex(v => v.id === tourStop.viewpointId);
    if (i >= 0) selectViewpoint(i);
    setArrived(true);
  }, [tourStop, scene.viewpoints, selectViewpoint]);

  /** Next stop. `confirmed` false means they moved on without arriving. */
  const nextTourStop = useCallback(
    (confirmed: boolean) => {
      const from = tour[tourIndex];
      if (!confirmed && from) {
        setSkipped(prev =>
          prev.includes(from.viewpointId) ? prev : [...prev, from.viewpointId],
        );
      }
      setTourIndex(i => Math.min(i + 1, tour.length - 1));
      // A stop that shares its position with the one before it is already where
      // the visitor is standing, so do not make them confirm it twice - open it
      // and let the prompt say "stay where you are, look up".
      const next = tour[Math.min(tourIndex + 1, tour.length - 1)];
      if (next?.sameSpot) {
        const i = scene.viewpoints.findIndex(v => v.id === next.viewpointId);
        if (i >= 0) selectViewpoint(i);
        setArrived(true);
      } else {
        setArrived(false);
      }
    },
    [tour, tourIndex, scene.viewpoints, selectViewpoint],
  );

  /** Leave the tour for the rail. A deliberate act, never the default. */
  const openRail = useCallback(() => {
    setTourActive(false);
  }, []);

  const recenter = useCallback(() => {
    viewRef.current?.recenter();
  }, []);

  // ---- the walk stick ----------------------------------------------------
  //
  // Kept in state rather than a ref because it is a native PROP: the native side
  // integrates the held direction at sensor rate, so JS only has to say which way,
  // not how far. That is why dragging feels continuous without a 60 Hz bridge.
  const [walk, setWalk] = useState<MagicWindowWalk>(ZERO_WALK);
  const [stickPos, setStickPos] = useState({x: 0, y: 0});
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_e, g) => {
          // Clamp into the pad, then normalise. Pushing the stick further gives a
          // proportionally faster walk, so fine positioning stays possible.
          const dx = Math.max(-STICK_R, Math.min(STICK_R, g.dx));
          const dy = Math.max(-STICK_R, Math.min(STICK_R, g.dy));
          setStickPos({x: dx, y: dy});
          setWalk({
            forward: -dy / STICK_R, // pushing UP walks you forward
            right: dx / STICK_R,
          });
        },
        onPanResponderRelease: () => {
          setStickPos({x: 0, y: 0});
          setWalk(ZERO_WALK);
        },
        onPanResponderTerminate: () => {
          setStickPos({x: 0, y: 0});
          setWalk(ZERO_WALK);
        },
      }),
    [],
  );

  if (!isMagicWindowAvailable) {
    return (
      <View style={styles.fallback}>
        <SafeAreaView style={styles.fallbackInner}>
          <Text style={styles.fallbackTitle}>Not available on this build</Text>
          <Text style={styles.fallbackBody}>
            The magic window needs the native renderer, which ships with the
            Android app. Reinstall the latest build to view it.
          </Text>
          <Pressable style={styles.fallbackButton} onPress={safeGoBack}>
            <Text style={styles.fallbackButtonText}>Go back</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <EpocheyeMagicWindowView
        ref={viewRef}
        style={StyleSheet.absoluteFillObject}
        glbUri={glbUri ?? undefined}
        viewpoint={nativeViewpoint}
        walk={site.active || arWalk ? ZERO_WALK : walk}
        arTracking={arWalk}
        arPin={arPin}
        timelineState={stateId}
        assaultStep={step}
        onDriftSample={onDriftSample}
        figure={figure}
        fogEnabled
        fog={scene.fog}
        onModelLoaded={onModelLoaded}
        onLoadError={onLoadError}
        onFigureTapped={onFigureTapped}
        onRigProbe={onRigProbe}
        onCameraDebug={__DEV__ ? onCameraDebug : undefined}
        skyColor={scene.skyColor}
        onHeading={onHeading}
        lightScale={scene.lightScale}
      />

      {!ready && !error ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={COLORS.amber} />
          <Text style={styles.loadingText}>{scene.loadingLabel}</Text>
        </View>
      ) : null}

      {/* Top: title, close. */}
      <LinearGradient
        colors={['rgba(10,10,12,0.85)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{scene.title}</Text>
          <Text style={styles.subtitle}>{scene.subtitle}</Text>
        </View>
        <Pressable
          onPress={safeGoBack}
          hitSlop={12}
          style={styles.iconButton}
          accessibilityLabel="Close">
          <X size={20} color={COLORS.textPrimary} />
        </Pressable>
      </SafeAreaView>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {scaleWarning ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>{scaleWarning}</Text>
        </View>
      ) : null}

      {/* THE PROMPT MUST NOT POINT AT SOMEONE YOU CANNOT SEE. It is suppressed
          at any stop the person authored themselves out of — for the palace,
          every stop on the ground floor, because Purnaiah is a storey up. And
          the palace cannot be walked, so it does not ask you to. */}
      {figure && person && personVisible && !everSpoke && ready ? (
        <View style={styles.pointHint} pointerEvents="none">
          <Text style={styles.pointHintText}>
            {scene.hasSiteWalk
              ? 'Someone is here. Walk up and tap him.'
              : 'Someone is here. Point at him and tap.'}
          </Text>
        </View>
      ) : null}

      {scene.hasPlanIndicator ? (
        <PalacePlanIndicator
          position={viewpoint.position}
          headingDeg={headingDeg}
          title={viewpoint.title}
          expanded={planOpen}
          onToggle={() => setPlanOpen(v => !v)}
        />
      ) : (
        // Every other scene at least gets its stop named, permanently.
        <View style={styles.stopNameOnly} pointerEvents="none">
          <Text style={styles.stopNameText} numberOfLines={1}>
            {viewpoint.title}
          </Text>
        </View>
      )}

      {__DEV__ && isAdminUser() && camDebug ? (
        <View style={styles.camHud} pointerEvents="none">
          <Text style={styles.camHudHead}>ORIENTATION</Text>
          <Text
            style={[
              styles.camHudLine,
              Math.abs(camDebug.fwdY) > 0.5 && styles.camHudBad,
            ]}>
            {`fwd  ${camDebug.fwdX.toFixed(2)}  ${camDebug.fwdY.toFixed(
              2,
            )}  ${camDebug.fwdZ.toFixed(2)}`}
          </Text>
          <Text style={styles.camHudLine}>
            {`pos  ${camDebug.posX.toFixed(1)}  ${camDebug.posY.toFixed(
              1,
            )}  ${camDebug.posZ.toFixed(1)}`}
          </Text>
          <Text
            style={[
              styles.camHudLine,
              camDebug.movedOnRotate && styles.camHudBad,
            ]}>
            {`moved on rotate: ${camDebug.movedOnRotate ? 'YES' : 'no'}`}
          </Text>
          <Text style={styles.camHudLine}>
            {`rot ${camDebug.displayRotation}  ${camDebug.remapBranch}`}
          </Text>
          <Text
            style={[
              styles.camHudLine,
              (camDebug.posY < camDebug.modelMinY ||
                camDebug.posY > camDebug.modelMaxY) &&
                styles.camHudBad,
            ]}>
            {`model Y ${camDebug.modelMinY.toFixed(
              1,
            )} .. ${camDebug.modelMaxY.toFixed(1)}  (eye ${camDebug.posY.toFixed(
              1,
            )})`}
          </Text>
          <Text style={styles.camHudBig}>
            {`${(
              (Math.asin(Math.max(-1, Math.min(1, camDebug.fwdY))) * 180) /
              Math.PI
            ).toFixed(0)}° elevation`}
          </Text>
          <Text style={styles.camHudNote}>
            0° = level · −90° = straight down · +90° = straight up
          </Text>
        </View>
      ) : null}

      {/* Fort-only, and now stated as such. RIG_TEST_PLACEMENT is (40, -300) in
          the FORT's frame — 300 m outside a 22 m building — so gating it on
          hasFigure stopped working the moment the palace got one. */}
      {scene.hasSiteWalk && isAdminUser() ? (
        <Pressable
          style={styles.rigTest}
          onPress={() => {
            setRigResult(null);
            setRigTest(v => !v);
          }}>
          <Text style={styles.rigTestText}>
            {rigTest ? 'RIG TEST — CesiumMan' : 'Run rig test'}
          </Text>
          {rigResult ? (
            <Text style={styles.rigTestResult}>{rigResult}</Text>
          ) : null}
        </Pressable>
      ) : null}

      {/* The figure's voice. Every line carries its tier and source in the
          record; what the visitor sees is the sentence, not the apparatus. */}
      {figure && person && personVisible ? (
        <Pressable style={styles.personTab} onPress={advance}>
          <Text style={styles.personName}>{person.name}</Text>
          <Text style={styles.personRole}>{person.role}</Text>
        </Pressable>
      ) : null}

      {lineIndex !== null && person ? (
        <Pressable style={styles.speech} onPress={advance}>
          <Text style={styles.speechText}>{person.lines[lineIndex].text}</Text>
          <View style={styles.speechFoot}>
            <Text style={styles.speechMore}>
              {lineIndex + 1} of {person.lines.length} · tap for more
            </Text>
            {canSpeak ? (
              <Pressable
                onPress={() => {
                  if (voiceOn) {
                    stopSpeaking();
                    setVoiceOn(false);
                  } else {
                    setVoiceOn(true);
                    speak(
                      person.lines[lineIndex].text,
                      `${person.id}-${lineIndex}`,
                    );
                  }
                }}
                hitSlop={10}>
                {voiceOn ? (
                  <Volume2
                    size={16}
                    color={speaking ? COLORS.amberLight : COLORS.textTertiary}
                  />
                ) : (
                  <VolumeX size={16} color={COLORS.textMuted} />
                )}
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      ) : null}

      {arWalk ? (
        <View style={styles.driftCard} pointerEvents="none">
          <Text style={styles.driftTitle}>WALKING THE FORT</Text>
          {drift ? (
            <Text style={styles.driftBody}>
              {drift.walkedM.toFixed(1)} m walked · tracking drift{' '}
              {drift.driftM.toFixed(2)} m · {drift.tracking}
            </Text>
          ) : (
            <Text style={styles.driftBody}>Finding the ground…</Text>
          )}
          <Text style={styles.driftNote}>
            Drift is measured, not modelled — it is how far a fixed anchor has
            appeared to move. Tap the crosshair to re-pin the fort to where you
            are standing.
          </Text>
        </View>
      ) : null}

      {/* Walk pad. Bottom-left, thumb-reachable, clear of the viewpoint rail. */}
      {ready && !error && scene.hasSiteWalk ? (
        <View style={styles.stickPad} {...panResponder.panHandlers}>
          <View style={styles.stickRing} />
          <View
            style={[
              styles.stickKnob,
              {transform: [{translateX: stickPos.x}, {translateY: stickPos.y}]},
            ]}
          />
        </View>
      ) : null}

      {/* Bottom: caption, legend, viewpoint rail, recentre. */}
      <LinearGradient
        colors={['transparent', 'rgba(10,10,12,0.92)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        {/* WHERE YOU ARE. Always visible, never behind a tap. The room name and
            the direction are the two things a visitor needs to match what is on
            screen to what is in front of them, and the old UI made them expand
            a plan to get either. `facing` is emitted from the build off the TRUE
            bearing - headingDeg is frame-relative and would say "north" here. */}
        <View style={styles.whereRow}>
          <Text style={styles.whereTitle} numberOfLines={1}>
            {viewpoint.title}
          </Text>
          {tour.length > 0 ? (
            <Text style={styles.whereProgress}>
              {tourActive
                ? `${tourIndex + 1} of ${tour.length}`
                : 'Jumped to'}
              {skipped.length > 0 ? ` · ${skipped.length} skipped` : ''}
            </Text>
          ) : null}
        </View>
        {viewpoint.facing ? (
          <Text style={styles.whereFacing}>
            You are standing in {tourStop?.place ?? viewpoint.title}, looking{' '}
            {viewpoint.facing}.
          </Text>
        ) : null}

        <Text style={styles.caption}>{viewpoint.caption}</Text>

        {/* The stop that belongs at this position. ONE player instance, kept
            mounted across viewpoints: AudioPlayer swaps source on a sourceKey
            change without remounting, which is exactly the viewpoint-change
            case. `suspended` ducks it while the figure is speaking, rather than
            unmounting, so a 105 s clip resumes where it was. */}
        {clipUri && stopForView && (!tourActive || arrived) ? (
          <AudioPlayer
            uri={clipUri}
            sourceKey={stopForView.stop_key}
            title={stopForView.title}
            autoPlay
            suspended={speaking}
          />
        ) : null}

        <View style={styles.legendRow}>
          {scene.legend.map(item => (
            <View key={item.key} style={styles.legendItem}>
              <View
                style={[
                  styles.legendSwatch,
                  item.key === 'ghost' && styles.legendSwatchGhost,
                  item.key === 'open' && styles.legendSwatchOpen,
                  item.key === 'colour' && styles.legendSwatchGhost,
                  item.key === 'unknown' && styles.legendSwatchOpen,
                ]}
              />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        {scene.hasPlanIndicator && TEXTURE_CREDITS.length > 0 ? (
          <Pressable onPress={() => setCreditsOpen(v => !v)} hitSlop={8}>
            <Text style={styles.creditsLink}>
              {creditsOpen ? 'Image credits ×' : 'Image credits'}
            </Text>
          </Pressable>
        ) : null}
        {creditsOpen
          ? TEXTURE_CREDITS.map(c => (
              <Text key={c.source} style={styles.creditsText}>
                {`${c.used_for} — photograph by ${c.author}, ${c.licence}`}
              </Text>
            ))
          : null}

        <Text style={styles.legendDetail}>
          {scene.legend
            .slice(1)
            .map(l => l.detail)
            .join(' ')}
        </Text>

        {scene.hasAssault ? (
        <>
        <Pressable style={styles.assaultBar} onPress={advanceAssault}>
          <Text style={styles.assaultCue}>
            {step === 0
              ? 'Play the storm of 21 March 1791'
              : `${step} of ${ASSAULT.length} · ${assault?.when ?? ''}`}
          </Text>
        </Pressable>
        {assault ? (
          <View style={styles.assaultCard}>
            <Text style={styles.assaultTitle}>{assault.title}</Text>
            <Text style={styles.assaultText}>{assault.text}</Text>
            {!assault.drawn ? (
              <Text style={styles.assaultNote}>
                Nothing is added to the model at this step.
              </Text>
            ) : null}
          </View>
        ) : null}
        </>
        ) : null}

        {scene.hasTimeline ? (
        <>
        <View style={styles.timelineRow}>
          {FORT_STATES.map(f => {
            const on = f.id === stateId;
            return (
              <Pressable
                key={f.id}
                onPress={() => setStateId(f.id)}
                style={[styles.era, on && styles.eraOn]}>
                <Text style={[styles.eraYear, on && styles.eraYearOn]}>
                  {f.years}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.eraNote}>
          <Text style={styles.eraLabel}>{fortState.label}</Text>
          {'  ·  '}
          {fortState.note}
        </Text>
        </>
        ) : null}

        {/* THE GUIDE. Where to walk, then the visitor confirms. It never says
            it knows where they are, because nothing on this phone does. */}
        {tourStop ? (
          <View style={styles.guide}>
            <Text style={styles.guidePlace}>{tourStop.place}</Text>
            <Text style={styles.guideWalk}>{tourStop.walkTo}</Text>
            <View style={styles.guideRow}>
              {!arrived ? (
                <Pressable
                  onPress={confirmArrived}
                  style={styles.guidePrimary}
                  accessibilityLabel={`I am at ${tourStop.place}`}>
                  <Text style={styles.guidePrimaryText}>I'm here</Text>
                </Pressable>
              ) : tourIndex < tour.length - 1 ? (
                <Pressable
                  onPress={() => nextTourStop(true)}
                  style={styles.guidePrimary}>
                  <Text style={styles.guidePrimaryText}>Next stop</Text>
                </Pressable>
              ) : (
                <Pressable onPress={openRail} style={styles.guidePrimary}>
                  <Text style={styles.guidePrimaryText}>That's the tour</Text>
                </Pressable>
              )}
              {!arrived && tourIndex < tour.length - 1 ? (
                <Pressable
                  onPress={() => nextTourStop(false)}
                  hitSlop={8}
                  style={styles.guideGhost}>
                  <Text style={styles.guideGhostText}>Skip</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={openRail} hitSlop={8} style={styles.guideGhost}>
                <Text style={styles.guideGhostText}>Jump to a room</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* The rail is a FALLBACK now, reached deliberately. A list of place
            names cannot be matched to a room you are standing in, so it is not
            the way in - but it is the way back if the tour is in the wrong
            place, and it is the only way to revisit a room out of order. */}
        <View style={styles.railRow}>
          {tourStop ? null : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}>
            {scene.viewpoints.map((vp, i) => {
              const active = i === index;
              // A photograph where one honestly exists — a visitor matches a
              // picture to the room in front of them and cannot match a phrase.
              // Two viewpoints have none on purpose; see roomPhotos.ts.
              const photo = roomPhotoFor(scene.slug, vp.id);
              return (
                <Pressable
                  key={vp.id}
                  onPress={() => selectViewpoint(i)}
                  style={[
                    styles.chip,
                    !!photo && styles.chipWithPhoto,
                    active && styles.chipActive,
                  ]}>
                  {photo ? (
                    <Image source={photo} style={styles.chipPhoto} />
                  ) : null}
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}>
                    {vp.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          )}
          {scene.hasSiteWalk ? (
            <>
              <Pressable
                onPress={() => {
                  setArWalk(v => !v);
                  setDrift(null);
                }}
                hitSlop={10}
                style={[styles.recenterButton, arWalk && styles.siteButtonOn]}
                accessibilityLabel="Walk through the fort for real">
                <Compass size={18} color={arWalk ? COLORS.bg : COLORS.amber} />
              </Pressable>
              <Pressable
                onPress={() => setSiteMode(v => !v)}
                hitSlop={10}
                style={[styles.recenterButton, siteMode && styles.siteButtonOn]}
                accessibilityLabel="Walk with your own steps">
                <Footprints
                  size={18}
                  color={siteMode ? COLORS.bg : COLORS.amber}
                />
              </Pressable>
            </>
          ) : null}
          <Pressable
            onPress={recenter}
            hitSlop={10}
            style={styles.recenterButton}
            accessibilityLabel="Recentre the view">
            <Crosshair size={18} color={COLORS.bg} />
          </Pressable>
        </View>

        <Text style={styles.rule}>
          {!scene.hasSiteWalk
            ? 'Turn the phone to look around. Tap a place below to move there. No camera, no tracking — nothing here can drift.'
            : arWalk
            ? 'Walk. Your real steps move you through the fort at true scale — the camera is running for tracking but never shown.'
            : !siteMode
            ? 'Turn the phone to look. Use the pad to walk. Your own steps do not move you — most of this fort is under live roads now.'
            : site.active
              ? `Your own steps are moving you. Fix ±${Math.round(site.accuracyM ?? 0)} m.`
              : site.offSite
                ? `You are not at the fort. Your steps only move you within ${SITE_WALK_RADIUS_M} m of the Delhi Gate.`
                : site.error
                  ? `Location unavailable — ${site.error}. Using the pad instead.`
                  : 'Looking for a good enough fix…'}
        </Text>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.bg},

  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 13,
  },

  topGradient: {position: 'absolute', top: 0, left: 0, right: 0, height: 140},
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  titleBlock: {flex: 1},
  title: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: 20,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: COLORS.amber,
    fontFamily: FONTS.ui,
    fontSize: 12,
    marginTop: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  errorCard: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    top: '45%',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(10,10,12,0.92)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  errorText: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.ui,
    fontSize: 14,
    textAlign: 'center',
  },

  warningCard: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    top: '18%',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(120,40,40,0.92)',
  },
  warningText: {
    color: '#FFECEC',
    fontFamily: FONTS.ui,
    fontSize: 12,
    textAlign: 'center',
  },

  pointHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '38%',
    alignItems: 'center',
  },
  pointHintText: {
    color: COLORS.amberLight,
    fontFamily: FONTS.ui,
    fontSize: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(10,10,12,0.66)',
    overflow: 'hidden',
  },

  creditsLink: {
    color: COLORS.amberLight,
    fontFamily: FONTS.ui,
    fontSize: 11,
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  creditsText: {
    color: COLORS.textMuted,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 2,
  },

  stopNameOnly: {
    position: 'absolute',
    right: SPACING.lg,
    top: 96,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(10,10,12,0.72)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stopNameText: {
    color: COLORS.amberLight,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 12,
    letterSpacing: 0.3,
  },

  camHud: {
    position: 'absolute',
    left: SPACING.lg,
    top: 150,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(10,10,12,0.86)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  camHudHead: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  camHudLine: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
  camHudBad: {
    color: '#E8705A',
    fontFamily: FONTS.uiSemiBold,
  },
  camHudBig: {
    color: COLORS.amberLight,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 18,
    marginTop: 4,
  },
  camHudNote: {
    color: COLORS.textMuted,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 3,
  },

  rigTest: {
    position: 'absolute',
    left: SPACING.lg,
    top: 96,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(10,10,12,0.78)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rigTestText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  rigTestResult: {
    color: COLORS.amberLight,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginTop: 3,
  },

  personTab: {
    position: 'absolute',
    right: SPACING.lg,
    top: 96,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(10,10,12,0.72)',
    borderWidth: 1,
    borderColor: COLORS.borderFocus,
    alignItems: 'flex-end',
  },
  personName: {
    color: COLORS.amberLight,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 13,
  },
  personRole: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 1,
  },
  speech: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    top: 150,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(10,10,12,0.88)',
    borderWidth: 1,
    borderColor: COLORS.borderFocus,
  },
  speechText: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.ui,
    fontSize: 14,
    lineHeight: 21,
  },
  speechFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  speechMore: {
    color: COLORS.textMuted,
    fontFamily: FONTS.ui,
    fontSize: 10,
  },

  driftCard: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    top: 96,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(10,10,12,0.80)',
    borderWidth: 1,
    borderColor: COLORS.borderFocus,
  },
  driftTitle: {
    color: COLORS.amberLight,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  driftBody: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.ui,
    fontSize: 14,
    marginTop: 4,
  },
  driftNote: {
    color: COLORS.textMuted,
    fontFamily: FONTS.ui,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 6,
  },

  stickPad: {
    position: 'absolute',
    left: SPACING.lg,
    bottom: 210,
    width: STICK_R * 2,
    height: STICK_R * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickRing: {
    position: 'absolute',
    width: STICK_R * 2,
    height: STICK_R * 2,
    borderRadius: STICK_R,
    borderWidth: 1,
    borderColor: 'rgba(203,168,98,0.35)',
    backgroundColor: 'rgba(10,10,12,0.35)',
  },
  stickKnob: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(203,168,98,0.85)',
  },

  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  caption: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 12,
    lineHeight: 18,
  },

  legendRow: {flexDirection: 'row', gap: SPACING.md, alignItems: 'center'},
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: 'rgba(198,186,168,1)',
  },
  legendSwatchGhost: {backgroundColor: 'rgba(198,186,168,0.40)'},
  legendSwatchOpen: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(198,186,168,0.9)',
  },
  legendLabel: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
  legendDetail: {
    color: COLORS.textMuted,
    fontFamily: FONTS.ui,
    fontSize: 10,
    lineHeight: 15,
  },

  assaultBar: {
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderFocus,
    backgroundColor: 'rgba(180,85,63,0.16)',
    alignItems: 'center',
  },
  assaultCue: {
    color: COLORS.amberLight,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  assaultCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(10,10,12,0.88)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  assaultTitle: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: 16,
  },
  assaultText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  assaultNote: {
    color: COLORS.textMuted,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 6,
  },

  timelineRow: {flexDirection: 'row', gap: 4},
  era: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  eraOn: {backgroundColor: COLORS.amberSubtle, borderWidth: 1, borderColor: COLORS.borderFocus},
  eraYear: {color: COLORS.textTertiary, fontFamily: FONTS.ui, fontSize: 10},
  eraYearOn: {color: COLORS.amberLight, fontFamily: FONTS.uiSemiBold},
  eraNote: {
    color: COLORS.textMuted,
    fontFamily: FONTS.ui,
    fontSize: 10,
    lineHeight: 15,
  },
  eraLabel: {color: COLORS.amberLight, fontFamily: FONTS.uiSemiBold},

  whereRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  whereTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontFamily: FONTS.semiBold,
    fontSize: 17,
  },
  whereProgress: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.regular,
    fontSize: 12,
  },
  whereFacing: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
    fontSize: 13,
    marginTop: 2,
  },
  guide: {
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(20,20,22,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(212,134,10,0.35)',
    gap: 6,
  },
  guidePlace: {
    color: COLORS.amberLight,
    fontFamily: FONTS.semiBold,
    fontSize: 15,
  },
  guideWalk: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  guidePrimary: {
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.amber,
  },
  guidePrimaryText: {
    color: '#141414',
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  guideGhost: {paddingVertical: 10},
  guideGhostText: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.regular,
    fontSize: 13,
  },
  chipWithPhoto: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 6,
    overflow: 'hidden',
    alignItems: 'center',
    width: 96,
  },
  chipPhoto: {width: 96, height: 72, marginBottom: 4},
  railRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  rail: {gap: SPACING.xs, paddingRight: SPACING.sm},
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: COLORS.amberSubtle,
    borderColor: COLORS.borderFocus,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
  chipTextActive: {color: COLORS.amberLight, fontFamily: FONTS.uiSemiBold},

  siteButtonOn: {
    backgroundColor: COLORS.amberLight,
  },
  recenterButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.amber,
  },

  rule: {
    color: COLORS.textMuted,
    fontFamily: FONTS.ui,
    fontSize: 10,
    textAlign: 'center',
  },

  fallback: {flex: 1, backgroundColor: COLORS.bg},
  fallbackInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.screen,
    gap: SPACING.md,
  },
  fallbackTitle: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: 18,
  },
  fallbackBody: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  fallbackButton: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.amber,
  },
  fallbackButtonText: {
    color: COLORS.bg,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 14,
  },
});

export default MagicWindowScreen;
