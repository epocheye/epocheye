import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
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
        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.avatarOuter}>
            {profile?.avatar_url ? (
              <Image
                source={{uri: profile.avatar_url}}
                style={styles.avatarImg}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={[AMBER_LIGHT, AMBER, AMBER_DEEP]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.avatarGradient}>
                <Text style={styles.avatarInitial}>
                  {initialLetter(profile?.name)}
                </Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {location ? (
              <Text style={styles.location}>{location}</Text>
            ) : null}
            {isStreakActive ? (
              <View style={styles.streakRow}>
                <View style={styles.streakDot} />
                <Text style={styles.streakLabel}>
                  {streakDays} day streak active
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={openSettings}
            hitSlop={10}
            style={styles.menuButton}
            accessibilityRole="button"
            accessibilityLabel="Open settings">
            <MoreHorizontal color="#FFFFFF" size={20} />
          </Pressable>
        </View>

        {/* Stat cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{sites}</Text>
            <Text style={styles.statLabel}>SITES</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{dynasties}</Text>
            <Text style={styles.statLabel}>DYNASTIES</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{streakDays}</Text>
            <Text style={styles.statLabel}>STREAK</Text>
          </View>
        </View>

        {/* Digest card */}
        <Text style={[styles.sectionKicker, {marginTop: 24}]}>THIS WEEK</Text>
        <LinearGradient
          colors={[AMBER_LIGHT, AMBER, AMBER_DEEP]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.digestCard}>
          <Text style={styles.digestKicker}>YOUR DIGEST</Text>
          {digest ? (
            <>
              {digest.headline ? (
                <Text style={styles.digestHeadline}>{digest.headline}</Text>
              ) : null}
              {digest.body ? (
                <Text style={styles.digestBody}>{digest.body}</Text>
              ) : null}
              {(digest.dynasty_tags?.length ?? 0) > 0 ? (
                <View style={styles.dynastyRow}>
                  {(digest.dynasty_tags ?? []).map(tag => (
                    <View key={tag} style={styles.dynastyChip}>
                      <Text style={styles.dynastyChipText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.digestPlaceholder}>
              Visit a site this week to unlock your digest.
            </Text>
          )}
        </LinearGradient>

        {/* Recent journeys */}
        <View style={styles.journeysHeader}>
          <Text style={styles.sectionKicker}>RECENT JOURNEYS</Text>
          <Pressable
            onPress={openHistory}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="View all journeys">
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        </View>
        {recentJourneys.length > 0 ? (
          recentJourneys.map(visit => (
            <Pressable
              key={visit.id}
              onPress={() => goToSite(visit)}
              style={({pressed}) => [
                styles.journeyRow,
                pressed && styles.journeyRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Visit: ${visit.place_name}`}>
              <View style={styles.journeyThumb} />
              <View style={styles.journeyBody}>
                <Text style={styles.journeyName} numberOfLines={1}>
                  {visit.place_name}
                </Text>
                <Text style={styles.journeyMeta} numberOfLines={1}>
                  {formatRelativeTime(visit.arrived_at)}
                </Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.45)" size={18} />
            </Pressable>
          ))
        ) : (
          <View style={styles.journeysEmpty}>
            <Text style={styles.journeysEmptyText}>
              No journeys yet. Visit a heritage site to start your timeline.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0A0A'},
  safeTop: {backgroundColor: '#0A0A0A'},
  scroll: {paddingBottom: 32, paddingHorizontal: 24},
  header: {
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  avatarOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(212,134,10,0.18)',
    padding: 3,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: FONTS.sansBold,
    fontSize: 36,
    color: '#FFFFFF',
  },
  headerText: {flex: 1, paddingTop: 4},
  name: {
    fontFamily: FONTS.serif,
    fontSize: 26,
    color: '#FFFFFF',
    lineHeight: 30,
  },
  location: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
  streakRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3FB950',
    marginRight: 8,
  },
  streakLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    color: '#FFFFFF',
    lineHeight: 36,
  },
  statLabel: {
    marginTop: 4,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.1,
  },
  sectionKicker: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
  },
  digestCard: {
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  digestKicker: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 1.4,
  },
  digestHeadline: {
    marginTop: 6,
    fontFamily: FONTS.sans,
    fontSize: 15,
    color: 'rgba(255,255,255,0.92)',
  },
  digestBody: {
    marginTop: 4,
    fontFamily: FONTS.serifItalic,
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 34,
  },
  digestPlaceholder: {
    marginTop: 6,
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  dynastyRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dynastyChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dynastyChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    color: '#FFFFFF',
  },
  journeysHeader: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAll: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: AMBER,
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  journeyRowPressed: {opacity: 0.85},
  journeyThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(212,134,10,0.22)',
    marginRight: 12,
  },
  journeyBody: {flex: 1},
  journeyName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  journeyMeta: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  journeysEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  journeysEmptyText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
});

export default Profile;
