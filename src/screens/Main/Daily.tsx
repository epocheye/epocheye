import React, {useCallback, useMemo, useState} from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {Bell, ChevronRight} from 'lucide-react-native';
import {FONTS} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import {useDailyToday, useDailyNudge} from '../../shared/hooks';
import type {DailyStreakDay} from '../../utils/api/daily';
import type {TabScreenProps} from '../../core/types/navigation.types';

type Props = TabScreenProps<'Daily'>;

const AMBER = '#D4860A';
const AMBER_DEEP = '#7A4A0A';
const AMBER_LIGHT = '#E8A020';

function todayDateLabel(): string {
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  const now = new Date();
  return `TODAY · ${months[now.getMonth()]} ${now.getDate()}`;
}

const Daily: React.FC<Props> = ({navigation}) => {
  const {daily, refresh: refreshDaily} = useDailyToday();
  const {state: nudge, toggle: toggleNudge} = useDailyNudge();
  const [refreshing, setRefreshing] = useState(false);

  const dateLabel = useMemo(() => todayDateLabel(), []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDaily();
    setRefreshing(false);
  }, [refreshDaily]);

  const onCtaPress = useCallback(() => {
    if (!daily?.cta_place_id) return;
    navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
      site: {id: daily.cta_place_id, name: daily.cta_label ?? ''},
    });
  }, [daily, navigation]);

  const onSeeAll = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.HISTORY);
  }, [navigation]);

  const streakCount = daily?.streak_count ?? 0;
  const weeklyStreak: DailyStreakDay[] = daily?.weekly_streak ?? [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.safeTop} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AMBER}
            colors={[AMBER]}
          />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View style={{flex: 1}}>
            <Text style={styles.kicker}>{dateLabel}</Text>
            <Text style={styles.title}>On this day</Text>
          </View>
          <View style={styles.streakChip}>
            <Text style={styles.streakChipText}>🔥 {streakCount}</Text>
          </View>
        </View>

        {/* Hero "year/location/body/cta" card */}
        <LinearGradient
          colors={[AMBER_LIGHT, AMBER, AMBER_DEEP]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.heroCard}>
          {daily ? (
            <>
              <Text style={styles.heroYear}>{daily.year}</Text>
              <Text style={styles.heroLocation}>{daily.location}</Text>
              <Text style={styles.heroBody}>{daily.body}</Text>
              {daily.cta_place_id && daily.cta_label ? (
                <Pressable
                  onPress={onCtaPress}
                  style={({pressed}) => [
                    styles.heroCta,
                    pressed && styles.heroCtaPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={daily.cta_label}>
                  <Text style={styles.heroCtaLabel}>{daily.cta_label}</Text>
                  <ChevronRight color="#0A0A0A" size={14} />
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={styles.heroPlaceholder}>
              Loading today's story…
            </Text>
          )}
        </LinearGradient>

        {/* Weekly streak strip */}
        <View style={styles.weekHeader}>
          <Text style={styles.sectionKicker}>THIS WEEK</Text>
          <Pressable
            onPress={onSeeAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="See all visit history">
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {weeklyStreak.map((d, i) => (
            <View
              key={`${d.weekday}-${i}`}
              style={[
                styles.weekCell,
                d.is_today && styles.weekCellToday,
                !d.visited && !d.is_today && styles.weekCellEmpty,
              ]}>
              <Text
                style={[
                  styles.weekday,
                  d.is_today && styles.weekdayToday,
                ]}>
                {d.weekday}
              </Text>
              <Text
                style={[
                  styles.weekDate,
                  d.is_today && styles.weekDateToday,
                ]}>
                {d.date_num}
              </Text>
              {d.is_today ? (
                <Text style={styles.weekNow}>now</Text>
              ) : d.visited ? (
                <View style={styles.weekCheck}>
                  <Text style={styles.weekCheckMark}>✓</Text>
                </View>
              ) : (
                <View style={styles.weekDotEmpty} />
              )}
            </View>
          ))}
        </View>

        {/* Daily nudge row */}
        <View style={styles.nudgeCard}>
          <View style={styles.nudgeIcon}>
            <Bell color={AMBER_LIGHT} size={20} />
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.nudgeTitle}>
              Daily nudge at {nudge.time_local}
            </Text>
            <Text style={styles.nudgeSubtitle}>
              A 60-second story to start your day
            </Text>
          </View>
          <Switch
            value={nudge.enabled}
            onValueChange={toggleNudge}
            trackColor={{false: 'rgba(255,255,255,0.18)', true: AMBER}}
            thumbColor="#FFFFFF"
            ios_backgroundColor="rgba(255,255,255,0.18)"
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0A0A'},
  safeTop: {backgroundColor: '#0A0A0A'},
  scroll: {paddingBottom: 32},
  header: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 6,
    fontFamily: FONTS.serifItalic,
    fontSize: 32,
    color: '#FFFFFF',
    lineHeight: 38,
  },
  streakChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: AMBER,
  },
  streakChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  heroCard: {
    marginHorizontal: 24,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 22,
    minHeight: 280,
  },
  heroYear: {
    fontFamily: FONTS.serifItalic,
    fontSize: 84,
    color: '#FFFFFF',
    lineHeight: 90,
    letterSpacing: -1,
  },
  heroLocation: {
    marginTop: 6,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 1.4,
  },
  heroBody: {
    marginTop: 14,
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 21,
  },
  heroCta: {
    marginTop: 22,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  heroCtaPressed: {opacity: 0.85},
  heroCtaLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: '#0A0A0A',
  },
  heroPlaceholder: {
    flex: 1,
    textAlignVertical: 'center',
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  weekHeader: {
    marginTop: 26,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionKicker: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
  },
  seeAll: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: AMBER,
  },
  weekRow: {
    marginTop: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekCell: {
    width: 44,
    height: 62,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    paddingTop: 8,
  },
  weekCellEmpty: {opacity: 0.55},
  weekCellToday: {
    backgroundColor: AMBER,
    borderColor: AMBER_LIGHT,
  },
  weekday: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.8,
  },
  weekdayToday: {color: 'rgba(255,255,255,0.85)'},
  weekDate: {
    marginTop: 2,
    fontFamily: FONTS.sansBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  weekDateToday: {color: '#FFFFFF'},
  weekNow: {
    marginTop: 4,
    fontFamily: FONTS.sansMedium,
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  weekCheck: {
    marginTop: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3FB950',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCheckMark: {
    color: '#FFFFFF',
    fontSize: 8,
    lineHeight: 10,
  },
  weekDotEmpty: {
    marginTop: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  nudgeCard: {
    marginTop: 24,
    marginHorizontal: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  nudgeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(212,134,10,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nudgeTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  nudgeSubtitle: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
});

export default Daily;
