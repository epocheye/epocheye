import React, {useCallback, useMemo, useState} from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
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
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
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
    <View className="flex-1 bg-surface-1">
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} className="bg-surface-1" />
      <ScrollView
        contentContainerStyle={{paddingBottom: 32}}
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
        <View className="px-6 pt-[18px] pb-4 flex-row items-end justify-between">
          <View className="flex-1">
            <Text style={{fontFamily: FONTS.sansSemiBold, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.4}}>
              {dateLabel}
            </Text>
            <Text style={{marginTop: 6, fontFamily: FONTS.serifItalic, fontSize: 32, color: '#FFFFFF', lineHeight: 38}}>
              On this day
            </Text>
          </View>
          <View className="px-[14px] py-2 rounded-full bg-[#D4860A]">
            <Text style={{fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#FFFFFF'}}>
              🔥 {streakCount}
            </Text>
          </View>
        </View>

        {/* Hero card */}
        <LinearGradient
          colors={[AMBER_LIGHT, AMBER, AMBER_DEEP]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={{
            marginHorizontal: 24,
            borderRadius: 16,
            paddingHorizontal: 22,
            paddingTop: 18,
            paddingBottom: 22,
            minHeight: 280,
          }}>
          {daily ? (
            <>
              <Text style={{fontFamily: FONTS.serifItalic, fontSize: 84, color: '#FFFFFF', lineHeight: 90, letterSpacing: -1}}>
                {daily.year}
              </Text>
              <Text style={{marginTop: 6, fontFamily: FONTS.sansSemiBold, fontSize: 11, color: 'rgba(255,255,255,0.78)', letterSpacing: 1.4}}>
                {daily.location}
              </Text>
              <Text style={{marginTop: 14, fontFamily: FONTS.sans, fontSize: 14, color: 'rgba(255,255,255,0.92)', lineHeight: 21}}>
                {daily.body}
              </Text>
              {daily.cta_place_id && daily.cta_label ? (
                <Pressable
                  onPress={onCtaPress}
                  style={({pressed}) => [
                    {
                      marginTop: 22,
                      alignSelf: 'flex-start' as const,
                      flexDirection: 'row' as const,
                      alignItems: 'center' as const,
                      paddingHorizontal: 18,
                      paddingVertical: 12,
                      borderRadius: 999,
                      backgroundColor: '#FFFFFF',
                      gap: 6,
                    },
                    pressed && {opacity: 0.85},
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={daily.cta_label}>
                  <Text style={{fontFamily: FONTS.sansMedium, fontSize: 14, color: '#0A0A0A'}}>
                    {daily.cta_label}
                  </Text>
                  <ChevronRight color="#0A0A0A" size={14} />
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={{flex: 1, textAlignVertical: 'center', fontFamily: FONTS.sans, fontSize: 14, color: 'rgba(255,255,255,0.85)'}}>
              Loading today's story…
            </Text>
          )}
        </LinearGradient>

        {/* Weekly streak strip */}
        <View className="mt-[26px] px-6 flex-row justify-between items-center">
          <Text style={{fontFamily: FONTS.sansSemiBold, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2}}>
            THIS WEEK
          </Text>
          <Pressable
            onPress={onSeeAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="See all visit history">
            <Text style={{fontFamily: FONTS.sansMedium, fontSize: 13, color: AMBER}}>
              See all
            </Text>
          </Pressable>
        </View>
        <View className="mt-3 px-[18px] flex-row justify-between">
          {weeklyStreak.map((d, i) => (
            <View
              key={`${d.weekday}-${i}`}
              className={`w-11 h-[62px] rounded-[10px] border items-center pt-2${
                d.is_today
                  ? ' bg-[#D4860A] border-[#E8A020]'
                  : !d.visited
                  ? ' bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.06)] opacity-[0.55]'
                  : ' bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.06)]'
              }`}>
              <Text style={{fontFamily: FONTS.sansSemiBold, fontSize: 9, color: d.is_today ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)', letterSpacing: 0.8}}>
                {d.weekday}
              </Text>
              <Text style={{marginTop: 2, fontFamily: FONTS.sansBold, fontSize: 16, color: '#FFFFFF'}}>
                {d.date_num}
              </Text>
              {d.is_today ? (
                <Text style={{marginTop: 4, fontFamily: FONTS.sansMedium, fontSize: 9, color: '#FFFFFF', letterSpacing: 0.5}}>
                  now
                </Text>
              ) : d.visited ? (
                <View className="mt-1 w-3 h-3 rounded-full bg-[#3FB950] items-center justify-center">
                  <Text style={{color: '#FFFFFF', fontSize: 8, lineHeight: 10}}>✓</Text>
                </View>
              ) : (
                <View className="mt-1 w-3 h-3 rounded-full bg-[rgba(255,255,255,0.08)]" />
              )}
            </View>
          ))}
        </View>

        {/* Daily nudge row */}
        <View className="mt-6 mx-6 px-4 py-[14px] rounded-[14px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] flex-row items-center">
          <View className="w-[42px] h-[42px] rounded-full bg-[rgba(212,134,10,0.15)] items-center justify-center mr-3">
            <Bell color={AMBER_LIGHT} size={20} />
          </View>
          <View className="flex-1">
            <Text style={{fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#FFFFFF'}}>
              Daily nudge at {nudge.time_local}
            </Text>
            <Text style={{marginTop: 2, fontFamily: FONTS.sans, fontSize: 12, color: 'rgba(255,255,255,0.55)'}}>
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

export default Daily;
