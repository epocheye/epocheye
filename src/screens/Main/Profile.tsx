import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useFocusEffect} from '@react-navigation/native';
import {ChevronRight, MoreHorizontal} from 'lucide-react-native';
import {FONTS} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import {useUser} from '../../context';
import {
  usePassportSummary,
  useProfileDigest,
} from '../../shared/hooks';
import {getVisitHistory, type VisitRow} from '../../utils/api/visits';
import {formatRelativeTime} from '../../shared/utils';
import type {TabScreenProps} from '../../core/types/navigation.types';

type Props = TabScreenProps<'Profile'>;

const AMBER = '#D4860A';
const AMBER_DEEP = '#7A4A0A';
const AMBER_LIGHT = '#E8A020';

function initialLetter(name: string | undefined | null): string {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : '?';
}

const Profile: React.FC<Props> = ({navigation}) => {
  const profile = useUser(s => s.profile);
  const {summary, refresh: refreshSummary} = usePassportSummary();
  const {digest, refresh: refreshDigest} = useProfileDigest();

  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVisits = useCallback(async () => {
    const result = await getVisitHistory();
    if (result.success) {
      setVisits(result.data.visits ?? []);
    }
  }, []);

  useEffect(() => {
    void fetchVisits();
  }, [fetchVisits]);

  useFocusEffect(
    useCallback(() => {
      void fetchVisits();
    }, [fetchVisits]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshSummary(), refreshDigest(), fetchVisits()]);
    setRefreshing(false);
  }, [refreshSummary, refreshDigest, fetchVisits]);

  const openSettings = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.SETTINGS);
  }, [navigation]);

  const openHistory = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.HISTORY);
  }, [navigation]);

  const recentJourneys = useMemo(() => visits.slice(0, 3), [visits]);

  const goToSite = useCallback(
    (visit: VisitRow) => {
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: {id: visit.place_id, name: visit.place_name},
      });
    },
    [navigation],
  );

  const sites = summary?.sites_visited ?? 0;
  const dynasties = summary?.dynasties_count ?? 0;
  const streakDays = summary?.streak_days ?? 0;
  const isStreakActive = streakDays > 0;
  const name = profile?.name?.trim() || 'Your name';
  const location =
    (profile?.preferences?.location as string | undefined) ?? '';

  return (
    <View className="flex-1 bg-surface-1">
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} className="bg-surface-1" />
      <ScrollView
        contentContainerStyle={{paddingBottom: 32, paddingHorizontal: 24}}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AMBER}
            colors={[AMBER]}
          />
        }>
        {/* Header row */}
        <View className="pt-[14px] flex-row items-start gap-x-[14px]">
          <View className="w-[76px] h-[76px] rounded-full bg-[rgba(212,134,10,0.18)] p-[3px]">
            {profile?.avatar_url ? (
              <Image
                source={{uri: profile.avatar_url}}
                className="w-full h-full rounded-[35px]"
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={[AMBER_LIGHT, AMBER, AMBER_DEEP]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={{width: '100%', height: '100%', borderRadius: 35, alignItems: 'center', justifyContent: 'center'}}>
                <Text style={{fontFamily: FONTS.sansBold, fontSize: 36, color: '#FFFFFF'}}>
                  {initialLetter(profile?.name)}
                </Text>
              </LinearGradient>
            )}
          </View>
          <View className="flex-1 pt-1">
            <Text
              style={{fontFamily: FONTS.serif, fontSize: 26, color: '#FFFFFF', lineHeight: 30}}
              numberOfLines={1}>
              {name}
            </Text>
            {location ? (
              <Text style={{marginTop: 2, fontFamily: FONTS.sans, fontSize: 13, color: 'rgba(255,255,255,0.55)'}}>
                {location}
              </Text>
            ) : null}
            {isStreakActive ? (
              <View className="mt-2 flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-[#3FB950] mr-2" />
                <Text style={{fontFamily: FONTS.sansMedium, fontSize: 12, color: 'rgba(255,255,255,0.78)'}}>
                  {streakDays} day streak active
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={openSettings}
            hitSlop={10}
            className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.06)] items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Open settings">
            <MoreHorizontal color="#FFFFFF" size={20} />
          </Pressable>
        </View>

        {/* Stat cards */}
        <View className="mt-5 flex-row gap-x-[10px]">
          {([
            {label: 'SITES', value: sites},
            {label: 'DYNASTIES', value: dynasties},
            {label: 'STREAK', value: streakDays},
          ] as const).map(stat => (
            <View
              key={stat.label}
              className="flex-1 py-[14px] px-[10px] rounded-[14px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] items-center">
              <Text style={{fontFamily: FONTS.serif, fontSize: 32, color: '#FFFFFF', lineHeight: 36}}>
                {stat.value}
              </Text>
              <Text style={{marginTop: 4, fontFamily: FONTS.sansSemiBold, fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.1}}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Digest card */}
        <Text style={{marginTop: 24, fontFamily: FONTS.sansSemiBold, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2}}>
          THIS WEEK
        </Text>
        <LinearGradient
          colors={[AMBER_LIGHT, AMBER, AMBER_DEEP]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={{marginTop: 12, borderRadius: 14, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16}}>
          <Text style={{fontFamily: FONTS.sansSemiBold, fontSize: 10, color: 'rgba(255,255,255,0.78)', letterSpacing: 1.4}}>
            YOUR DIGEST
          </Text>
          {digest ? (
            <>
              {digest.headline ? (
                <Text style={{marginTop: 6, fontFamily: FONTS.sans, fontSize: 15, color: 'rgba(255,255,255,0.92)'}}>
                  {digest.headline}
                </Text>
              ) : null}
              {digest.body ? (
                <Text style={{marginTop: 4, fontFamily: FONTS.serifItalic, fontSize: 28, color: '#FFFFFF', lineHeight: 34}}>
                  {digest.body}
                </Text>
              ) : null}
              {(digest.dynasty_tags?.length ?? 0) > 0 ? (
                <View className="mt-3 flex-row flex-wrap gap-[6px]">
                  {(digest.dynasty_tags ?? []).map(tag => (
                    <View key={tag} className="px-[10px] py-[5px] rounded-full bg-[rgba(255,255,255,0.18)]">
                      <Text style={{fontFamily: FONTS.sansMedium, fontSize: 11, color: '#FFFFFF'}}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={{marginTop: 6, fontFamily: FONTS.sans, fontSize: 14, color: 'rgba(255,255,255,0.85)'}}>
              Visit a site this week to unlock your digest.
            </Text>
          )}
        </LinearGradient>

        {/* Recent journeys */}
        <View className="mt-[22px] mb-[10px] flex-row justify-between items-center">
          <Text style={{fontFamily: FONTS.sansSemiBold, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2}}>
            RECENT JOURNEYS
          </Text>
          <Pressable
            onPress={openHistory}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="View all journeys">
            <Text style={{fontFamily: FONTS.sansMedium, fontSize: 13, color: AMBER}}>
              View all
            </Text>
          </Pressable>
        </View>
        {recentJourneys.length > 0 ? (
          recentJourneys.map(visit => (
            <Pressable
              key={visit.id}
              onPress={() => goToSite(visit)}
              style={({pressed}) => pressed ? {opacity: 0.85} : undefined}
              className="flex-row items-center py-[10px] px-[10px] rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] mb-2"
              accessibilityRole="button"
              accessibilityLabel={`Visit: ${visit.place_name}`}>
              <View className="w-11 h-11 rounded-lg bg-[rgba(212,134,10,0.22)] mr-3" />
              <View className="flex-1">
                <Text
                  style={{fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#FFFFFF'}}
                  numberOfLines={1}>
                  {visit.place_name}
                </Text>
                <Text
                  style={{marginTop: 2, fontFamily: FONTS.sans, fontSize: 11, color: 'rgba(255,255,255,0.55)'}}
                  numberOfLines={1}>
                  {formatRelativeTime(visit.arrived_at)}
                </Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.45)" size={18} />
            </Pressable>
          ))
        ) : (
          <View className="py-6 items-center">
            <Text style={{fontFamily: FONTS.sans, fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center'}}>
              No journeys yet. Visit a heritage site to start your timeline.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default Profile;
