/**
 * UpdateAvailableBanner — the SOFT update nudge.
 *
 * Shown when this build is at/above the minimum supported build but behind the
 * latest one (see src/stores/updateStore). Dismissible; dismissal is remembered
 * per latest_version so the user isn't re-nudged for the same release. Mounted
 * once at the main-stack root next to DailyNudgeBanner.
 */
import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { ArrowUpCircle, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  COLORS,
  FONTS,
  FONT_SIZES,
  RADIUS,
  SPACING,
} from '../core/constants/theme';
import { useUpdateStore } from '../stores/updateStore';

const UpdateAvailableBanner: React.FC = () => {
  const { t } = useTranslation();
  const config = useUpdateStore(s => s.optional);
  const dismiss = useUpdateStore(s => s.dismissOptional);

  if (!config) return null;

  const onUpdate = () => {
    const url =
      Platform.OS === 'ios' ? config.ios_store_url : config.android_store_url;
    if (url) void Linking.openURL(url).catch(() => undefined);
    dismiss();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']} pointerEvents="box-none">
      <Animated.View
        entering={FadeInUp.duration(380)}
        exiting={FadeOutUp.duration(280)}
        style={styles.banner}>
        <View style={styles.iconWrap}>
          <ArrowUpCircle size={16} color={COLORS.bg} />
        </View>
        <Pressable style={styles.textWrap} onPress={onUpdate}>
          <Text style={styles.title} numberOfLines={1}>
            {t('update.availableTitle')}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {config.latest_version
              ? t('update.availableSubtitle', { version: config.latest_version })
              : t('update.availableSubtitleGeneric')}
          </Text>
        </Pressable>
        <Pressable onPress={onUpdate} style={styles.ctaBtn}>
          <Text style={styles.ctaText}>{t('update.cta')}</Text>
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

export default UpdateAvailableBanner;
