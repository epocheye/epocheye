import React, {useCallback, useMemo, useState} from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {ChevronRight, Lock, Sparkles} from 'lucide-react-native';
import {COLORS, FONTS} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import {
  usePassportSummary,
  usePassportStamps,
} from '../../shared/hooks';
import type {
  LockedSite,
  PassportStamp,
} from '../../utils/api/passport';
import type {ExplorerPass} from '../../utils/api/explorer-pass/types';
import type {SavedPlace} from '../../utils/api/places/types';
import {buildSiteDetailData} from '../../shared/utils';
import type {TabScreenProps} from '../../core/types/navigation.types';
import PlanList from './components/PlanList';

type Mode = 'stamps' | 'plan';

type Props = TabScreenProps<'Passport'>;

const AMBER = '#D4860A';
const AMBER_DEEP = '#7A4A0A';
const AMBER_LIGHT = '#E8A020';

const GRID_HORIZONTAL_PADDING = 18;
const GRID_GAP = 8;

function formatPassExpiry(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return 'expired';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

const Passport: React.FC<Props> = ({navigation}) => {
  const {width: screenWidth} = useWindowDimensions();
  const {summary, refresh: refreshSummary} = usePassportSummary();
  const {
    stamps,
    lockedSites,
    refresh: refreshStamps,
  } = usePassportStamps();
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<Mode>('stamps');

  const tileWidth = useMemo(
    () =>
      (screenWidth - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * 2) / 3,
    [screenWidth],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshSummary(), refreshStamps()]);
    setRefreshing(false);
  }, [refreshSummary, refreshStamps]);

  const onStampPress = useCallback(
    (stamp: PassportStamp) => {
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: {
          id: stamp.place_id,
          name: stamp.place_name,
          heroImages: stamp.image_url ? [stamp.image_url] : undefined,
        },
      });
    },
    [navigation],
  );

  const onPassPress = useCallback(
    (pass: ExplorerPass) => {
      const firstId = pass.place_ids?.[0];
      if (!firstId) return;
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: {id: firstId, name: ''},
      });
    },
    [navigation],
  );

  const onBuyPassport = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.PURCHASE);
  }, [navigation]);

  const onPlanPlacePress = useCallback(
    (saved: SavedPlace) => {
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: buildSiteDetailData(saved.place_data),
      });
    },
    [navigation],
  );

  const streakDays = summary?.streak_days ?? 0;
  const sitesVisited = summary?.sites_visited ?? 0;
  const sitesGoal = summary?.sites_goal ?? 50;
  const dynastiesCount = summary?.dynasties_count ?? 0;
  const activePasses = summary?.active_passes ?? [];
  const progress = sitesGoal > 0 ? Math.min(sitesVisited / sitesGoal, 1) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <LinearGradient
          colors={[AMBER_LIGHT, AMBER, AMBER_DEEP]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.banner}>
          <Text style={styles.bannerKicker}>YOUR PASSPORT</Text>
          <Text style={styles.bannerTitle}>
            {streakDays} day {streakDays === 1 ? 'streak' : 'streak'}
          </Text>
        </LinearGradient>
      </SafeAreaView>

      {/* Stamps | Plan segmented control — pinned just below the banner */}
      <View style={styles.modeRow}>
        <View style={styles.modeTrack}>
          <Pressable
            onPress={() => setMode('stamps')}
            style={[styles.modeBtn, mode === 'stamps' && styles.modeBtnActive]}
            accessibilityRole="button"
            accessibilityState={{selected: mode === 'stamps'}}>
            <Text
              style={[
                styles.modeLabel,
                mode === 'stamps' && styles.modeLabelActive,
              ]}>
              Stamps
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('plan')}
            style={[styles.modeBtn, mode === 'plan' && styles.modeBtnActive]}
            accessibilityRole="button"
            accessibilityState={{selected: mode === 'plan'}}>
            <Text
              style={[
                styles.modeLabel,
                mode === 'plan' && styles.modeLabelActive,
              ]}>
              Plan
            </Text>
          </Pressable>
        </View>
      </View>

      {mode === 'plan' ? (
        <PlanList onPlacePress={onPlanPlacePress} />
      ) : (
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
        {/* Stats card */}
        <View style={styles.statsCard}>
          <View style={styles.statsLeft}>
            <View style={styles.statsRow}>
              <Text style={styles.statsBig}>{sitesVisited}</Text>
              <Text style={styles.statsTotal}>/ {sitesGoal}</Text>
            </View>
            <Text style={styles.statsLabel}>SITES VISITED</Text>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, {width: `${progress * 100}%`}]}
              />
            </View>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsRight}>
            <Text style={styles.statsBig}>{dynastiesCount}</Text>
            <Text style={styles.statsLabel}>DYNASTIES</Text>
          </View>
        </View>

        {/* Get Your Passport CTA — prominent when no active passes, compact when at least one */}
        {activePasses.length === 0 ? (
          <Pressable
            onPress={onBuyPassport}
            style={({pressed}) => [
              styles.buyCard,
              pressed && styles.buyCardPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Get Your Passport — unlock heritage sites near you">
            <View style={styles.buyIcon}>
              <Sparkles color="#FFFFFF" size={20} />
            </View>
            <View style={styles.buyText}>
              <Text style={styles.buyTitle}>Get Your Passport</Text>
              <Text style={styles.buyBody}>
                Unlock heritage sites near you. The more places you pick, the less
                you pay per site.
              </Text>
              <View style={styles.buyCtaPill}>
                <Text style={styles.buyCtaLabel}>Choose Places</Text>
                <ChevronRight color="#FFFFFF" size={14} />
              </View>
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={onBuyPassport}
            style={({pressed}) => [
              styles.extendRow,
              pressed && styles.extendRowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Extend your Passport">
            <Text style={styles.extendLabel}>Extend your Passport</Text>
            <ChevronRight color={COLORS.sky} size={16} />
          </Pressable>
        )}

        {/* Active paid passes */}
        {activePasses.length > 0 ? (
          <View style={styles.passesSection}>
            <Text style={styles.sectionKicker}>ACTIVE PASSES</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.passesRow}>
              {activePasses.map(pass => (
                <Pressable
                  key={pass.id}
                  style={({pressed}) => [
                    styles.passChip,
                    pressed && styles.passChipPressed,
                  ]}
                  onPress={() => onPassPress(pass)}
                  accessibilityRole="button">
                  <Text style={styles.passChipName} numberOfLines={1}>
                    {pass.place_count} place{pass.place_count === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.passChipExpiry}>
                    {formatPassExpiry(pass.expires_at)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Stamps header */}
        <View style={styles.stampsHeader}>
          <Text style={styles.stampsHeaderTitle}>STAMPS</Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              /* MVP: filter sheet not yet implemented */
            }}
            accessibilityRole="button"
            accessibilityLabel="Filter stamps">
            <Text style={styles.stampsHeaderAction}>Filter</Text>
          </Pressable>
        </View>

        {/* Stamps grid (unlocked + locked) */}
        <View style={styles.stampsGrid}>
          {stamps.map(stamp => (
            <Pressable
              key={stamp.place_id}
              style={({pressed}) => [
                styles.stampTile,
                {width: tileWidth},
                pressed && styles.stampTilePressed,
              ]}
              onPress={() => onStampPress(stamp)}
              accessibilityRole="button"
              accessibilityLabel={`${stamp.place_name} stamp`}>
              <View style={styles.stampThumbWrap}>
                {stamp.image_url ? (
                  <Image
                    source={{uri: stamp.image_url}}
                    style={styles.stampThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.stampThumbPlaceholder} />
                )}
                <View style={styles.stampCheck}>
                  <Text style={styles.stampCheckMark}>✓</Text>
                </View>
              </View>
              <Text style={styles.stampName} numberOfLines={1}>
                {stamp.place_name}
              </Text>
              {stamp.built_year != null ? (
                <Text style={styles.stampYear}>
                  {stamp.built_year > 0
                    ? `${stamp.built_year} CE`
                    : `${Math.abs(stamp.built_year)} BCE`}
                </Text>
              ) : null}
            </Pressable>
          ))}

          {lockedSites.map((site: LockedSite) => (
            <View
              key={`locked-${site.place_id}`}
              style={[styles.stampTile, {width: tileWidth}]}
              accessibilityLabel={`Locked: ${site.place_name}`}>
              <View
                style={[styles.stampThumbWrap, styles.stampThumbLocked]}>
                <Lock color="rgba(255,255,255,0.55)" size={22} />
              </View>
              <Text style={styles.stampLockedName}>Locked</Text>
              <Text style={styles.stampLockedHint}>
                {site.hint ?? 'unvisited'}
              </Text>
            </View>
          ))}
        </View>

        {/* Empty state */}
        {stamps.length === 0 && lockedSites.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No stamps yet</Text>
            <Text style={styles.emptyBody}>
              Visit a heritage site and your first stamp will appear here.
            </Text>
          </View>
        ) : null}
      </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0A0A'},
  safeTop: {backgroundColor: AMBER},
  banner: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 28,
  },
  bannerKicker: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.4,
  },
  bannerTitle: {
    marginTop: 8,
    fontFamily: FONTS.serif,
    fontSize: 34,
    color: '#FFFFFF',
    letterSpacing: 0.2,
    lineHeight: 38,
  },
  scroll: {
    paddingBottom: 32,
  },
  modeRow: {
    paddingHorizontal: 18,
    paddingTop: 14,
    alignItems: 'center',
  },
  modeTrack: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  modeBtn: {
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: 999,
  },
  modeBtnActive: {
    backgroundColor: AMBER,
  },
  modeLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.3,
  },
  modeLabelActive: {
    color: '#FFFFFF',
  },
  statsCard: {
    marginHorizontal: 18,
    marginTop: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsLeft: {flex: 1.4},
  statsRight: {flex: 1, alignItems: 'flex-start'},
  statsRow: {flexDirection: 'row', alignItems: 'flex-end'},
  statsBig: {
    fontFamily: FONTS.serif,
    fontSize: 44,
    color: '#FFFFFF',
    lineHeight: 46,
  },
  statsTotal: {
    fontFamily: FONTS.sansMedium,
    fontSize: 18,
    color: 'rgba(255,255,255,0.55)',
    marginLeft: 8,
    marginBottom: 4,
  },
  statsLabel: {
    marginTop: 4,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.1,
  },
  statsDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 14,
  },
  progressTrack: {
    marginTop: 10,
    height: 4,
    width: '100%',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: AMBER,
    borderRadius: 2,
  },
  buyCard: {
    marginHorizontal: 18,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: COLORS.sky,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  buyCardPressed: {opacity: 0.9},
  buyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  buyText: {flex: 1},
  buyTitle: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  buyBody: {
    marginTop: 4,
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 17,
  },
  buyCtaPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    gap: 4,
  },
  buyCtaLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: '#FFFFFF',
  },
  extendRow: {
    marginHorizontal: 18,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(97,166,211,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(97,166,211,0.32)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  extendRowPressed: {opacity: 0.85},
  extendLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: COLORS.sky,
  },
  passesSection: {
    marginTop: 22,
  },
  sectionKicker: {
    paddingHorizontal: 18,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.1,
  },
  passesRow: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
  },
  passChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,134,10,0.4)',
    backgroundColor: 'rgba(212,134,10,0.08)',
    minWidth: 140,
  },
  passChipPressed: {opacity: 0.85},
  passChipName: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: '#FFFFFF',
  },
  passChipExpiry: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: AMBER_LIGHT,
  },
  stampsHeader: {
    paddingHorizontal: 18,
    marginTop: 22,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stampsHeaderTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  stampsHeaderAction: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: AMBER,
  },
  stampsGrid: {
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GRID_GAP,
    rowGap: 12,
  },
  stampTile: {
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  stampTilePressed: {opacity: 0.85},
  stampThumbWrap: {
    height: 62,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(212,134,10,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampThumbLocked: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  stampThumb: {width: '100%', height: '100%'},
  stampThumbPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(212,134,10,0.22)',
  },
  stampCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3FB950',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampCheckMark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: FONTS.sansBold,
    lineHeight: 13,
  },
  stampName: {
    marginTop: 8,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  stampYear: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
  },
  stampLockedName: {
    marginTop: 8,
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  stampLockedHint: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
  },
  empty: {
    marginTop: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  emptyBody: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 18,
  },
});

export default Passport;
