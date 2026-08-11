/**
 * TourHost — driver + renderer for the first-run guided product tour.
 *
 * Mounted once at the app root (App.tsx, next to <DialogHost/>), ABOVE the
 * NavigationContainer, so it overlays every screen. For each step it navigates
 * via the shared navigationRef and spotlights the element that screen registered
 * through useTourTarget.
 *
 * Geometry notes, because all of them were previously wrong:
 *
 * - COORDINATE SPACE IS CALIBRATED, NOT ASSUMED. Targets report window coords
 *   (measureInWindow); this overlay draws in its own local space. Those agree
 *   only when the overlay's origin is the window origin, which is not guaranteed
 *   under Android edge-to-edge. So the root measures itself and every rect is
 *   translated by that origin — a no-op when the spaces already match.
 * - THE RECT IS LIVE, NOT LATCHED. The host subscribes to the target's entry in
 *   tourStore for the whole step. The old code polled and committed the first
 *   acceptable rect, freezing the spotlight at its mid-transition position.
 * - PARTIALLY-VISIBLE TARGETS STILL COUNT. A target only has to overlap the
 *   viewport; the drawn box is clamped to it. Requiring full containment meant a
 *   flex:1 element running to the screen edge (Home's map) could never spotlight.
 *
 * The tooltip card renders immediately on every step — centered while the target
 * is still navigating/measuring, then anchored once the rect resolves. It is
 * measured before placement so it can neither cover the spotlight nor slide off
 * screen. "Skip tour" lives inside it: as a floating pill it collided with the
 * header on all four tabs.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {Defs, Mask, Rect as SvgRect} from 'react-native-svg';
import {ChevronDown, ChevronUp, ChevronRight, ArrowLeft} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';

import {COLORS, FONTS} from '../../core/constants/theme';
import {moderateScale} from '../../utils/scaling';
import {ROUTES} from '../../core/constants';
import {navigateSafe} from '../../navigation/navigationRef';
import {useTourStore, type TourRect} from '../../stores/tourStore';
import {TOUR_STEPS, type TourStep} from '../../constants/appTour';

/** Breathing room between the target's own bounds and the cutout edge. */
const SPOT_PAD = 6;
/** Fallback cutout radius when a target doesn't declare its own. */
const SPOT_RADIUS = 16;
/** Gap that leaves room for the bouncing arrow cue between spot and card. */
const ARROW_GAP = 58;
/** Fallback gap used when the card can't fit with the arrows shown. */
const TIGHT_GAP = 22;
/** Height reserved for the floating tab bar so the card never hides under it. */
const TAB_BAR_CLEARANCE = 78;

interface SpotBox {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

const TourHost: React.FC = () => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {width: SCREEN_W, height: SCREEN_H} = useWindowDimensions();

  const running = useTourStore(s => s.running);
  const stepIndex = useTourStore(s => s.stepIndex);
  const next = useTourStore(s => s.next);
  const back = useTourStore(s => s.back);
  const skip = useTourStore(s => s.skip);

  const step: TourStep | undefined = TOUR_STEPS[stepIndex];

  // Live rect for this step's target. tourStore clears `targets` on every step
  // change, so this can never be a leftover from an earlier screen.
  const rawRect = useTourStore(s =>
    step?.targetId ? s.targets[step.targetId] : undefined,
  );

  const rootRef = useRef<View>(null);
  const [origin, setOrigin] = useState({x: 0, y: 0});
  const [cardH, setCardH] = useState(0);

