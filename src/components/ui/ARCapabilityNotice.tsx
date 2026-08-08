/**
 * ARCapabilityNotice — tells a visitor, before they invest anything, how AR
 * will behave on THIS phone, and always offers a way forward.
 *
 * It exists because the app used to answer "your phone has no ARCore" with
 * "Could not load this site" — blaming the site for the handset's hardware, and
 * leaving the user at a dead end with a "Go back" button.
 *
 * Three principles, and they are the whole design:
 *
 *  1. INFORM, NEVER BLOCK. Every state's primary action moves forward. A user
 *     without AR still gets the reconstruction; it just isn't locked to the
 *     walls. The copy says what they GET, not what they lack.
 *  2. SEPARATE THE FIXABLE FROM THE PERMANENT. 'arcore-missing' is one tap from
 *     solved, so it offers the Play Store and is shown every single time.
 *     'device-unsupported' / 'platform-unsupported' are facts about the
 *     hardware or the build; they are explained once and then never again,
 *     because repeating a permanent fact is how you make someone feel
 *     second-class.
 *  3. NEVER SAY SOMETHING FALSE TO BE BRIEF. An iPhone is not an incapable
 *     device — this build simply has no world-locked AR for iOS yet, so
 *     'platform-unsupported' gets its own copy rather than being folded into
 *     'device-unsupported'.
 *
 * Presentational only. Structure follows ARSafetyNotice: a full-screen opaque
 * surface (not a <Modal> — the hosts are already fullScreenModal and a nested
 * Modal glitches on Fabric), rendered by the host as an early return.
 *
 * Deliberately NO countdown on the primary button. The delay in ARSafetyNotice
 * exists to stop a legal warning being dismissed in one frame. This is a
 * courtesy, and a courtesy that makes you wait is an annoyance.
 */
import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated, {FadeIn} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {ArrowRight, Download, Rotate3d, Smartphone} from 'lucide-react-native';
import {useTranslation} from 'react-i18next';

import {COLORS, FONTS, GOLD_GRADIENT} from '../../core/constants/theme';
import {AR_SAFETY_BACKDROP_URL} from '../../config/monuments';
import type {ARCapability} from '../../shared/hooks/useARCapability';

/** Which experience the user was heading for — it changes what we can offer. */
export type ARIntent = 'detect' | 'reconstruction';

const SCRIM = [
  'rgba(10,10,12,0.80)',
  'rgba(10,10,12,0.56)',
  'rgba(10,10,12,0.94)',
  COLORS.bg,
];

interface Props {
  capability: ARCapability;
  intent: ARIntent;
  /** Install ARCore, or continue to the fallback — depends on the state. */
  onPrimary: () => void;
  /** The alternative route forward. Absent when there is only one. */
  onSecondary?: () => void;
  onExit: () => void;
}

const ARCapabilityNotice: React.FC<Props> = ({
  capability,
  intent,
  onPrimary,
  onSecondary,
  onExit,
}) => {
  const {t} = useTranslation();
  const fixable = capability === 'arcore-missing';
  const isReconstruction = intent === 'reconstruction';

  const Icon = fixable ? Download : isReconstruction ? Rotate3d : Smartphone;

  const title = fixable
    ? t('arCapability.install.title')
    : capability === 'platform-unsupported'
      ? t('arCapability.platform.title')
      : t('arCapability.unsupported.title');

  const body = fixable
    ? t('arCapability.install.body')
    : capability === 'platform-unsupported'
      ? t('arCapability.platform.body')
      : t('arCapability.unsupported.body');

  const primaryLabel = fixable
    ? t('arCapability.install.primary')
    : isReconstruction
      ? t('arCapability.unsupported.primary3d')
      : t('arCapability.unsupported.primaryScan');

  const secondaryLabel = fixable
    ? isReconstruction
      ? t('arCapability.install.secondary3d')
      : t('arCapability.install.secondaryScan')
    : undefined;

  return (
    <View style={styles.root}>
      <Image
        source={{uri: AR_SAFETY_BACKDROP_URL}}
        style={styles.backdrop}
        resizeMode="cover"
      />
      <LinearGradient colors={SCRIM} style={styles.scrim} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.content}
          accessibilityViewIsModal
          importantForAccessibility="yes">
          <View style={styles.eyebrowRow}>
            <Icon size={17} color={COLORS.gold} />
            <Text style={styles.eyebrow}>{t('arCapability.eyebrow')}</Text>
          </View>

          <View style={styles.spacer} />

          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>

          <View style={styles.actions}>
            {/* Fill on an INNER view — a Pressable's own backgroundColor does
                not reliably paint on New-Arch Android. */}
            <Pressable
              onPress={onPrimary}
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              style={({pressed}) => [styles.btnHit, pressed && styles.pressed]}>
              <LinearGradient
                colors={GOLD_GRADIENT}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.btnReady}>
                <Text style={styles.btnReadyText} numberOfLines={1}>
                  {primaryLabel}
                </Text>
                <ArrowRight size={18} color={COLORS.bg} />
              </LinearGradient>
            </Pressable>

            {secondaryLabel && onSecondary ? (
              <Pressable
                onPress={onSecondary}
                accessibilityRole="button"
                accessibilityLabel={secondaryLabel}
                hitSlop={8}
                style={({pressed}) => [
                  styles.secondaryHit,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.secondaryText}>{secondaryLabel}</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={onExit}
              accessibilityRole="button"
              accessibilityLabel={t('arCapability.back')}
              hitSlop={12}
              style={({pressed}) => [styles.exitHit, pressed && styles.pressed]}>
              <Text style={styles.exitText}>{t('arCapability.back')}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {...StyleSheet.absoluteFillObject, backgroundColor: COLORS.bg},
  backdrop: {position: 'absolute', top: 0, left: 0, right: 0, height: '66%'},
  scrim: {position: 'absolute', top: 0, left: 0, right: 0, height: '66%'},
  safe: {flex: 1},
  content: {flex: 1, paddingHorizontal: 24, paddingBottom: 12},
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
  },
  eyebrow: {
    color: COLORS.gold,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  spacer: {flex: 1},
  title: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.display,
    fontSize: 34,
    lineHeight: 40,
  },
  body: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 14,
  },
  actions: {marginTop: 28, gap: 12},
  btnHit: {borderRadius: 14},
  btnReady: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: 14,
  },
  btnReadyText: {
    color: COLORS.bg,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  secondaryHit: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  secondaryText: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 14,
  },
  exitHit: {alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16},
  exitText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 13,
  },
  pressed: {opacity: 0.85},
});

export default ARCapabilityNotice;
