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
} from '../../native/EpocheyeMagicWindowView';
import {
  MAGIC_WINDOW_LEGEND,
  MAGIC_WINDOW_MODEL_ID,
  MAGIC_WINDOW_VIEWPOINTS,
  toNativeViewpoint,
} from '../../features/magicwindow/viewpoints';
import {
  MAGIC_WINDOW_PEOPLE,
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
const EXPECTED_SCENE_SPAN_M = 3000;
const SCALE_TOLERANCE = 0.25;

/** The circuit itself: 443.5 m east-west by 576.5 m north-south (2b x 2a). */
const CIRCUIT_EW_M = 443.5;
const CIRCUIT_NS_M = 576.5;

/** Radius of the walk pad, in points. */
const STICK_R = 46;
const ZERO_WALK = {forward: 0, right: 0} as const;

const MagicWindowScreen: React.FC = () => {
  const safeGoBack = useSafeBackHandler();
  const viewRef = useRef<EpocheyeMagicWindowHandle>(null);

  const [glbUri, setGlbUri] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scaleWarning, setScaleWarning] = useState<string | null>(null);

  const viewpoint = MAGIC_WINDOW_VIEWPOINTS[index];

  // SITE MODE. When the visitor is actually standing at Bangalore Fort, their
  // real position drives the camera. Off-site it is inert, and the on-screen pad
  // does the walking instead — see useSiteWalk for why that boundary exists.
  const [siteMode, setSiteMode] = useState(false);
  const site = useSiteWalk(siteMode);

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
        const uri = await resolveModelGlb(MAGIC_WINDOW_MODEL_ID);
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
  }, []);

  // PHASE 4 blocking test. Admin-only, and reported rather than assumed: a rig
  // can load with animations present and never tick, which looks exactly like a
  // static mesh.
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
  const person: MagicWindowPerson | undefined = MAGIC_WINDOW_PEOPLE[0];
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
          const i = MAGIC_WINDOW_VIEWPOINTS.findIndex(x => x.id === vpId);
          if (i >= 0) setIndex(i);
        }
        setStateId(3); // the fort as it stood, with the siege marked on it
      }
      return next;
    });
  }, []);

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
      const ratio = span / EXPECTED_SCENE_SPAN_M;
      if (ratio < 1 - SCALE_TOLERANCE || ratio > 1 + SCALE_TOLERANCE) {
        // Say it out loud rather than rendering a convincing miniature. Report
        // the implied size of the CIRCUIT, since that is the number a reader can
        // judge — the raw span is the sky dome and means nothing on its own.
        setScaleWarning(
          `Scale check failed: the reconstruction is at ${(ratio * 100).toFixed(0)}% ` +
            `of true scale — the circuit would measure ` +
            `${(CIRCUIT_EW_M * ratio).toFixed(1)} × ${(CIRCUIT_NS_M * ratio).toFixed(1)} m ` +
            `instead of ${CIRCUIT_EW_M} × ${CIRCUIT_NS_M} m.`,
        );
      } else {
        setScaleWarning(null);
      }
    },
    [],
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
        onModelLoaded={onModelLoaded}
        onLoadError={onLoadError}
        onFigureTapped={onFigureTapped}
        onRigProbe={onRigProbe}
      />

      {!ready && !error ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={COLORS.amber} />
          <Text style={styles.loadingText}>Rebuilding the circuit…</Text>
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
          <Text style={styles.title}>Bangalore Fort</Text>
          <Text style={styles.subtitle}>as it stood, 1791</Text>
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

      {figure && person && !everSpoke && ready ? (
        <View style={styles.pointHint} pointerEvents="none">
          <Text style={styles.pointHintText}>
            Someone is here. Walk up and tap him.
          </Text>
        </View>
      ) : null}

      {isAdminUser() ? (
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
      {figure && person ? (
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
      {ready && !error ? (
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
        <Text style={styles.caption}>{viewpoint.caption}</Text>

        <View style={styles.legendRow}>
          {MAGIC_WINDOW_LEGEND.map(item => (
            <View key={item.key} style={styles.legendItem}>
              <View
                style={[
                  styles.legendSwatch,
                  item.key === 'ghost' && styles.legendSwatchGhost,
                  item.key === 'open' && styles.legendSwatchOpen,
                ]}
              />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.legendDetail}>
          {MAGIC_WINDOW_LEGEND[1].detail} {MAGIC_WINDOW_LEGEND[2].detail}
        </Text>

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

        <View style={styles.railRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}>
            {MAGIC_WINDOW_VIEWPOINTS.map((vp, i) => {
              const active = i === index;
              return (
                <Pressable
                  key={vp.id}
                  onPress={() => selectViewpoint(i)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}>
                    {vp.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
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
            <Footprints size={18} color={siteMode ? COLORS.bg : COLORS.amber} />
          </Pressable>
          <Pressable
            onPress={recenter}
            hitSlop={10}
            style={styles.recenterButton}
            accessibilityLabel="Recentre the view">
            <Crosshair size={18} color={COLORS.bg} />
          </Pressable>
        </View>

        <Text style={styles.rule}>
          {arWalk
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
