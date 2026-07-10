/**
 * OtaUpdateBanner — the "Update ready — Restart now" nudge.
 *
 * Shown when the self-hosted OTA flow (services/otaService) has downloaded and
 * verified a newer JS bundle. Tapping Restart stages it and relaunches the app;
 * dismissing just hides the banner (the bundle stays staged and applies on the
 * next natural cold start). Mounted next to UpdateAvailableBanner at the
 * main-stack root. Android-only in practice — the store slice is only ever set
 * on Android.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { RefreshCw, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  COLORS,
  FONTS,
  FONT_SIZES,
  RADIUS,
  SPACING,
} from '../core/constants/theme';
import { useUpdateStore } from '../stores/updateStore';
import { applyReadyBundle } from '../services/otaService';

const OtaUpdateBanner: React.FC = () => {
  const { t } = useTranslation();
  const ready = useUpdateStore(s => s.otaReady);
  const dismiss = useUpdateStore(s => s.dismissOtaReady);

  if (!ready) return null;

  const onRestart = () => {
    // Fire-and-forget: applyReadyBundle stages + restarts the app process.
    void applyReadyBundle();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']} pointerEvents="box-none">
      <Animated.View
        entering={FadeInUp.duration(380)}
        exiting={FadeOutUp.duration(280)}
        style={styles.banner}>
        <View style={styles.iconWrap}>
          <RefreshCw size={16} color={COLORS.bg} />
        </View>
        <Pressable style={styles.textWrap} onPress={onRestart}>
          <Text style={styles.title} numberOfLines={1}>
            {t('update.otaReadyTitle')}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {ready.notes ? ready.notes : t('update.otaReadySubtitle')}
          </Text>
        </Pressable>
        <Pressable onPress={onRestart} style={styles.ctaBtn}>
          <Text style={styles.ctaText}>{t('update.otaRestartCta')}</Text>
        </Pressable>
        <Pressable onPress={dismiss} hitSlop={10} style={styles.closeBtn}>
          <X size={16} color={COLORS.textTertiary} />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.bgWarm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.amberSubtle,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.caption,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  ctaBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  ctaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.small,
    color: COLORS.bg,
  },
  closeBtn: { padding: 2 },
});

export default OtaUpdateBanner;
