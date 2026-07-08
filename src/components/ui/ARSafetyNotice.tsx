/**
 * ARSafetyNotice — safety gate shown the moment an AR/live-camera section opens,
 * before the camera becomes interactive (Google Play Families policy).
 *
 * It reminds the user about parental supervision and staying aware of their
 * surroundings, and blocks entry to the camera until acknowledged. It is shown on
 * every fresh AR launch (the host screens keep no "don't show again" flag).
 *
 * Presentational only — the host screen owns the `acknowledged` state:
 *   - onAcknowledge → proceed into the AR/camera experience ("I understand")
 *   - onExit        → leave the AR section (Android hardware back). Never proceeds.
 *
 * There is no on-card close (X) button — acknowledging is the intended way
 * forward and the hardware back button still exits — so the single "I understand"
 * call-to-action reads unambiguously.
 *
 * Styling mirrors `ConfirmDialog` (transparent Modal + scrim + reanimated card,
 * gold glow on the dark card). The scrim is intentionally inert: tapping it does
 * nothing, so the user cannot slip into the camera without acknowledging.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  onAcknowledge: () => void;
  onExit: () => void;
}

const ARSafetyNotice: React.FC<Props> = ({ onAcknowledge, onExit }) => {
  const { t } = useTranslation();

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={onExit}>
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(140)}
        style={styles.scrim}>
        {/* Inert scrim: acknowledging is the only way forward. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none" />

        <Animated.View
          entering={ZoomIn.duration(180).withInitialValues({
            transform: [{ scale: 0.9 }],
          })}
          style={styles.card}>
          <View style={styles.iconWrap}>
            <ShieldCheck size={28} color="#CBA862" />
          </View>

          <Text style={styles.title}>{t('safety.title')}</Text>

          <View style={styles.lines}>
            <Text style={styles.line}>{t('safety.supervise')}</Text>
            <Text style={styles.line}>{t('safety.surroundings')}</Text>
          </View>

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
            accessibilityRole="button"
            accessibilityLabel={t('safety.acknowledge')}
            style={({ pressed }) => [styles.btnHit, pressed && styles.btnPressed]}>
            <View style={styles.btnFill}>
              <Text style={styles.btnText} numberOfLines={1}>
                {t('safety.acknowledge')}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
    // Gold glow instead of drop shadow on dark backgrounds.
    shadowColor: '#CBA862',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(203,168,98,0.14)',
    marginBottom: 14,
  },
  title: {
    fontFamily: 'Fraunces-Regular',
    fontSize: 24,
    lineHeight: 28,
    color: '#F5F0E8',
    textAlign: 'center',
  },
  lines: {
    marginTop: 12,
    gap: 8,
  },
  line: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.66)',
    textAlign: 'center',
  },
  // Pressable is only the touch target + spacing; the visible fill is the inner
  // View below (Fabric paints View backgrounds reliably, Pressable ones not).
  btnHit: {
    marginTop: 22,
    alignSelf: 'stretch',
  },
  btnFill: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    // Bright, saturated amber so the sole call-to-action stands out clearly
    // against the near-black card (the muted gold read too dark). Dark text on
    // bright amber keeps a high contrast ratio.
    backgroundColor: '#F2A007',
    borderWidth: 1,
    borderColor: '#FFC24D',
  },
  btnPressed: {
    opacity: 0.82,
  },
  btnText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    color: '#0A0A0A',
  },
});

export default ARSafetyNotice;
