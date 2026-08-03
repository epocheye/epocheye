/**
 * OfflineBanner — the persistent, dismissible offline strip.
 *
 * App chrome, not a screen. Mounted once in App.tsx inside SafeAreaProvider so it
 * overlays every navigator state (onboarding, login, main) — unlike the four card
 * banners in MainNavigation, which only cover `main`.
 *
 * Deliberately a THIN FLUSH STRIP rather than a rounded card: the four existing
 * banners (VenueActivation, DailyNudge, UpdateAvailable, OtaUpdate) all occupy the
 * same absolute top slot, so a fifth card would collide pixel-for-pixel. A flush
 * full-width bar reads as chrome layered above them instead.
 *
 * Tapping it re-probes the connection; the X dismisses it for the CURRENT offline
 * episode only — going back online and offline again brings it back.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { WifiOff, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
} from '../../core/constants/theme';
import { useNetwork } from '../../context/NetworkContext';

const OfflineBanner: React.FC = () => {
  const { t } = useTranslation();
  const { isOffline, checkConnection } = useNetwork();
  const [dismissed, setDismissed] = useState(false);

  // Re-arm on every offline episode: dismissing this one must not silence the next.
  useEffect(() => {
    if (isOffline) setDismissed(false);
  }, [isOffline]);

  if (!isOffline || dismissed) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top']} pointerEvents="box-none">
      <Animated.View
        entering={FadeInUp.duration(320)}
        exiting={FadeOutUp.duration(240)}
        style={styles.strip}>
        <WifiOff size={14} color={COLORS.textSecondary} />
        <Pressable
          style={styles.textWrap}
          onPress={() => void checkConnection()}
          accessibilityRole="button"
          accessibilityLabel={t('offline.bannerRetryA11y')}>
          <Text style={styles.text} numberOfLines={1}>
            {t('offline.bannerTitle')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setDismissed(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={styles.closeBtn}>
          <X size={14} color={COLORS.textTertiary} />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0 },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.bgWarm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.amberSubtle,
  },
  textWrap: { flex: 1 },
  text: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONT_SIZES.caption,
    color: COLORS.textSecondary,
  },
  closeBtn: { padding: 2 },
});

export default OfflineBanner;
