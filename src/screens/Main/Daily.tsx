import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Dimensions,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {useTranslation} from 'react-i18next';
import {ChevronRight} from 'lucide-react-native';
import {COLORS, FONTS, GOLD_GRADIENT} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import StreakModule from '../../components/ui/StreakModule';
import {AmbientGlow, ImageScrim} from '../../components/ui/premium';
import {useDailyToday} from '../../shared/hooks';
import type {DailyStreakDay} from '../../utils/api/daily';
import type {TabScreenProps} from '../../core/types/navigation.types';

type Props = TabScreenProps<'Daily'>;

const HERO_TEXT = '#FBF6EC';
const HERO_MIN_H = 330;
const CARD_W = Dimensions.get('window').width - 40; // px-5 wrapper = 20 each side

function todayDateParts(): {month: string; day: number} {
  const months = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ];
  const now = new Date();
  return {month: months[now.getMonth()], day: now.getDate()};
}

/** Staggered fade + rise driven by the shared `intro` value (0 → 1). */
function fadeRise(introValue: number, start: number) {
  'worklet';
  const p = interpolate(introValue, [start, start + 0.4], [0, 1], Extrapolation.CLAMP);
  return {opacity: p, transform: [{translateY: (1 - p) * 16}]};
}

/** Gold-gradient pill CTA shared by the image hero and the dark fallback. */
const ExploreButton: React.FC<{label: string; onPress: () => void}> = ({label, onPress}) => (
  <Pressable
    onPress={onPress}
    style={({pressed}) => (pressed ? {opacity: 0.85} : undefined)}
    accessibilityRole="button"
    accessibilityLabel={label}>
    <LinearGradient
      colors={GOLD_GRADIENT}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.cta}>
      <Text style={{fontFamily: FONTS.uiSemiBold, fontSize: 14, color: '#0A0A0C'}}>{label}</Text>
      <ChevronRight color="#0A0A0C" size={15} />
    </LinearGradient>
  </Pressable>
);

