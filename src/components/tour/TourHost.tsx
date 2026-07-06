/**
 * TourHost — driver + renderer for the first-run guided product tour.
 *
 * Mounted once at the app root (App.tsx, next to <DialogHost/>), ABOVE the
 * NavigationContainer, so it overlays every screen. For each step it
 * (1) navigates via the shared navigationRef, (2) waits for the step's target
 * element to be measured by useTourTarget, then (3) draws a dimmed cutout +
 * bouncing arrow cue around it.
 *
 * The tooltip card (title/body + Back/Next + progress) renders IMMEDIATELY on
 * every step — centered while the target is still navigating/measuring, then
 * sliding to its anchored position once the rect resolves. The old behaviour
 * (dim-only screen with no controls for up to ~2s per step) read as a freeze
 * and left the user with no escape hatch mid-transition.
 *
 * A fixed "Skip tour" pill stays in the top-right on every step. The dimmed
 * backdrop absorbs touches; hardware back steps backwards (skips at step 0).
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
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
import {ChevronDown, ChevronUp, ChevronRight, ArrowLeft} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';

import {COLORS, FONTS} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants';
import {navigateSafe} from '../../navigation/navigationRef';
import {useTourStore, type TourRect} from '../../stores/tourStore';
import {TOUR_STEPS, type TourStep} from '../../constants/appTour';

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const TourHost: React.FC = () => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {width: SCREEN_W, height: SCREEN_H} = useWindowDimensions();

  const running = useTourStore(s => s.running);
  const stepIndex = useTourStore(s => s.stepIndex);
  const next = useTourStore(s => s.next);
  const back = useTourStore(s => s.back);
  const skip = useTourStore(s => s.skip);

  const [rect, setRect] = useState<TourRect | null>(null);

  const navigateForStep = useCallback((step: TourStep) => {
    switch (step.nav.kind) {
      case 'tab':
        navigateSafe(ROUTES.MAIN.TABS, {screen: step.nav.tab});
        break;
      case 'screen':
        navigateSafe(step.nav.route, step.nav.params);
        break;
    }
  }, []);

  const isOnScreen = useCallback(
    (r: TourRect) =>
      r.width > 0 &&
      r.height > 0 &&
      r.y >= insets.top - 12 &&
      r.y + r.height <= SCREEN_H - 12,
    [insets.top, SCREEN_H],
  );

  // Drive each step: navigate → wait → measure target → spotlight. The card is
  // visible with its content and controls the whole time (never a dead frame);
  // only the spotlight cutout waits for the rect.
  useEffect(() => {
    if (!running) return undefined;
    let cancelled = false;
    setRect(null);
    const step = TOUR_STEPS[stepIndex];

    (async () => {
      try {
        navigateForStep(step);
        if (!step.targetId) return;
        await delay(step.nav.kind === 'tab' ? 300 : 450);
        if (cancelled) return;

        // Poll for the registered rect (screen needs to mount + measure);
        // hard cap ~1.2s, after which the step stays a centered card.
        for (let i = 0; i < 12 && !cancelled; i++) {
          const r = useTourStore.getState().targets[step.targetId];
          if (r && isOnScreen(r)) {
            if (!cancelled) setRect(r);
            return;
          }
          await delay(100);
        }
      } catch (e) {
        // Never let a navigation/measure failure crash the app — the centered
        // card with Next/Skip is already showing.
        if (__DEV__) console.warn('[tour] step failed', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [running, stepIndex, navigateForStep, isOnScreen]);

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

  if (!running) return null;

  const step = TOUR_STEPS[stepIndex];
  const total = TOUR_STEPS.length;
  const isLast = stepIndex >= total - 1;
  const isFirst = stepIndex === 0;
  const cardW = SCREEN_W - 40;

  // Decide card + arrow placement relative to the spotlight rect.
  const placeBelow =
    !!rect &&
    (step.placement === 'bottom' ||
      (step.placement !== 'top' && rect.y + rect.height < SCREEN_H * 0.55));

  let cardPos: {top?: number; bottom?: number};
  if (!rect) {
    cardPos = {top: Math.max(insets.top + 24, SCREEN_H / 2 - 120)};
  } else if (placeBelow) {
    cardPos = {top: Math.min(rect.y + rect.height + 26, SCREEN_H - 220)};
  } else {
    cardPos = {bottom: Math.min(SCREEN_H - rect.y + 26, SCREEN_H - 180)};
  }

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Touch sink — blocks all underlying interaction (forced walkthrough). */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />

      {/* Dimming: full cover, or a 4-panel cutout that leaves the target bright. */}
      {rect ? (
        <>
          <View style={[styles.dim, {top: 0, left: 0, right: 0, height: rect.y - 6}]} pointerEvents="none" />
          <View
            style={[styles.dim, {top: rect.y - 6, left: 0, width: rect.x - 6, height: rect.height + 12}]}
            pointerEvents="none"
          />
          <View
            style={[
              styles.dim,
              {top: rect.y - 6, left: rect.x + rect.width + 6, right: 0, height: rect.height + 12},
            ]}
            pointerEvents="none"
          />
          <View
            style={[styles.dim, {top: rect.y + rect.height + 6, left: 0, right: 0, bottom: 0}]}
            pointerEvents="none"
          />
          <View
            style={[
              styles.ring,
              {top: rect.y - 6, left: rect.x - 6, width: rect.width + 12, height: rect.height + 12},
            ]}
            pointerEvents="none"
          />
          <BounceArrows
            bounce={bounce}
            direction={placeBelow ? 'up' : 'down'}
            x={Math.min(Math.max(rect.x + rect.width / 2 - 18, 16), SCREEN_W - 52)}
            y={placeBelow ? rect.y + rect.height + 8 : rect.y - 64}
          />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />
      )}

      {/* Fixed, always-visible escape hatch. */}
      <Pressable
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel={t('tour.skip')}
        hitSlop={8}
        style={[styles.skipPill, {top: insets.top + 10}]}>
        <Text style={styles.skipPillLabel}>{t('tour.skip')}</Text>
      </Pressable>

      {/* Tooltip / explainer card — always mounted; slides to the anchored
          position once the target rect resolves (centered until then). */}
      <Animated.View
        entering={FadeIn.duration(220)}
        layout={LinearTransition.duration(220)}
        style={[styles.card, {width: cardW, left: 20, ...cardPos}]}
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
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(8,8,10,0.86)',
  },
  ring: {
    position: 'absolute',
    borderRadius: 16,
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
    borderRadius: 20,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 8},
  },
  stepCount: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: COLORS.gold,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 21,
    lineHeight: 26,
    color: COLORS.textPrimary,
    marginTop: 6,
  },
  body: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    lineHeight: 21,
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
  skipPill: {
    position: 'absolute',
    right: 16,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(203,168,98,0.5)',
    zIndex: 2,
  },
  skipPillLabel: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 13,
    color: '#F5F0E8',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 22,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gold,
  },
  nextLabel: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 15,
    color: '#0A0A0C',
  },
});

export default TourHost;
