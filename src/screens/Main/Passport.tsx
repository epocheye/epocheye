import React, {useCallback, useMemo, useState} from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {ChevronRight, Lock, Menu, Sparkles} from 'lucide-react-native';
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
import type {SiteDetail} from '../../utils/api/places/types';
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
    (site: SiteDetail) => {
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: {
          id: site.slug ?? site.id,
          name: site.name,
          lat: site.latitude,
          lon: site.longitude,
          city: site.city,
          country: site.country,
          formatted: site.short_description,
          heroImages: site.hero_image_url ? [site.hero_image_url] : undefined,
        },
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
    <View className="flex-1 bg-surface-1">
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={{backgroundColor: AMBER}}>
        <LinearGradient
          colors={[AMBER_LIGHT, AMBER, AMBER_DEEP]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={{paddingHorizontal: 24, paddingTop: 14, paddingBottom: 28}}>
          <Pressable
            onPress={() => navigation.openDrawer()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            style={{width: 36, height: 36, marginLeft: -6, marginBottom: 4, alignItems: 'flex-start', justifyContent: 'center'}}>
            <Menu color="#FFFFFF" size={22} />
          </Pressable>
          <Text style={{fontFamily: FONTS.sansSemiBold, fontSize: 11, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.4}}>
            YOUR PASSPORT
          </Text>
          <Text style={{marginTop: 8, fontFamily: FONTS.serif, fontSize: 34, color: '#FFFFFF', letterSpacing: 0.2, lineHeight: 38}}>
            {streakDays} day {streakDays === 1 ? 'streak' : 'streak'}
          </Text>
        </LinearGradient>
      </SafeAreaView>

      {/* Stamps | Plan segmented control */}
      <View className="px-[18px] pt-[14px] items-center">
        <View className="flex-row p-[3px] rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.04)]">
          <Pressable
            onPress={() => setMode('stamps')}
            className={`px-[22px] py-[7px] rounded-full${mode === 'stamps' ? ' bg-[#D4860A]' : ''}`}
            accessibilityRole="button"
            accessibilityState={{selected: mode === 'stamps'}}>
            <Text style={{fontFamily: FONTS.sansMedium, fontSize: 12, color: mode === 'stamps' ? '#FFFFFF' : 'rgba(255,255,255,0.55)', letterSpacing: 0.3}}>
              Stamps
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('plan')}
            className={`px-[22px] py-[7px] rounded-full${mode === 'plan' ? ' bg-[#D4860A]' : ''}`}
            accessibilityRole="button"
            accessibilityState={{selected: mode === 'plan'}}>
            <Text style={{fontFamily: FONTS.sansMedium, fontSize: 12, color: mode === 'plan' ? '#FFFFFF' : 'rgba(255,255,255,0.55)', letterSpacing: 0.3}}>
              Plan
            </Text>
          </Pressable>
        </View>
      </View>

      {mode === 'plan' ? (
        <PlanList onPlacePress={onPlanPlacePress} />
      ) : (
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
          {/* Stats card */}
          <View className="mx-[18px] mt-4 py-[18px] px-5 rounded-2xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] flex-row items-center">
            <View style={{flex: 1.4}}>
              <View className="flex-row items-end">
                <Text style={{fontFamily: FONTS.serif, fontSize: 44, color: '#FFFFFF', lineHeight: 46}}>
                  {sitesVisited}
                </Text>
                <Text style={{fontFamily: FONTS.sansMedium, fontSize: 18, color: 'rgba(255,255,255,0.55)', marginLeft: 8, marginBottom: 4}}>
                  / {sitesGoal}
                </Text>
              </View>
              <Text style={{marginTop: 4, fontFamily: FONTS.sansSemiBold, fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.1}}>
                SITES VISITED
              </Text>
              <View className="mt-[10px] h-1 w-full rounded-sm bg-[rgba(255,255,255,0.08)] overflow-hidden">
                <View
                  className="h-full rounded-sm bg-[#D4860A]"
                  style={{width: `${progress * 100}%`}}
                />
              </View>
            </View>
            <View className="w-px h-[50px] bg-[rgba(255,255,255,0.08)] mx-[14px]" />
            <View className="flex-1 items-start">
              <Text style={{fontFamily: FONTS.serif, fontSize: 44, color: '#FFFFFF', lineHeight: 46}}>
                {dynastiesCount}
              </Text>
              <Text style={{marginTop: 4, fontFamily: FONTS.sansSemiBold, fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.1}}>
                DYNASTIES
              </Text>
            </View>
          </View>

          {/* Buy / extend passport */}
          {activePasses.length === 0 ? (
            <Pressable
              onPress={onBuyPassport}
              style={({pressed}) => [
                {backgroundColor: COLORS.sky},
                pressed && {opacity: 0.9},
              ]}
              className="mx-[18px] mt-[14px] px-4 py-[14px] rounded-2xl flex-row items-start"
              accessibilityRole="button"
              accessibilityLabel="Get Your Passport — unlock heritage sites near you">
              <View className="w-[38px] h-[38px] rounded-full bg-[rgba(255,255,255,0.18)] items-center justify-center mr-3 mt-[2px]">
                <Sparkles color="#FFFFFF" size={20} />
              </View>
              <View className="flex-1">
                <Text style={{fontFamily: FONTS.serif, fontSize: 20, color: '#FFFFFF', lineHeight: 24}}>
                  Get Your Passport
                </Text>
                <Text style={{marginTop: 4, fontFamily: FONTS.sans, fontSize: 12.5, color: 'rgba(255,255,255,0.88)', lineHeight: 17}}>
                  Unlock heritage sites near you. The more places you pick, the less you pay per site.
                </Text>
                <View className="mt-[10px] self-start flex-row items-center px-3 py-[6px] rounded-full bg-[rgba(255,255,255,0.18)] gap-x-1">
                  <Text style={{fontFamily: FONTS.sansMedium, fontSize: 12, color: '#FFFFFF'}}>
                    Choose Places
                  </Text>
                  <ChevronRight color="#FFFFFF" size={14} />
                </View>
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={onBuyPassport}
              style={({pressed}) => pressed ? {opacity: 0.85} : undefined}
              className="mx-[18px] mt-[14px] px-4 py-3 rounded-xl bg-[rgba(97,166,211,0.08)] border border-[rgba(97,166,211,0.32)] flex-row items-center justify-between"
              accessibilityRole="button"
              accessibilityLabel="Extend your Passport">
              <Text style={{fontFamily: FONTS.sansMedium, fontSize: 13, color: COLORS.sky}}>
                Extend your Passport
              </Text>
              <ChevronRight color={COLORS.sky} size={16} />
            </Pressable>
          )}

          {/* Active paid passes */}
          {activePasses.length > 0 ? (
            <View className="mt-[22px]">
              <Text style={{paddingHorizontal: 18, fontFamily: FONTS.sansSemiBold, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.1}}>
                ACTIVE PASSES
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{paddingHorizontal: 18, paddingVertical: 10, gap: 8}}>
                {activePasses.map(pass => (
                  <Pressable
                    key={pass.id}
                    style={({pressed}) => pressed ? {opacity: 0.85} : undefined}
                    className="px-[14px] py-[10px] rounded-xl border border-[rgba(212,134,10,0.4)] bg-[rgba(212,134,10,0.08)] min-w-[140px]"
                    onPress={() => onPassPress(pass)}
                    accessibilityRole="button">
                    <Text style={{fontFamily: FONTS.sansMedium, fontSize: 13, color: '#FFFFFF'}} numberOfLines={1}>
                      {pass.place_count} place{pass.place_count === 1 ? '' : 's'}
                    </Text>
                    <Text style={{marginTop: 2, fontFamily: FONTS.sans, fontSize: 11, color: AMBER_LIGHT}}>
                      {formatPassExpiry(pass.expires_at)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Stamps header */}
          <View className="px-[18px] mt-[22px] mb-3 flex-row items-center justify-between">
            <Text style={{fontFamily: FONTS.sansSemiBold, fontSize: 12, color: '#FFFFFF', letterSpacing: 1.2}}>
              STAMPS
            </Text>
            <Pressable
              hitSlop={8}
              onPress={() => { /* MVP: filter sheet not yet implemented */ }}
              accessibilityRole="button"
              accessibilityLabel="Filter stamps">
              <Text style={{fontFamily: FONTS.sansMedium, fontSize: 13, color: AMBER}}>
                Filter
              </Text>
            </Pressable>
          </View>

          {/* Stamps grid */}
          <View
            className="flex-row flex-wrap"
            style={{paddingHorizontal: GRID_HORIZONTAL_PADDING, columnGap: GRID_GAP, rowGap: 12}}>
            {stamps.map(stamp => (
              <Pressable
                key={stamp.place_id}
                style={({pressed}) => [
                  {width: tileWidth},
                  pressed && {opacity: 0.85},
                ]}
                className="pt-2 px-2 pb-[10px] rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)]"
                onPress={() => onStampPress(stamp)}
                accessibilityRole="button"
                accessibilityLabel={`${stamp.place_name} stamp`}>
                <View className="h-[62px] rounded-lg overflow-hidden bg-[rgba(212,134,10,0.18)] items-center justify-center">
                  {stamp.image_url ? (
                    <Image
                      source={{uri: stamp.image_url}}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-full bg-[rgba(212,134,10,0.22)]" />
                  )}
                  <View className="absolute top-1 right-1 w-[18px] h-[18px] rounded-full bg-[#3FB950] items-center justify-center">
                    <Text style={{color: '#FFFFFF', fontSize: 11, fontFamily: FONTS.sansBold, lineHeight: 13}}>
                      ✓
                    </Text>
                  </View>
                </View>
                <Text style={{marginTop: 8, fontFamily: FONTS.sansSemiBold, fontSize: 12, color: '#FFFFFF'}} numberOfLines={1}>
                  {stamp.place_name}
                </Text>
                {stamp.built_year != null ? (
                  <Text style={{marginTop: 2, fontFamily: FONTS.sans, fontSize: 10, color: 'rgba(255,255,255,0.55)'}}>
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
                className="pt-2 px-2 pb-[10px] rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)]"
                style={{width: tileWidth}}
                accessibilityLabel={`Locked: ${site.place_name}`}>
                <View className="h-[62px] rounded-lg overflow-hidden bg-[rgba(255,255,255,0.04)] items-center justify-center">
                  <Lock color="rgba(255,255,255,0.55)" size={22} />
                </View>
                <Text style={{marginTop: 8, fontFamily: FONTS.sansMedium, fontSize: 12, color: 'rgba(255,255,255,0.55)'}}>
                  Locked
                </Text>
                <Text style={{marginTop: 2, fontFamily: FONTS.sans, fontSize: 10, color: 'rgba(255,255,255,0.35)'}}>
                  {site.hint ?? 'unvisited'}
                </Text>
              </View>
            ))}
          </View>

          {/* Empty state */}
          {stamps.length === 0 && lockedSites.length === 0 ? (
            <View className="mt-[60px] px-8 items-center">
              <Text style={{fontFamily: FONTS.sansSemiBold, fontSize: 16, color: '#FFFFFF'}}>
                No stamps yet
              </Text>
              <Text style={{marginTop: 8, textAlign: 'center', fontFamily: FONTS.sans, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 18}}>
                Visit a heritage site and your first stamp will appear here.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
};

export default Passport;