  const calibrate = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        setOrigin(prev => (prev.x === x && prev.y === y ? prev : {x, y}));
      }
    });
  }, []);

  const navigateForStep = useCallback((s: TourStep) => {
    switch (s.nav.kind) {
      case 'tab':
        navigateSafe(ROUTES.MAIN.TABS, {screen: s.nav.tab});
        break;
      case 'screen':
        navigateSafe(s.nav.route, s.nav.params);
        break;
    }
  }, []);

  useEffect(() => {
    if (!running || !step) return;
    navigateForStep(step);
  }, [running, step, navigateForStep]);

  // Hardware back steps backwards (skip at the first step) instead of leaving.
  useEffect(() => {
    if (!running) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (useTourStore.getState().stepIndex === 0) skip();
      else back();
      return true;
    });
    return () => sub.remove();
  }, [running, back, skip]);

  // Bouncing arrow cue — only animate while the tour runs. TourHost stays
  // mounted for the app's whole lifetime, so an unconditional infinite
  // withRepeat would spin forever in the background.
  const bounce = useSharedValue(0);
  useEffect(() => {
    if (!running) return undefined;
    bounce.value = withRepeat(
      withSequence(
        withTiming(1, {duration: 620, easing: Easing.inOut(Easing.quad)}),
        withTiming(0, {duration: 620, easing: Easing.inOut(Easing.quad)}),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(bounce);
      bounce.value = 0;
    };
  }, [running, bounce]);

  const viewTop = insets.top;
  const viewBottom = SCREEN_H - insets.bottom;

  /**
   * Translate the target's window rect into overlay space, then clamp it to the
   * visible area. Null when the target doesn't overlap the viewport at all.
   */
  const spot = useMemo<SpotBox | null>(() => {
    if (!rawRect) return null;
    const r: TourRect = {
      ...rawRect,
      x: rawRect.x - origin.x,
      y: rawRect.y - origin.y,
    };
    if (r.width <= 0 || r.height <= 0) return null;
    if (r.y + r.height <= viewTop || r.y >= viewBottom) return null;

    const left = Math.max(r.x - SPOT_PAD, 4);
    const right = Math.min(r.x + r.width + SPOT_PAD, SCREEN_W - 4);
    const top = Math.max(r.y - SPOT_PAD, viewTop + 4);
    const bottom = Math.min(r.y + r.height + SPOT_PAD, viewBottom - 4);
    if (right - left <= 0 || bottom - top <= 0) return null;

    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      radius: (rawRect.radius ?? SPOT_RADIUS) + SPOT_PAD,
    };
  }, [rawRect, origin, viewTop, viewBottom, SCREEN_W]);

  /**
   * Place the card in whichever band actually has room for its measured height,
   * honouring the step's preferred side when it fits. Falls back to a tighter
   * gap (dropping the arrow cue) before it will overlap the spotlight.
   */
  const placement = useMemo(() => {
    const minTop = insets.top + 12;
    const maxBottom = viewBottom - TAB_BAR_CLEARANCE;
    const height = cardH || 200;

    if (!spot) {
      return {
        top: Math.max(minTop, (SCREEN_H - height) / 2),
        below: false,
        arrows: false,
      };
    }

    const prefersBelow =
      step?.placement === 'bottom'
        ? true
        : step?.placement === 'top'
          ? false
          : spot.y + spot.height < SCREEN_H * 0.55;

    const tryGap = (gap: number) => {
      const roomBelow = maxBottom - (spot.y + spot.height) - gap;
      const roomAbove = spot.y - gap - minTop;
      const fitsBelow = roomBelow >= height;
      const fitsAbove = roomAbove >= height;

      if (prefersBelow && fitsBelow) {
        return {top: spot.y + spot.height + gap, below: true};
      }
      if (!prefersBelow && fitsAbove) {
        return {top: spot.y - gap - height, below: false};
      }
      if (fitsBelow) return {top: spot.y + spot.height + gap, below: true};
      if (fitsAbove) return {top: spot.y - gap - height, below: false};
      return null;
    };

    const withArrows = tryGap(ARROW_GAP);
    if (withArrows) return {...withArrows, arrows: true};

    const tight = tryGap(TIGHT_GAP);
    if (tight) return {...tight, arrows: false};

    // Neither side fits — take the roomier one and clamp into the viewport.
    const roomBelow = maxBottom - (spot.y + spot.height);
    const roomAbove = spot.y - minTop;
    const below = roomBelow >= roomAbove;
    return {
      top: below
        ? Math.max(minTop, maxBottom - height)
        : Math.max(minTop, Math.min(spot.y - TIGHT_GAP - height, maxBottom - height)),
      below,
      arrows: false,
    };
  }, [spot, cardH, insets.top, viewBottom, SCREEN_H, step?.placement]);

  const onCardLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setCardH(prev => (Math.abs(prev - h) < 1 ? prev : h));
  }, []);

  if (!running || !step) return null;

  const total = TOUR_STEPS.length;
  const isLast = stepIndex >= total - 1;
  const isFirst = stepIndex === 0;
  const dimColor = '#08080A';

  return (
    <View
      ref={rootRef}
      onLayout={calibrate}
      collapsable={false}
      style={styles.root}
      pointerEvents="box-none">
      {/* Touch sink — blocks all underlying interaction (forced walkthrough). */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />

      {/* Scrim with a rounded hole punched out of it, so the spotlight's corners
          match the card beneath instead of leaving dark square notches. */}
      <Svg
        width={SCREEN_W}
        height={SCREEN_H}
        style={StyleSheet.absoluteFill}
        pointerEvents="none">
        <Defs>
          <Mask id="tourSpot" x={0} y={0} width={SCREEN_W} height={SCREEN_H}>
            <SvgRect
              x={0}
              y={0}
              width={SCREEN_W}
              height={SCREEN_H}
              fill="#FFFFFF"
            />
            {spot ? (
              <SvgRect
                x={spot.x}
                y={spot.y}
                width={spot.width}
                height={spot.height}
                rx={spot.radius}
                ry={spot.radius}
                fill="#000000"
              />
            ) : null}
          </Mask>
        </Defs>
        <SvgRect
          x={0}
          y={0}
          width={SCREEN_W}
          height={SCREEN_H}
          fill={dimColor}
          fillOpacity={0.86}
          mask="url(#tourSpot)"
        />
      </Svg>

      {spot ? (
        <>
          <View
            style={[
              styles.ring,
              {
                top: spot.y,
                left: spot.x,
                width: spot.width,
                height: spot.height,
                borderRadius: spot.radius,
              },
            ]}
            pointerEvents="none"
          />
          {placement.arrows ? (
            <BounceArrows
              bounce={bounce}
              direction={placement.below ? 'up' : 'down'}
              x={Math.min(
                Math.max(spot.x + spot.width / 2 - 18, 16),
                SCREEN_W - 52,
              )}
              y={placement.below ? spot.y + spot.height + 8 : spot.y - 52}
            />
          ) : null}
        </>
      ) : null}

      {/* Tooltip / explainer card — always mounted; slides to the anchored
          position once the target rect resolves (centered until then). */}
      <Animated.View
        entering={FadeIn.duration(220)}
        layout={LinearTransition.duration(220)}
        onLayout={onCardLayout}
        style={[styles.card, {width: SCREEN_W - 40, left: 20, top: placement.top}]}
        pointerEvents="auto">
        <Text style={styles.stepCount}>
          {t('tour.progress', {current: stepIndex + 1, total})}
        </Text>
        <Text style={styles.title}>{t(step.titleKey)}</Text>
        <Text style={styles.body}>{t(step.bodyKey)}</Text>

        {/* slim progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {width: `${((stepIndex + 1) / total) * 100}%`},
            ]}
          />
        </View>

        <View style={styles.row}>
          {!isFirst ? (
            <Pressable
              onPress={back}
              accessibilityRole="button"
              accessibilityLabel={t('tour.back')}
              style={styles.backBtn}>
              <ArrowLeft color={COLORS.textSecondary} size={18} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}

          {/* Escape hatch lives in the card: as a floating top-right pill it
              overlapped every screen's title and Passport's share button. */}
          <Pressable
            onPress={skip}
            accessibilityRole="button"
            accessibilityLabel={t('tour.skip')}
            hitSlop={12}
            style={styles.skipLink}>
            <Text style={styles.skipLabel}>{t('tour.skip')}</Text>
          </Pressable>

          <Pressable
            onPress={next}
            accessibilityRole="button"
            accessibilityLabel={isLast ? t('tour.done') : t('tour.next')}
            style={styles.nextBtn}>
            <Text style={styles.nextLabel}>
              {isLast ? t('tour.done') : t('tour.next')}
            </Text>
            {!isLast ? <ChevronRight color="#0A0A0C" size={18} /> : null}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

const BounceArrows: React.FC<{
  bounce: ReturnType<typeof useSharedValue<number>>;
  direction: 'up' | 'down';
  x: number;
  y: number;
}> = ({bounce, direction, x, y}) => {
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + bounce.value * 0.55,
    transform: [{translateY: bounce.value * (direction === 'up' ? -7 : 7)}],
  }));
  const Chevron = direction === 'up' ? ChevronUp : ChevronDown;
  return (
    <Animated.View style={[styles.arrows, {left: x, top: y}, style]} pointerEvents="none">
      <Chevron color={COLORS.gold} size={26} strokeWidth={2.5} style={styles.arrowOverlap} />
      <Chevron color={COLORS.gold} size={26} strokeWidth={2.5} style={styles.arrowOverlap} />
      <Chevron color={COLORS.goldLight} size={26} strokeWidth={2.5} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    elevation: 10000,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  arrows: {
    position: 'absolute',
    alignItems: 'center',
  },
  arrowOverlap: {
    marginBottom: -16,
  },
  card: {
    position: 'absolute',
    borderRadius: moderateScale(20),
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(18),
    paddingBottom: moderateScale(16),
    shadowColor: COLORS.gold,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 8},
  },
  stepCount: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: moderateScale(11),
    letterSpacing: 1.4,
    color: COLORS.gold,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: moderateScale(21),
    lineHeight: moderateScale(26),
    color: COLORS.textPrimary,
    marginTop: 6,
  },
  body: {
    fontFamily: FONTS.ui,
    fontSize: moderateScale(14),
    lineHeight: moderateScale(21),
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  backBtn: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  // Intentionally not flex:1 — a full-width invisible touch area sitting right
  // next to "Next" makes skipping the tour an easy mis-tap.
  skipLink: {
    height: moderateScale(44),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(10),
  },
  skipLabel: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: moderateScale(13),
    color: COLORS.textSecondary,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: moderateScale(22),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: COLORS.gold,
  },
  nextLabel: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: moderateScale(15),
    color: '#0A0A0C',
  },
});

export default TourHost;
