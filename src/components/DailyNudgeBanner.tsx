/**
 * DailyNudgeBanner — the in-app face of the twice-daily "today in history"
 * nudge (backend /internal/daily-nudge-tick → FCM type 'daily').
 *
 * Mounted once at the main-stack root (next to VenueActivationBanner) so it can
 * slide down over any screen. While the app is foregrounded, fcmService routes
 * daily-type pushes here (via notificationsStore.showDailyBanner) instead of
 * the notification tray; one tap opens the Daily tab.
 */
import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated, {FadeInUp, FadeOutUp} from 'react-native-reanimated';
import {Flame, X} from 'lucide-react-native';

import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../core/constants/theme';
import {ROUTES} from '../core/constants';
import {useNotificationsStore} from '../stores/notificationsStore';
import {navigateSafe} from '../navigation/navigationRef';

const VISIBLE_MS = 8000;

const DailyNudgeBanner: React.FC = () => {
  const banner = useNotificationsStore(s => s.dailyBanner);
  const dismiss = useNotificationsStore(s => s.dismissDailyBanner);
  const [visibleSeq, setVisibleSeq] = useState<number | null>(null);

  useEffect(() => {
    if (!banner) {
      setVisibleSeq(null);
      return;
    }
    setVisibleSeq(banner.seq);
    const id = setTimeout(() => dismiss(), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [banner, dismiss]);

  if (!banner || visibleSeq !== banner.seq) return null;

  const openDaily = () => {
    dismiss();
    navigateSafe(ROUTES.MAIN.TABS, {screen: ROUTES.TABS.DAILY});
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']} pointerEvents="box-none">
      <Animated.View
        entering={FadeInUp.duration(380)}
        exiting={FadeOutUp.duration(280)}
        style={styles.banner}>
        <View style={styles.iconWrap}>
          <Flame size={16} color={COLORS.bg} />
        </View>
        <Pressable style={styles.textWrap} onPress={openDaily}>
          <Text style={styles.title} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {banner.message}
          </Text>
        </Pressable>
        <Pressable onPress={openDaily} style={styles.ctaBtn}>
          <Text style={styles.ctaText}>Read</Text>
        </Pressable>
        <Pressable onPress={dismiss} hitSlop={10} style={styles.closeBtn}>
          <X size={16} color={COLORS.textTertiary} />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {position: 'absolute', top: 0, left: 0, right: 0},
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
    shadowOffset: {width: 0, height: 6},
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
  textWrap: {flex: 1},
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
  closeBtn: {padding: 2},
});

export default DailyNudgeBanner;
