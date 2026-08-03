/**
 * ARSafetyNotice — the Google Play Families safety warning shown the moment an
 * AR / live-camera section opens, before the camera becomes interactive.
 *
 * Families policy requires a warning "immediately upon launch of the AR section"
 * containing (a) a message about the importance of parental supervision and
 * (b) a reminder to be aware of physical hazards in the real world. Both live in
 * `safety.*` (see `src/i18n/locales/en.json`) and are rendered verbatim below —
 * keep the policy wording intact when editing the copy.
 *
 * It is a FULL-SCREEN OPAQUE surface, not a card on a scrim, for two reasons:
 *   1. Nothing of the camera can ever show behind it, so there is no way to read
 *      the screen as "AR already started".
 *   2. The host screens are themselves `presentation: 'fullScreenModal'`, and a
 *      nested RN <Modal> on Android/Fabric is a known source of paint glitches.
 * Host screens therefore render this as an EARLY RETURN, before any camera view
 * is mounted. The heritage photo behind the scrim is decorative and remote — the
 * warning stays fully legible if it never loads, so nothing waits on it.
 *
 * Because it is not a <Modal>, there is no `onRequestClose` — the host owns the
 * Android hardware-back wiring. `useARSafetyGate()` does that for you.
 *
 * Presentational only; the host owns the acknowledged state:
 *   - onAcknowledge → proceed into the AR/camera experience ("I understand")
 *   - onExit        → leave the AR section. Never proceeds.
 *
 * The primary CTA is deliberately inert for SAFETY_ACK_DELAY_MS, with a gold arc
 * sweeping around it, so the warning cannot be dismissed in a single frame and
 * the wait reads as deliberate rather than broken. The secondary "Go back" is
 * enabled from t=0 — the user is never trapped here.
 *
 * It is shown on EVERY fresh AR launch: the hosts keep the acknowledgement in
 * component state with no "don't show again" flag persisted anywhere.
 */
import React, {useEffect, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Circle} from 'react-native-svg';
import {ArrowRight, Eye, Footprints, ShieldCheck, Users} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';

import {COLORS, FONTS, GOLD_GRADIENT} from '../../core/constants/theme';
import {AR_SAFETY_BACKDROP_URL} from '../../config/monuments';

/** How long the "I understand" button stays inert, in ms. */
export const SAFETY_ACK_DELAY_MS = 3000;

/**
 * Vertical fade over the backdrop photo. The last stop is fully opaque so the
 * bottom edge of the image dissolves into the page background with no seam.
 */
const SCRIM = [
  'rgba(10,10,12,0.80)',
  'rgba(10,10,12,0.56)',
  'rgba(10,10,12,0.94)',
  COLORS.bg,
];

const RING_SIZE = 22;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The three policy points, in the order the warning presents them. */
const POINTS = [
  {key: 'supervise', Icon: Users},
  {key: 'surroundings', Icon: Eye},
  {key: 'movement', Icon: Footprints},
] as const;

/**
 * Gold arc that sweeps once, clockwise from 12 o'clock, over exactly
 * SAFETY_ACK_DELAY_MS. Purely a progress cue — the button's enabled state is
 * driven by its own timeout in the parent, so a dropped frame here can never
 * leave the CTA stuck.
 */
const CountdownRing: React.FC = () => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: SAFETY_ACK_DELAY_MS,
      easing: Easing.linear,
    });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        stroke="rgba(203,168,98,0.22)"
        strokeWidth={RING_STROKE}
        fill="none"
      />
      <AnimatedCircle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        stroke={COLORS.gold}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={RING_CIRCUMFERENCE}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
    </Svg>
  );
};

interface Props {
  onAcknowledge: () => void;
  onExit: () => void;
}

