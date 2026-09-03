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
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {
  Compass,
  Crosshair,
  Footprints,
  Info,
  Pause,
  Play,
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
import MagicWindowSheet from '../../features/magicwindow/MagicWindowSheet';
import FigureVoice from '../../features/magicwindow/FigureVoice';
import {ASSAULT} from '../../features/magicwindow/assault';
import {FORT_STATES} from '../../features/magicwindow/timeline';
import {resolveModelGlb} from '../../services/glbSource';
import {isAdminUser} from '../../shared/auth/isAdminUser';
import {useSafeBackHandler} from '../../shared/hooks/useSafeGoBack';
import {COLORS, FONTS, RADIUS, SPACING} from '../../core/constants/theme';
import {STORAGE_KEYS} from '../../core/constants/storage-keys';

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

  /**
   * The detail sheet. Everything that is not the reconstruction lives behind
   * this one control - see MagicWindowSheet for what moved and why.
   */
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * The visitor's own pause, held separately from the figure's ducking.
   *
   * It rides `suspended` rather than the player's internal `paused` because
   * there is no imperative handle on <AudioPlayer/> and the transport now lives
   * inside the sheet. `suspended` holds playback WITHOUT losing the position,
   * which is the whole point for a 105 s clip.
   */
  const [audioHeld, setAudioHeld] = useState(false);
  /** What the player reports it is actually doing, for the glyph. */
  const [audioPaused, setAudioPaused] = useState(true);

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
  /**
   * Who is at THIS viewpoint, or nobody.
   *
   * THE `?? people[0]` FALLBACK IS GONE, and it was the whole bug. With one
   * person in the list it made `person` unconditionally Purnaiah at every
   * stop, and since the load effect below had no viewpoint gate he was posed
   * at (0.45, 14.0) floor 2.6 for the entire session - visible from the lawn,
   * 28 m away, because nothing ever removed him. The fallback was written so a
   * scene "never silently loses its figure"; what it actually did was put a
   * figure in seven rooms he is not in.
   *
   * `find` returns the FIRST match, so `visibleFrom` sets must be disjoint.
   * They are, per person, and that is a requirement rather than a tidiness:
   * two people claiming one viewpoint would make the second unreachable, which
   * is exactly the state FORT_PEOPLE is in - both omit `visibleFrom`, so the
   * fort's second figure can never be selected.
   */
  const person: MagicWindowPerson | undefined = useMemo(
    () =>
      people.find(
        pp => !pp.visibleFrom || pp.visibleFrom.includes(viewpoint.id),
      ),
    [people, viewpoint.id],
  );
  /**
   * The figure can actually be SEEN from where the visitor is standing.
   *
   * ONE predicate, THREE consumers now: the point hint, the person tab, and -
   * as of this change - the figure itself. It was written inline in the hint
   * and omitted from the tab; a later fix enrolled the tab and left the figure
   * out, which is why the durbar hall could show "Someone is here" while the
   * lawn showed the man. The prompt was never the thing that was wrong.
   *
   * Now that `person` is undefined where nobody is placed, this is `!!person`
   * for every list whose `visibleFrom` sets are complete. The second clause is
   * kept for a person who declares none at all - the fort's two - where the
   * honest answer is still "visible everywhere".
   */
  const personVisible =
    !!person &&
    (!person.visibleFrom || person.visibleFrom.includes(viewpoint.id));

  /**
   * Load and pose the figure for the CURRENT viewpoint, and clear it when
   * there is nobody here.
   *
   * The clear is the fix. Without it the native view keeps the last figure it
   * was given - `setFigure` only reloads when the uri changes - so walking from
   * the durbar hall to the lawn left Purnaiah standing in the lawn scene.
   *
   * FAILURES ARE LOUD NOW. This was `catch {}` with "Silent: the fort is the
   * deliverable, the figure is an addition", and that silence is what made a
   * missing figure indistinguishable from a figure that failed to resolve.
   * A falsy uri is a real outcome too - resolveModelGlb returns null when no
   * CDN base is configured - and it deserves a line rather than an early
   * return that looks like success.
   */
  useEffect(() => {
    if (!person) {
      setFigure(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const modelId = rigTest ? RIG_TEST_MODEL_ID : person.modelId;
      try {
        const uri = await resolveModelGlb(modelId);
        if (cancelled) return;
        if (!uri) {
          console.warn(
            `[magicwindow] figure ${person.id}: no URL for ${modelId} - ` +
              'GLB_BASE_URL unset or the model is not published',
          );
          setFigure(null);
          return;
        }
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
      } catch (err) {
        if (cancelled) return;
        console.warn(`[magicwindow] figure ${person.id} (${modelId}) failed`, err);
        setFigure(null);
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

  // VOICE, by one of two paths.
  //
  // RECORDED, when the person carries a `voiceKeyPrefix`: Chirp 3 HD clips off
  // the same CDN and through the same mediaCache as the guide narration. This
  // is what Purnaiah uses.
  //
  // DEVICE TTS otherwise, via Android's TextToSpeech. That is whatever voice the
  // handset ships — different on every phone, and sharing nothing with the
  // narrator the visitor has been listening to. It stays only because the fort's
  // Tipu figure has no recordings yet; deleting it would silence him.
  //
  // `speaking` means the figure is talking, whichever path produced the sound,
  // because its only job is to duck the guide narration underneath.
  const [ttsReady, setTtsReady] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  // Set by the prefetch below when every one of a figure's clips fails.
  // Declared here, not beside that effect, because `recordedVoice` reads
  // it on the very next line and a `const` is in its temporal dead zone
  // until then — which crashes the screen rather than falling back.
  const [voiceUnreachable, setVoiceUnreachable] = useState(false);
  // Recorded AND reachable. A prefix whose clips all fail is not a voice,
  // and treating it as one is what silenced Purnaiah with no error anywhere.
  const recordedVoice = !!person?.voiceKeyPrefix && !voiceUnreachable;
  const canSpeak = recordedVoice || ttsReady;
  useEffect(() => {
    let cancelled = false;
    void prepareSpeech().then(ok => {
      if (!cancelled) setTtsReady(ok);
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

  /**
   * Which utterance is playing. Counted rather than derived from `lineIndex`,
   * because tapping the SAME line again has to replay it — and a line index
   * that has not changed is indistinguishable from one that has been retapped.
   */
  const [utterance, setUtterance] = useState(0);
  /**
   * The card that hangs beside him in the world, for the line he is on.
   *
   * ROUTED THROUGH renderDiscovery, per the standing rule, and that is the whole
   * reason this is worth building. The two card renderers draw opposite
   * promises: a recognition card's confidence is a statement about OUR MODEL and
   * is never shown to a visitor, while a discovery card's `meta` is the
   * provenance of the fact itself and is the most important thing on the card.
   *
   * A figure's lines already carry exactly that. `tier` and `source` have been
   * on every line since the type was written, and until now nothing drew them -
   * the speech bubble shows the sentence and keeps the apparatus out of sight,
   * which is right for a bubble and wrong for a card whose job is the evidence.
   *
   * So: a figure identified from a portrait painted from life says so, and one
   * whose likeness is conjectural says that instead. Nothing here decides which
   * - the line's own tier does.
   *
   * ACCENT IS TIER, not confidence. Green only for CONFIRMED; INFERRED,
   * DISPUTED and NOT-A-CLAIM are all muted, because "we reasoned this", "sources
   * disagree" and "nobody recorded this" are none of them a confirmed fact and
   * colouring them alike is the honest simplification.
   */
  const figureCard = useMemo(() => {
    if (!person || lineIndex === null || !personVisible) return null;
    const line = person.lines[lineIndex];
    if (!line) return null;
    return JSON.stringify({
      title: person.name,
      // The tier leads, then the source, exactly as the renderer's own example
      // reads: "CONFIRMED · C. Mackenzie 1791, key 4".
      meta: `${line.tier} \u00b7 ${line.source}`,
      body: line.text,
      accent: line.tier === 'CONFIRMED' ? 'green' : 'muted',
    });
  }, [person, lineIndex, personVisible]);

  const figureLineRemote = useMemo(() => {
    if (!recordedVoice || lineIndex === null || !voiceOn) return null;
    return buildAudioUrl(`${person!.voiceKeyPrefix}line_${lineIndex + 1}_en.mp3`);
  }, [person, recordedVoice, lineIndex, voiceOn]);

  // Through the same LRU as the guide clips, and for the same reason: this plays
  // inside a stone-walled building where the signal is poor, and a line that
  // buffers after the tap has already lost the moment. Falls back to the remote
  // URL when the cache cannot produce a file, exactly as the narration does.
  //
  // THE FILE AND THE KEY ARE ONE PIECE OF STATE, and that is the whole point.
  // Held separately, the key advanced on the tap while the file was still being
  // resolved out of the cache, so <FigureVoice/> saw the NEXT line's key beside
  // the PREVIOUS line's file and did exactly what it is told to do — replayed
  // it. Measured on device: `player piid:8815 started 15:53:18.000, stopped
  // 15:53:18.182` between line 1 and line 2. 182 ms of the wrong man's sentence,
  // every time the visitor taps. Updating them together makes the mismatched
  // pair unrepresentable rather than merely unlikely.
  const [figureLine, setFigureLine] = useState<{uri: string; key: string} | null>(
    null,
  );
  useEffect(() => {
    const key =
      person && lineIndex !== null
        ? `${person.id}-${lineIndex}-${utterance}`
        : null;
    if (!figureLineRemote || !key) {
      setFigureLine(null);
      return;
    }
    let cancelled = false;
    void getOrFetchMedia(figureLineRemote)
      .then(u => {
        if (!cancelled) setFigureLine({uri: u, key});
      })
      .catch(() => {
        if (!cancelled) setFigureLine({uri: figureLineRemote, key});
      });
    return () => {
      cancelled = true;
    };
  }, [figureLineRemote, person, lineIndex, utterance]);

  /**
   * All of a figure's lines, warmed as soon as he is on screen. Five clips of
   * roughly 50 KB; the visitor taps through them in sequence anyway.
   *
   * AND IT REPORTS WHAT FAILED, which it did not before. `prefetchMedia` returns
   * {total, cached, failed} and this discarded it, while `getOrFetchMedia`
   * returns the REMOTE URL on any error rather than rejecting — so five clips
   * 404ing produced no log, no error state and no rejected promise anywhere. The
   * figure just waved and said nothing, for ever. `voiceUnreachable` is what
   * puts the device-TTS fallback back in play; see `advance`.
   */
  useEffect(() => {
    if (!person?.voiceKeyPrefix || !personVisible) return;
    const urls = person.lines
      .map((_l, i) =>
        buildAudioUrl(`${person.voiceKeyPrefix}line_${i + 1}_en.mp3`),
      )
      .filter((u): u is string => !!u);
    if (urls.length === 0) {
      setVoiceUnreachable(true);
      return;
    }
    let cancelled = false;
    void prefetchMedia(urls).then(s => {
      if (cancelled) return;
      // EVERY line failing is a broken figure; some failing is a bad network on
      // one file, which the player can still retry from the CDN.
      const dead = s.failed >= s.total;
      setVoiceUnreachable(dead);
      if (s.failed > 0) {
        console.warn(
          `[magicwindow] ${person.id}: ${s.failed}/${s.total} voice clips ` +
            `unreachable${dead ? ' — falling back to device speech' : ''}`,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [person, personVisible]);


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
    // Bumped even when the line index does not change, so retapping the last
    // line replays it rather than sitting silently at the end of the clip.
    setUtterance(u => u + 1);
    setLineIndex(i => {
      const next = i === null ? 0 : (i + 1) % person.lines.length;
      // A recorded figure is driven by <FigureVoice/> off the line key. Only
      // the device-TTS fallback has to be told to start talking.
      if (voiceOn && !recordedVoice && ttsReady) {
        speak(person.lines[next].text, `${person.id}-${next}`);
      }
      return next;
    });
  }, [person, voiceOn, recordedVoice, ttsReady]);

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

  // ---- WHAT THE SUBTRACTED LAYOUT NEEDS ----------------------------------

  /**
   * The single line over the reconstruction.
   *
   * Before the visitor confirms, it is the tour's walk-to - where to go. After,
   * it is where they are. One line, two tenses, replacing the four elements
   * that used to say it between them: the stop title, "1 of 8", the facing
   * sentence and the caption.
   *
   * `facing` is emitted from the build off the TRUE bearing; headingDeg is
   * frame-relative and would say "north" here.
   */
  const whereLine = useMemo(() => {
    if (tourStop && !arrived) return tourStop.walkTo;
    const place = tourStop?.place ?? viewpoint.title;
    return viewpoint.facing
      ? `You are in ${place}, looking ${viewpoint.facing}.`
      : `You are in ${place}.`;
  }, [tourStop, arrived, viewpoint.title, viewpoint.facing]);

  /**
   * ONE player instance, and it lives in the sheet.
   *
   * It is created here rather than inside MagicWindowSheet so the glyph on the
   * reconstruction and the transport in the sheet drive the same component. The
   * sheet is never unmounted, so a 105 s clip survives the sheet being closed.
   */
  const playerNode =
    clipUri && stopForView && (!tourActive || arrived) ? (
      <AudioPlayer
        uri={clipUri}
        sourceKey={stopForView.stop_key}
        title={stopForView.title}
        autoPlay
        suspended={speaking || audioHeld}
        // `the_lost_colour` runs 105 s and this is a screen a visitor holds up
        // and then lowers. The lock-screen transport is how they pause it
        // without coming back in. Ducking a figure's speech over it raises
        // `suspended`, which the notification reflects as paused - correct: it
        // is paused, briefly, and the visitor can see why on screen.
        showNotificationControls
        notificationSubtitle={scene.title}
        onPausedChange={setAudioPaused}
      />
    ) : null;

  /** Sound is actually coming out: not paused, not ducked, not held. */
  const audioSounding = !!playerNode && !audioPaused && !speaking && !audioHeld;

  /**
   * The one-time hint that replaced the permanent instruction line.
   *
   * Starts false so a returning visitor never sees a flash of it while the
   * flag loads; the effect raises it only when the flag is genuinely absent.
   */
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEYS.MAGIC_WINDOW.HINT_SEEN)
      .then(seen => {
        if (!cancelled && seen !== 'true') setShowHint(true);
      })
      .catch(() => {
        // A storage failure must not cost the visitor the reconstruction.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const dismissHint = useCallback(() => {
    setShowHint(false);
    void AsyncStorage.setItem(
      STORAGE_KEYS.MAGIC_WINDOW.HINT_SEEN,
      'true',
    ).catch(() => {});
  }, []);

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
        figureCard={figureCard}
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

      {/* THE WAY OUT, and nothing else up here.
          The title and subtitle went: "Tipu Sultan's Summer Palace / as it was
          painted" is answered by the reconstruction itself and by the screen the
          visitor tapped to get here. The gradient went with them - it existed to
          make that text legible, and unlit it was just a bruise across the top
          of the building. */}
      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
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
      {/* The figure's voice. Audio only, no transport, no notification — one
          recorded line at a time. `speaking` ducks the guide narration under it,
          exactly as it did under device TTS. */}
      <FigureVoice
        uri={figureLine?.uri ?? null}
        lineKey={figureLine?.key ?? null}
        onSpeakingChange={setSpeaking}
      />

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
                    // The recorded path stops by unmounting, which fires no
                    // callback, so the duck has to be lifted here or the guide
                    // narration stays suspended after a mute.
                    setSpeaking(false);
                  } else {
                    setVoiceOn(true);
                    setUtterance(u => u + 1);
                    if (!recordedVoice && ttsReady) {
                      speak(
                        person.lines[lineIndex].text,
                        `${person.id}-${lineIndex}`,
                      );
                    }
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

      {/* -- THE ONLY THINGS OVER THE RECONSTRUCTION ----------------------
          Where you are, how far through you are, the tour's action, the
          controls, and one line of honesty. Everything else moved into the
          sheet behind the info control. */}
      <LinearGradient
        colors={['transparent', 'rgba(10,10,12,0.86)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />
      <SafeAreaView
        style={styles.bottomBar}
        edges={['bottom']}
        pointerEvents="box-none">
        {/* ONE LINE, DOING DOUBLE DUTY. Before the visitor confirms it is the
            walk-to: where to go. After, it is where they are. The same question
            in a different tense, which is why it can be one line rather than
            the four it used to take (title, progress, facing, caption). */}
        {/* Three lines, not two: the tour's walk-to instructions run long
            ("Stand out on the lawn in front of the palace, far enough back to
            see the whole front at once. Face the building.") and clipping one
            mid-word is worse than the line it replaced. */}
        <Text style={styles.where} numberOfLines={3}>
          {whereLine}
        </Text>

        {/* PROGRESS AS A RULE, NOT AS WORDS. "1 of 8" is a number the visitor
            has to read and convert; a filled tick is a glance. Skipped stops
            stay visible as hollow ticks, because progress that quietly forgets
            what you walked past is not honest about the visit. */}
        {tour.length > 0 ? (
          <View
            style={styles.progress}
            accessibilityLabel={`Stop ${tourIndex + 1} of ${tour.length}`}>
            {tour.map((st, i) => (
              <View
                key={st.viewpointId}
                style={[
                  styles.tick,
                  tourActive && i === tourIndex && styles.tickOn,
                  skipped.includes(st.viewpointId) && styles.tickSkipped,
                ]}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.actionRow}>
          {/* THE TOUR'S OWN ACTION. `Skip` stays beside it: a visitor who
              cannot reach a stop - a closed room, a locked stair - needs a way
              past that keeps them in the tour, and jumping from the sheet drops
              them out of it entirely. */}
          {tourStop ? (
            <View style={styles.tourActions}>
              {!arrived ? (
                <Pressable
                  onPress={confirmArrived}
                  style={styles.primary}
                  accessibilityLabel={`I am at ${tourStop.place}`}>
                  <Text style={styles.primaryText}>I&apos;m here</Text>
                </Pressable>
              ) : tourIndex < tour.length - 1 ? (
                <Pressable
                  onPress={() => nextTourStop(true)}
                  style={styles.primary}>
                  <Text style={styles.primaryText}>Next stop</Text>
                </Pressable>
              ) : (
                <Pressable onPress={openRail} style={styles.primary}>
                  <Text style={styles.primaryText}>That&apos;s the tour</Text>
                </Pressable>
              )}
              {!arrived && tourIndex < tour.length - 1 ? (
                <Pressable
                  onPress={() => nextTourStop(false)}
                  hitSlop={10}
                  style={styles.ghost}>
                  <Text style={styles.ghostText}>Skip</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.tourActions} />
          )}

          <View style={styles.controls}>
            {/* PLAY/PAUSE ONLY. Scrub, speed and the transcript are in the
                sheet; this is the one audio control a visitor needs without
                looking at the screen. It rides `suspended`, the same hold the
                figure's speech uses, so the clip resumes at its position
                rather than restarting a 105 s narration. */}
            {playerNode ? (
              <Pressable
                onPress={() => setAudioHeld(v => !v)}
                hitSlop={10}
                style={styles.control}
                accessibilityLabel={
                  audioSounding ? 'Pause narration' : 'Play narration'
                }>
                {audioSounding ? (
                  <Pause size={18} color={COLORS.amber} />
                ) : (
                  <Play size={18} color={COLORS.amber} />
                )}
              </Pressable>
            ) : null}

            {scene.hasSiteWalk ? (
              <>
                <Pressable
                  onPress={() => {
                    setArWalk(v => !v);
                    setDrift(null);
                  }}
                  hitSlop={10}
                  style={[styles.control, arWalk && styles.controlOn]}
                  accessibilityLabel="Walk through the fort for real">
                  <Compass size={18} color={arWalk ? COLORS.bg : COLORS.amber} />
                </Pressable>
                <Pressable
                  onPress={() => setSiteMode(v => !v)}
                  hitSlop={10}
                  style={[styles.control, siteMode && styles.controlOn]}
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
              style={styles.control}
              accessibilityLabel="Recentre the view">
              <Crosshair size={18} color={COLORS.amber} />
            </Pressable>

            {/* THE ONE CONTROL THAT OPENS EVERYTHING ELSE. */}
            <Pressable
              onPress={() => setSheetOpen(true)}
              hitSlop={10}
              style={[styles.control, styles.controlPrimary]}
              accessibilityLabel="Plan, legend, places and transcript">
              <Info size={18} color={COLORS.bg} />
            </Pressable>
          </View>
        </View>

        {/* THE WALK'S STATE, and only while a walk is switched on.
            The instruction line this replaced was two different things wearing
            one style: "turn the phone to look around", which is a first-run
            hint and is now shown once, and this - whether the visitor's own
            steps are actually moving them, and how good the fix is. State is
            not instruction. Dropping it would leave the fort's site mode with
            no feedback at all, so it stays, gated on the mode being on. */}
        {scene.hasSiteWalk && (arWalk || siteMode) ? (
          <Text style={styles.status}>
            {arWalk
              ? 'Your real steps are moving you at true scale.'
              : site.active
                ? `Your own steps are moving you. Fix ±${Math.round(
                    site.accuracyM ?? 0,
                  )} m.`
                : site.offSite
                  ? `You are not at the fort. Your steps only move you within ${SITE_WALK_RADIUS_M} m of the Delhi Gate.`
                  : site.error
                    ? `Location unavailable — ${site.error}. Using the pad instead.`
                    : 'Looking for a good enough fix…'}
          </Text>
        ) : null}

        {/* SMALL, PERMANENT, AND NOT NEGOTIABLE. The one claim the screen must
            never stop making about itself. */}
        <Text style={styles.disclaimer}>A reconstruction, not a photograph.</Text>
      </SafeAreaView>

      {/* THE SHEET. Always mounted - the single AudioPlayer lives inside it and
          unmounting would restart the clip every time it closed. */}
      <MagicWindowSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        scene={scene}
        viewpoint={viewpoint}
        index={index}
        onSelectViewpoint={i => {
          selectViewpoint(i);
          setTourActive(false);
          setSheetOpen(false);
        }}
        headingDeg={headingDeg}
        transcript={stopForView?.clip?.transcript}
        player={playerNode}>
        {scene.hasAssault ? (
          <View style={styles.sheetBlock}>
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
          </View>
        ) : null}

        {scene.hasTimeline ? (
          <View style={styles.sheetBlock}>
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
          </View>
        ) : null}
      </MagicWindowSheet>

      {/* THE HINT, ONCE. This replaces a permanent instruction line that sat
          under every reconstruction telling the visitor to turn the phone.
          Discoverability is a first-run problem, not a standing one. */}
      {showHint && ready && !error ? (
        <Pressable style={styles.hintScrim} onPress={dismissHint}>
          <View style={styles.hintCard}>
            <Text style={styles.hintText}>
              {scene.hasSiteWalk
                ? 'Turn the phone to look around. Use the pad to walk.'
                : 'Turn the phone to look around.'}
            </Text>
            <Text style={styles.hintDismiss}>Tap to start</Text>
          </View>
        </Pressable>
      ) : null}
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

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    // flex-end, not space-between: the title block that used to sit on the
    // left is gone, and space-between with a single child pushes the close
    // button to the WRONG side of the screen.
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
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

  // ---- the subtracted layout -------------------------------------------
  where: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.ui,
    fontSize: 15,
    lineHeight: 21,
  },
  progress: {flexDirection: 'row', gap: 4, marginTop: 2},
  tick: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  tickOn: {backgroundColor: COLORS.amber, height: 3},
  tickSkipped: {backgroundColor: 'rgba(255,255,255,0.08)'},
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  tourActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 1,
  },
  primary: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.amber,
  },
  primaryText: {
    color: COLORS.bg,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 14,
  },
  ghost: {paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm},
  ghostText: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.ui,
    fontSize: 13,
  },
  controls: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  control: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,12,0.72)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  controlOn: {backgroundColor: COLORS.amber, borderColor: COLORS.amber},
  controlPrimary: {backgroundColor: COLORS.amber, borderColor: COLORS.amber},
  status: {
    color: COLORS.amberLight,
    fontFamily: FONTS.ui,
    fontSize: 12,
    lineHeight: 17,
  },
  disclaimer: {
    color: COLORS.textMuted,
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
  sheetBlock: {marginBottom: SPACING.lg},

  hintScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,12,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  hintCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(10,10,12,0.92)',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  hintText: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.ui,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 23,
  },
  hintDismiss: {
    color: COLORS.amber,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 13,
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
