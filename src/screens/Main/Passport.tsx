import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {Check, ChevronRight, Compass, Lock, Share2, Sparkles} from 'lucide-react-native';
import {COLORS, FONTS} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import BadgeGrid from '../../components/ui/BadgeGrid';
import LevelUpCelebration from '../../components/ui/LevelUpCelebration';
import XPGainToast from '../../components/ui/XPGainToast';
import {
  earnedCount,
  resolveBadges,
  resolveLevelProgress,
  resolveXp,
  type ServerProgress,
} from '../../shared/utils/achievements';
import {usePassportSummary, usePassportStamps} from '../../shared/hooks';
import type {LockedSite, PassportStamp} from '../../utils/api/passport';
import type {ExplorerPass} from '../../utils/api/explorer-pass/types';
import type {TabScreenProps} from '../../core/types/navigation.types';

type Props = TabScreenProps<'Passport'>;

// Deeper gold for the rank hero card (light champagne reads poorly under white
// text); the standard GOLD_GRADIENT stays for buttons/bars.
const HERO_GRADIENT = ['#D8B978', '#CBA862', '#9C7B3A'];
const HERO_TEXT = '#FBF6EC';
const HERO_SUBTLE = 'rgba(255,255,255,0.85)';

function formatPassExpiry(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return 'expired';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

const HeroStat: React.FC<{value: number; label: string}> = ({value, label}) => (
  <View className="items-center">
    <Text style={{fontFamily: FONTS.display, color: HERO_TEXT}} className="text-2xl leading-none">
      {value}
    </Text>
    <Text style={{fontFamily: FONTS.uiMedium, color: HERO_SUBTLE}} className="text-[11px] mt-1">
      {label}
    </Text>
  </View>
);

const Passport: React.FC<Props> = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const {summary, refresh: refreshSummary} = usePassportSummary();
  const {stamps, lockedSites, refresh: refreshStamps} = usePassportStamps();
  const [refreshing, setRefreshing] = useState(false);

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
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {site: {id: firstId, name: ''}});
    },
    [navigation],
  );

  const onBuyPassport = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.PURCHASE);
  }, [navigation]);

  const streakDays = summary?.streak_days ?? 0;
  const sitesVisited = summary?.sites_visited ?? 0;
  const dynastiesCount = summary?.dynasties_count ?? 0;
  const activePasses = summary?.active_passes ?? [];

  const serverProgress: ServerProgress | undefined = summary
    ? {
        xp: summary.xp,
        level: summary.level,
        rankTitle: summary.rank_title,
        xpIntoLevel: summary.xp_into_level,
        xpForLevel: summary.xp_for_level,
      }
    : undefined;

  const badges = useMemo(
    () =>
      resolveBadges({sitesVisited, streakDays, dynasties: dynastiesCount}, summary?.badges),
    [sitesVisited, streakDays, dynastiesCount, summary?.badges],
  );
  const progress = resolveLevelProgress(sitesVisited, serverProgress);

  // Gamification triggers: detect XP gains and rank-ups across data refreshes.
  const [levelUp, setLevelUp] = useState<{level: number; title: string; xpEarned: number} | null>(
    null,
  );
  const [xpGain, setXpGain] = useState(0);
  const [xpVisible, setXpVisible] = useState(false);
  const prevRef = useRef<{level: number; xp: number} | null>(null);

  useEffect(() => {
    const xp = resolveXp({sitesVisited, streakDays, dynasties: dynastiesCount}, summary?.xp);
    const lp = resolveLevelProgress(sitesVisited, {
      level: summary?.level,
      rankTitle: summary?.rank_title,
      xpIntoLevel: summary?.xp_into_level,
      xpForLevel: summary?.xp_for_level,
    });
    const prev = prevRef.current;
    if (prev) {
      const delta = xp - prev.xp;
      if (lp.level > prev.level) {
        setLevelUp({level: lp.level, title: lp.title, xpEarned: Math.max(delta, 0)});
      } else if (delta > 0) {
        setXpGain(delta);
        setXpVisible(true);
      }
    }
    prevRef.current = {level: lp.level, xp};
  }, [
    sitesVisited,
    streakDays,
    dynastiesCount,
    summary?.xp,
    summary?.level,
    summary?.rank_title,
    summary?.xp_into_level,
    summary?.xp_for_level,
  ]);

  const stampCount = stamps.length;

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} className="bg-background" />

      <View
        pointerEvents="box-none"
        style={{position: 'absolute', top: insets.top + 8, left: 0, right: 0, zIndex: 50}}>
        <XPGainToast amount={xpGain} visible={xpVisible} onDone={() => setXpVisible(false)} />
      </View>
      <LevelUpCelebration
        visible={!!levelUp}
        level={levelUp?.level ?? 1}
        title={levelUp?.title ?? ''}
        message={`You've explored ${sitesVisited} heritage sites and earned your place among the keepers of history.`}
        xpEarned={levelUp?.xpEarned}
        perks={2}
        onClose={() => setLevelUp(null)}
      />

      <ScrollView
        contentContainerStyle={{paddingBottom: 120}}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} colors={[COLORS.gold]} />
        }>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-3 pb-5">
          <Text style={{fontFamily: FONTS.display}} className="text-[28px] text-foreground tracking-tight">
            Passport
          </Text>
          <View className="w-10 h-10 rounded-full border border-white/10 bg-card items-center justify-center">
            <Share2 color={COLORS.textPrimary} size={18} />
          </View>
        </View>

        {/* Rank hero card */}
        <LinearGradient
          colors={HERO_GRADIENT}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={{marginHorizontal: 20, borderRadius: 28, padding: 24}}>
          <View className="flex-row items-center mb-6" style={{gap: 16}}>
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{backgroundColor: 'rgba(10,10,12,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)'}}>
              <Compass color={HERO_TEXT} size={32} />
            </View>
            <View className="flex-1">
              <Text
                style={{fontFamily: FONTS.uiSemiBold, color: HERO_SUBTLE}}
                className="text-[11px] tracking-[0.22em] uppercase">
                Level {progress.level}
              </Text>
              <Text style={{fontFamily: FONTS.display, color: HERO_TEXT}} className="text-3xl leading-tight">
                {progress.title}
              </Text>
              <Text style={{fontFamily: FONTS.ui, color: HERO_SUBTLE}} className="text-xs mt-1">
                {progress.isMax ? 'Top rank reached' : `${progress.xpToNext} XP to ${progress.nextTitle}`}
              </Text>
            </View>
          </View>

          <View className="h-3 rounded-full overflow-hidden mb-5" style={{backgroundColor: 'rgba(10,10,12,0.22)'}}>
            <View
              style={{
                width: `${Math.round(progress.ratio * 100)}%`,
                height: '100%',
                backgroundColor: HERO_TEXT,
                borderRadius: 999,
              }}
            />
          </View>

          <View className="flex-row items-center justify-between">
            <HeroStat value={sitesVisited} label="Sites" />
            <View style={{width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)'}} />
            <HeroStat value={streakDays} label="Day streak" />
            <View style={{width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)'}} />
            <HeroStat value={dynastiesCount} label="Dynasties" />
          </View>
        </LinearGradient>

        {/* Passport CTA / active passes */}
        {activePasses.length === 0 ? (
          <Pressable
            onPress={onBuyPassport}
            style={({pressed}) => (pressed ? {opacity: 0.9} : undefined)}
            className="mx-5 mt-5 flex-row items-center gap-3 rounded-2xl border border-white/10 bg-card p-4"
            accessibilityRole="button"
            accessibilityLabel="Get your Passport">
            <View
              className="w-11 h-11 rounded-2xl items-center justify-center"
              style={{backgroundColor: 'rgba(203,168,98,0.15)'}}>
              <Sparkles color={COLORS.gold} size={22} />
            </View>
            <View className="flex-1">
              <Text style={{fontFamily: FONTS.uiSemiBold}} className="text-base text-foreground">
                Get your Passport
              </Text>
              <Text style={{fontFamily: FONTS.ui}} className="text-xs text-muted-foreground mt-0.5">
                Unlock heritage sites near you
              </Text>
            </View>
            <ChevronRight color={COLORS.gold} size={20} />
          </Pressable>
        ) : (
          <View className="mt-6">
            <Text
              style={{fontFamily: FONTS.uiSemiBold}}
              className="px-6 text-[11px] tracking-[0.16em] text-muted-foreground uppercase mb-3">
              Active passes
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{paddingHorizontal: 20, gap: 10}}>
              {activePasses.map(pass => (
                <Pressable
                  key={pass.id}
                  onPress={() => onPassPress(pass)}
                  style={({pressed}) => (pressed ? {opacity: 0.85} : undefined)}
                  className="rounded-2xl border border-primary/30 bg-card px-4 py-3 min-w-[140px]"
                  accessibilityRole="button">
                  <Text style={{fontFamily: FONTS.uiMedium}} className="text-sm text-foreground" numberOfLines={1}>
                    {pass.place_count} place{pass.place_count === 1 ? '' : 's'}
                  </Text>
                  <Text style={{fontFamily: FONTS.ui}} className="text-xs text-primary mt-0.5">
                    {formatPassExpiry(pass.expires_at)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Achievements */}
        <View className="px-6 mt-8 mb-5 flex-row items-baseline justify-between">
          <Text style={{fontFamily: FONTS.display}} className="text-2xl text-foreground tracking-tight">
            Achievements
          </Text>
          <Text style={{fontFamily: FONTS.uiMedium}} className="text-[11px] tracking-[0.12em] text-primary uppercase">
            {earnedCount(badges)} of {badges.length}
          </Text>
        </View>
        <View className="px-6">
          <BadgeGrid badges={badges} />
        </View>

        {/* Stamps */}
        <View className="px-6 mt-9 mb-4 flex-row items-baseline justify-between">
          <Text style={{fontFamily: FONTS.display}} className="text-2xl text-foreground tracking-tight">
            Stamps
          </Text>
          <Text style={{fontFamily: FONTS.uiMedium}} className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            {stampCount} collected
          </Text>
        </View>

        <View className="flex-row flex-wrap px-4">
          {stamps.map(stamp => (
            <View key={stamp.place_id} className="w-1/3 p-2">
              <Pressable
                onPress={() => onStampPress(stamp)}
                style={({pressed}) => (pressed ? {opacity: 0.85} : undefined)}
                accessibilityRole="button"
                accessibilityLabel={`${stamp.place_name} stamp`}>
                <View className="relative w-full h-24 rounded-2xl overflow-hidden border border-white/10">
                  {stamp.image_url ? (
                    <Image source={{uri: stamp.image_url}} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <View className="w-full h-full" style={{backgroundColor: 'rgba(203,168,98,0.18)'}} />
                  )}
                  <View className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-primary items-center justify-center">
                    <Check color={COLORS.bg} size={14} />
                  </View>
                </View>
                <Text
                  style={{fontFamily: FONTS.uiMedium}}
                  className="text-[11px] text-foreground mt-2 text-center"
                  numberOfLines={1}>
                  {stamp.place_name}
                </Text>
              </Pressable>
            </View>
          ))}

          {lockedSites.map((site: LockedSite) => (
            <View key={`locked-${site.place_id}`} className="w-1/3 p-2">
              <View className="w-full h-24 rounded-2xl border border-dashed border-white/[0.12] bg-card items-center justify-center">
                <Lock color={COLORS.textTertiary} size={22} />
              </View>
              <Text
                style={{fontFamily: FONTS.uiMedium}}
                className="text-[11px] text-muted-foreground mt-2 text-center"
                numberOfLines={1}>
                {site.hint ?? 'Locked'}
              </Text>
            </View>
          ))}
        </View>

        {stamps.length === 0 && lockedSites.length === 0 ? (
          <View className="mt-14 px-8 items-center">
            <Text style={{fontFamily: FONTS.display}} className="text-2xl text-foreground text-center">
              No stamps yet
            </Text>
            <Text
              style={{fontFamily: FONTS.ui}}
              className="text-sm text-muted-foreground text-center mt-2 leading-5">
              Visit a heritage site and your first stamp will appear here.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default Passport;