const ARSafetyNotice: React.FC<Props> = ({onAcknowledge, onExit}) => {
  const {t} = useTranslation();
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setWaiting(false), SAFETY_ACK_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <View style={styles.root}>
      <Image
        source={{uri: AR_SAFETY_BACKDROP_URL}}
        style={styles.backdrop}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <LinearGradient
        colors={SCRIM}
        locations={[0, 0.3, 0.72, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.content}
          accessibilityViewIsModal
          importantForAccessibility="yes">
          <View style={styles.eyebrowRow}>
            <ShieldCheck size={17} color={COLORS.gold} />
            <Text style={styles.eyebrow}>{t('safety.eyebrow')}</Text>
          </View>

          <View style={styles.spacer} />

          <Text style={styles.title} accessibilityRole="header">
            {t('safety.title')}
          </Text>

          <View style={styles.points}>
            {POINTS.map(({key, Icon}) => (
              <View style={styles.point} key={key}>
                <View style={styles.pointChip}>
                  <Icon size={17} color={COLORS.gold} />
                </View>
                <Text style={styles.pointText}>{t(`safety.${key}`)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            {/*
              The fill lives on an inner View, NOT on the Pressable. On
              New-Arch/Fabric Android the Pressable's own backgroundColor does
              not reliably paint (the button rendered as invisible dark-on-dark
              text), whereas a plain View — or a LinearGradient — paints fine. So
              the Pressable is just the hit target and the child carries the fill.
            */}
            <Pressable
              onPress={onAcknowledge}
              disabled={waiting}
              accessibilityRole="button"
              accessibilityState={{disabled: waiting}}
              accessibilityLabel={t('safety.acknowledge')}
              accessibilityHint={
                waiting ? t('safety.acknowledgeHint') : undefined
              }
              style={({pressed}) => [
                styles.btnHit,
                pressed && !waiting && styles.pressed,
              ]}>
              {waiting ? (
                <View style={styles.btnWaiting}>
                  <CountdownRing />
                  <Text style={styles.btnWaitingText} numberOfLines={1}>
                    {t('safety.acknowledge')}
                  </Text>
                </View>
              ) : (
                // Fades in so the arc appears to dissolve into the gold fill
                // rather than the button snapping state.
                <Animated.View entering={FadeIn.duration(220)}>
                  <LinearGradient
                    colors={GOLD_GRADIENT}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={styles.btnReady}>
                    <Text style={styles.btnReadyText} numberOfLines={1}>
                      {t('safety.acknowledge')}
                    </Text>
                    <ArrowRight size={18} color={COLORS.bg} />
                  </LinearGradient>
                </Animated.View>
              )}
            </Pressable>

            {/* Always enabled — acknowledging is the way forward, but leaving
                must never be blocked by the countdown. */}
            <Pressable
              onPress={onExit}
              accessibilityRole="button"
              accessibilityLabel={t('safety.close')}
              hitSlop={12}
              style={({pressed}) => [styles.exitHit, pressed && styles.pressed]}>
              <Text style={styles.exitText}>{t('safety.close')}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    // Fully opaque: no camera preview can ever be visible behind the warning.
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '66%',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '68%',
  },
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 32,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eyebrow: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.gold,
  },
  spacer: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.displayRegular,
    fontSize: 36,
    lineHeight: 41,
    color: COLORS.textPrimary,
  },
  points: {
    marginTop: 30,
    gap: 18,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pointChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.amberSubtle,
    borderWidth: 1,
    borderColor: COLORS.borderFocus,
  },
  pointText: {
    flex: 1,
    fontFamily: FONTS.ui,
    fontSize: 17,
    lineHeight: 23,
    color: COLORS.textPrimary,
  },
  actions: {
    marginTop: 38,
  },
  btnHit: {
    alignSelf: 'stretch',
  },
  btnWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(203,168,98,0.10)',
    borderWidth: 1,
    borderColor: COLORS.borderFocus,
  },
  btnWaitingText: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 16,
    color: 'rgba(203,168,98,0.88)',
  },
  btnReady: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  btnReadyText: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 16,
    color: COLORS.bg,
  },
  pressed: {
    opacity: 0.82,
  },
  exitHit: {
    marginTop: 18,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  exitText: {
    fontFamily: FONTS.uiMedium,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default ARSafetyNotice;