const Daily: React.FC<Props> = ({navigation}) => {
  const {t} = useTranslation();
  const {daily, loading, refresh: refreshDaily} = useDailyToday();
  const [refreshing, setRefreshing] = useState(false);
  // Bumped on pull-to-refresh to replay the staggered entrance animations.
  const [cycle, setCycle] = useState(0);

  const dateParts = useMemo(() => todayDateParts(), []);
  const dateLabel = t('daily.todayLabel', {month: dateParts.month, day: dateParts.day});

  // Entrance progress (0 → 1), replayed when `cycle` changes.
  const intro = useSharedValue(0);
  // Slow gold shimmer sweeping across the hero card.
  const shimmer = useSharedValue(0);
  // Soft pulse behind today's streak tile.
  const pulse = useSharedValue(0);

  useEffect(() => {
    intro.value = 0;
    intro.value = withTiming(1, {duration: 720, easing: Easing.out(Easing.quad)});
  }, [intro, cycle]);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, {duration: 2600, easing: Easing.inOut(Easing.ease)}),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {duration: 900, easing: Easing.inOut(Easing.quad)}),
        withTiming(0, {duration: 900, easing: Easing.inOut(Easing.quad)}),
      ),
      -1,
      false,
    );
  }, [shimmer, pulse]);

  const sHeader = useAnimatedStyle(() => fadeRise(intro.value, 0));
  const sStreak = useAnimatedStyle(() => fadeRise(intro.value, 0.1));
  const sHero = useAnimatedStyle(() => fadeRise(intro.value, 0.22));
  const sWeekly = useAnimatedStyle(() => fadeRise(intro.value, 0.36));
  const sYear = useAnimatedStyle(() => {
    const p = interpolate(intro.value, [0.3, 0.72], [0, 1], Extrapolation.CLAMP);
    return {transform: [{scale: 0.92 + p * 0.08}]};
  });
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {translateX: -140 + shimmer.value * (CARD_W + 140)},
      {rotate: '18deg'},
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.45,
    transform: [{scale: 1 + pulse.value * 0.14}],
  }));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDaily();
    setRefreshing(false);
    setCycle(c => c + 1);
  }, [refreshDaily]);

  const onCtaPress = useCallback(() => {
    if (!daily) return;
    // Prefer deep-linking into an Epocheye site; otherwise open the source article.
    if (daily.cta_place_id) {
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: {id: daily.cta_place_id, name: daily.cta_label ?? ''},
      });
    } else if (daily.cta_url) {
      void Linking.openURL(daily.cta_url);
    }
  }, [daily, navigation]);

  const onSeeAll = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.HISTORY);
  }, [navigation]);

  const streakCount = daily?.streak_count ?? 0;
  const weeklyStreak: DailyStreakDay[] = daily?.weekly_streak ?? [];
  // A story is only renderable once the payload carries body text. A loaded-but-empty
  // payload (or a failed fetch) must fall back to an empty state, never a blank `0` card.
  const hasStory = !!daily && !!daily.body && daily.body.trim().length > 0;
  const hasYear = !!daily && daily.year > 0;
  const hasCta = !!daily && (!!daily.cta_place_id || !!daily.cta_url) && !!daily.cta_label;

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} className="bg-background" />
      <ScrollView
        contentContainerStyle={{paddingBottom: 120}}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold}
            colors={[COLORS.gold]}
          />
        }>
        {/* Header */}
        <Animated.View style={sHeader} className="px-6 pt-3 pb-5">
          <Text
            style={{fontFamily: FONTS.uiSemiBold}}
            className="text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
            {dateLabel}
          </Text>
          <Text
            style={{fontFamily: FONTS.display}}
            className="mt-1.5 text-[32px] leading-[38px] text-foreground tracking-tight">
            {t('daily.onThisDay')}
          </Text>
        </Animated.View>

        {/* Streak hero — the single gold block */}
        <Animated.View style={sStreak} className="px-5 mb-5">
          <StreakModule
            days={streakCount}
            week={
              weeklyStreak.length
                ? weeklyStreak.map(d => d.is_today || d.visited)
                : undefined
            }
            subtitle={t('daily.streakSubtitle')}
          />
        </Animated.View>

        {/* Story hero — dark, image-led editorial card */}
        <Animated.View style={sHero} className="px-5">
          {hasStory && daily?.image_url ? (
            <View style={styles.heroCard}>
              <Image source={{uri: daily.image_url}} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <ImageScrim
                colors={['rgba(10,10,12,0.15)', 'rgba(10,10,12,0.55)', 'rgba(10,10,12,0.97)']}
                locations={[0, 0.45, 1]}
              />
              <Animated.View pointerEvents="none" style={[styles.shimmer, shimmerStyle]}>
                <LinearGradient
                  colors={['transparent', 'rgba(230,200,139,0.22)', 'transparent']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <View style={styles.heroContent}>
                {hasYear ? (
                  <Animated.Text
                    style={[{fontFamily: FONTS.display, color: HERO_TEXT, fontSize: 68, lineHeight: 74, letterSpacing: -1}, sYear]}>
                    {daily!.year}
                  </Animated.Text>
                ) : null}
                {daily?.location ? (
                  <Text
                    style={{fontFamily: FONTS.uiSemiBold, color: COLORS.goldLight}}
                    className="mt-1 text-[11px] tracking-[0.2em] uppercase">
                    {daily.location}
                  </Text>
                ) : null}
                <Text
                  style={{fontFamily: FONTS.ui, color: 'rgba(251,246,236,0.9)'}}
                  className="mt-3 text-sm leading-[21px]"
                  numberOfLines={4}>
                  {daily!.body}
                </Text>
                {hasCta ? (
                  <View className="mt-5">
                    <ExploreButton label={daily!.cta_label as string} onPress={onCtaPress} />
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={[styles.heroCard, styles.heroFallback]}>
              <AmbientGlow height={HERO_MIN_H} />
              <View style={styles.heroContent}>
                {hasStory ? (
                  <>
                    {hasYear ? (
                      <Animated.Text
                        style={[{fontFamily: FONTS.display, color: COLORS.gold, fontSize: 68, lineHeight: 74, letterSpacing: -1}, sYear]}>
                        {daily!.year}
                      </Animated.Text>
                    ) : null}
                    <View style={styles.goldRule} />
                    {daily?.location ? (
                      <Text
                        style={{fontFamily: FONTS.uiSemiBold, color: COLORS.goldLight}}
                        className="mt-3 text-[11px] tracking-[0.2em] uppercase">
                        {daily.location}
                      </Text>
                    ) : null}
                    <Text
                      style={{fontFamily: FONTS.ui}}
                      className="mt-3 text-sm leading-[21px] text-foreground/90"
                      numberOfLines={5}>
                      {daily!.body}
                    </Text>
                    {hasCta ? (
                      <View className="mt-5">
                        <ExploreButton label={daily!.cta_label as string} onPress={onCtaPress} />
                      </View>
                    ) : null}
                  </>
                ) : loading ? (
                  <Text style={{fontFamily: FONTS.ui, fontSize: 14, color: 'rgba(244,239,231,0.6)'}}>
                    {t('daily.loading')}
                  </Text>
                ) : (
                  <>
                    <View style={styles.goldRule} />
                    <Text
                      style={{fontFamily: FONTS.display, color: COLORS.gold}}
                      className="mt-3 text-2xl leading-tight">
                      {t('daily.emptyTitle')}
                    </Text>
                    <Text
                      style={{fontFamily: FONTS.ui}}
                      className="mt-2 text-sm leading-[21px] text-foreground/80">
                      {t('daily.emptyBody')}
                    </Text>
                  </>
                )}
              </View>
            </View>
          )}
        </Animated.View>

        {/* Weekly streak strip */}
        <Animated.View style={sWeekly}>
          <View className="mt-7 px-6 flex-row justify-between items-baseline">
            <Text
              style={{fontFamily: FONTS.uiSemiBold}}
              className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              {t('daily.thisWeek')}
            </Text>
            <Pressable
              onPress={onSeeAll}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('daily.seeAllA11y')}>
              <Text style={{fontFamily: FONTS.uiMedium}} className="text-[13px] text-primary">
                {t('daily.seeAll')}
              </Text>
            </Pressable>
          </View>
          <View className="mt-3 px-5 flex-row justify-between">
            {weeklyStreak.map((d, i) => {
              const isToday = d.is_today;
              const visited = d.visited;
              return (
                <View key={`${d.weekday}-${i}`} style={styles.tileWrap}>
                  {isToday ? (
                    <Animated.View pointerEvents="none" style={[styles.todayGlow, glowStyle]} />
                  ) : null}
                  <View
                    className="w-11 h-[64px] rounded-2xl border items-center pt-2"
                    style={{
                      backgroundColor: isToday ? COLORS.gold : 'rgba(255,255,255,0.04)',
                      borderColor: isToday ? COLORS.goldLight : 'rgba(255,255,255,0.08)',
                      opacity: !isToday && !visited ? 0.5 : 1,
                    }}>
                    <Text
                      style={{
                        fontFamily: FONTS.uiSemiBold,
                        fontSize: 9,
                        color: isToday ? 'rgba(10,10,12,0.7)' : COLORS.textTertiary,
                        letterSpacing: 0.8,
                      }}>
                      {d.weekday}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontFamily: FONTS.display,
                        fontSize: 16,
                        color: isToday ? '#0A0A0C' : COLORS.textPrimary,
                      }}>
                      {d.date_num}
                    </Text>
                    {isToday ? (
                      <Text style={{marginTop: 3, fontFamily: FONTS.uiMedium, fontSize: 9, color: 'rgba(10,10,12,0.7)', letterSpacing: 0.5}}>
                        {t('daily.nowTile')}
                      </Text>
                    ) : visited ? (
                      <View className="mt-1.5 w-3 h-3 rounded-full items-center justify-center" style={{backgroundColor: COLORS.success}}>
                        <Text style={{color: '#FFFFFF', fontSize: 8, lineHeight: 10}}>✓</Text>
                      </View>
                    ) : (
                      <View className="mt-1.5 w-3 h-3 rounded-full bg-white/[0.08]" />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    minHeight: HERO_MIN_H,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#131218',
  },
  heroFallback: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroContent: {
    minHeight: HERO_MIN_H,
    justifyContent: 'flex-end',
    padding: 24,
  },
  shimmer: {
    position: 'absolute',
    top: -90,
    bottom: -90,
    left: 0,
    width: 140,
  },
  goldRule: {
    marginTop: 14,
    width: 40,
    height: 2,
    borderRadius: 2,
    backgroundColor: COLORS.gold,
  },
  cta: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  tileWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 18,
    backgroundColor: 'rgba(203,168,98,0.45)',
  },
});

export default Daily;
