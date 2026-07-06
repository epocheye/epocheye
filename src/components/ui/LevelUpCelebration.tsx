import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ArrowRight, Crown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, GOLD_GRADIENT } from '../../core/constants/theme';

interface Props {
  visible: boolean;
  /** New explorer level (e.g. 4). */
  level: number;
  /** New rank title (e.g. "Historian"). */
  title: string;
  /** Evocative one-liner under the title. */
  message?: string;
  /** XP earned this level-up (for the stat chip). */
  xpEarned?: number;
  /** Number of new perks unlocked (for the stat chip). */
  perks?: number;
  onClose: () => void;
}

/**
 * Full-screen rank-up reward. A gold medallion pops in over a softly glowing
 * backdrop, with the new rank in display serif and a primary CTA. Reanimated
 * per project convention; mount once and toggle `visible` when a level boundary
 * is crossed.
 */
const LevelUpCelebration: React.FC<Props> = ({
  visible,
  level,
  title,
  message,
  xpEarned,
  perks,
  onClose,
}) => {
  const { t } = useTranslation();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 420 : 200,
      easing: Easing.out(Easing.back(1.5)),
    });
  }, [visible, progress]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.86 + progress.value * 0.14 }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <View style={styles.glow} />
        <Animated.View style={[styles.content, contentStyle]}>
          <Text style={styles.eyebrow}>{t('levelUp.rankUnlocked')}</Text>

          <View style={styles.medalRing}>
            <LinearGradient
              colors={GOLD_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.medal}>
              <Crown color={COLORS.bg} size={44} fill={COLORS.bg} />
              <Text style={styles.medalLevel}>LV {level}</Text>
            </LinearGradient>
          </View>

          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.stats}>
            {typeof xpEarned === 'number' ? (
              <View style={styles.statCell}>
                <Text style={styles.statValue}>+{xpEarned}</Text>
                <Text style={styles.statLabel}>{t('levelUp.xpEarned')}</Text>
              </View>
            ) : null}
            {typeof perks === 'number' ? (
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{perks}</Text>
                <Text style={styles.statLabel}>{t('levelUp.newPerks')}</Text>
              </View>
            ) : null}
          </View>

          <Pressable onPress={onClose} style={styles.ctaPressable}>
            <LinearGradient
              colors={GOLD_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}>
              <Text style={styles.ctaText}>{t('levelUp.continue')}</Text>
              <ArrowRight color={COLORS.bg} size={20} />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,12,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  glow: {
    position: 'absolute',
    top: '22%',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: COLORS.skyGlow,
    opacity: 0.6,
  },
  content: { alignItems: 'center', width: '100%' },
  eyebrow: {
    fontFamily: FONTS.uiMedium,
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.gold,
    marginBottom: 28,
  },
  medalRing: {
    width: 176,
    height: 176,
    borderRadius: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderFocus,
    marginBottom: 32,
  },
  medal: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalLevel: {
    fontFamily: FONTS.uiMedium,
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.bg,
    marginTop: 4,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 44,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontFamily: FONTS.ui,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginBottom: 32,
  },
  stats: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 36 },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.gold },
  statLabel: { fontFamily: FONTS.uiMedium, fontSize: 10, letterSpacing: 1.4, color: COLORS.textTertiary },
  ctaPressable: { width: '100%' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 17,
  },
  ctaText: { fontFamily: FONTS.uiMedium, fontSize: 16, color: COLORS.bg },
});

export default LevelUpCelebration;
