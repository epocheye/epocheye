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
 * is mounted.
 *
 * Because it is not a <Modal>, there is no `onRequestClose` — the host owns the
 * Android hardware-back wiring. `useARSafetyGate()` does that for you.
 *
 * Presentational only; the host owns the acknowledged state:
 *   - onAcknowledge → proceed into the AR/camera experience ("I understand")
 *   - onExit        → leave the AR section. Never proceeds.
 *
 * The primary CTA is deliberately disabled for SAFETY_ACK_DELAY_MS with a
 * visible countdown so the warning cannot be dismissed in a single frame. The
 * secondary "Go back" is enabled from t=0 — the user is never trapped here.
 *
 * It is shown on EVERY fresh AR launch: the hosts keep the acknowledgement in
 * component state with no "don't show again" flag persisted anywhere.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Eye, Footprints, ShieldCheck, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

/** How long the "I understand" button stays disabled, in ms. */
export const SAFETY_ACK_DELAY_MS = 3000;

const AMBER = '#F2A007';
const GOLD = '#CBA862';

interface Props {
  onAcknowledge: () => void;
  onExit: () => void;
}

const ARSafetyNotice: React.FC<Props> = ({ onAcknowledge, onExit }) => {
  const { t } = useTranslation();

  // Counts down to 0, at which point the CTA enables. Starts at the whole
  // number of seconds in the delay so the label reads "(3)", "(2)", "(1)".
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.ceil(SAFETY_ACK_DELAY_MS / 1000),
  );

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }
    const id = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const waiting = secondsLeft > 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Animated.View
        entering={FadeIn.duration(180)}
        style={styles.content}
        accessibilityViewIsModal
        importantForAccessibility="yes">
        <View style={styles.iconWrap}>
          <ShieldCheck size={30} color={GOLD} />
        </View>

        <Text style={styles.title} accessibilityRole="header">
          {t('safety.title')}
        </Text>

        <View style={styles.lines}>
          <View style={styles.line}>
            <Users size={20} color={GOLD} style={styles.lineIcon} />
            <Text style={styles.lineText}>{t('safety.supervise')}</Text>
          </View>
          <View style={styles.line}>
            <Eye size={20} color={GOLD} style={styles.lineIcon} />
            <Text style={styles.lineText}>{t('safety.surroundings')}</Text>
          </View>
          <View style={styles.line}>
            <Footprints size={20} color={GOLD} style={styles.lineIcon} />
            <Text style={styles.lineText}>{t('safety.movement')}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {/*
            The amber fill lives on this inner View, NOT on the Pressable. On
            New-Arch/Fabric Android the Pressable's own backgroundColor does not
            reliably paint (the button rendered as invisible dark-on-dark text),
            whereas a plain View with a backgroundColor paints fine — same as the
            icon circle above. So the Pressable is just the hit target and the
            View carries the highlight.
          */}
          <Pressable
            onPress={onAcknowledge}
            disabled={waiting}
            accessibilityRole="button"
            accessibilityState={{ disabled: waiting }}
            accessibilityLabel={t('safety.acknowledge')}
            style={({ pressed }) => [
              styles.btnHit,
              pressed && !waiting && styles.btnPressed,
            ]}>
            <View style={[styles.btnFill, waiting && styles.btnFillWaiting]}>
              <Text style={styles.btnText} numberOfLines={1}>
                {waiting
                  ? t('safety.acknowledgeWait', { seconds: secondsLeft })
                  : t('safety.acknowledge')}
              </Text>
            </View>
          </Pressable>

          {/* Always enabled — acknowledging is the way forward, but leaving must
              never be blocked by the countdown. */}
          <Pressable
            onPress={onExit}
            accessibilityRole="button"
            accessibilityLabel={t('safety.close')}
            hitSlop={12}
            style={({ pressed }) => [
              styles.exitHit,
              pressed && styles.btnPressed,
            ]}>
            <Text style={styles.exitText}>{t('safety.close')}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    // Fully opaque: no camera preview can ever be visible behind the warning.
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(203,168,98,0.14)',
    // Gold glow instead of a drop shadow on the dark background.
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Fraunces-Regular',
    fontSize: 30,
    lineHeight: 36,
    color: '#F5F0E8',
    textAlign: 'center',
  },
  lines: {
    marginTop: 26,
    gap: 18,
    maxWidth: 420,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  lineIcon: {
    marginTop: 2,
  },
  lineText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(245,240,232,0.86)',
  },
  actions: {
    alignSelf: 'stretch',
    maxWidth: 420,
    width: '100%',
    marginTop: 36,
  },
  btnHit: {
    alignSelf: 'stretch',
  },
  btnFill: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    // Bright, saturated amber so the sole call-to-action stands out clearly
    // against the near-black background. Dark text on bright amber keeps a high
    // contrast ratio.
    backgroundColor: AMBER,
    borderWidth: 1,
    borderColor: '#FFC24D',
  },
  btnFillWaiting: {
    backgroundColor: 'rgba(242,160,7,0.42)',
    borderColor: 'rgba(255,194,77,0.42)',
  },
  btnPressed: {
    opacity: 0.82,
  },
  btnText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    color: '#0A0A0A',
  },
  exitHit: {
    marginTop: 16,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  exitText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 15,
    color: 'rgba(245,240,232,0.62)',
    textAlign: 'center',
  },
});

export default ARSafetyNotice;
