import {
  StatusBar,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ScrollView,
  InteractionManager,
} from 'react-native';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  withSpring,
  FadeInDown,
  interpolate,
} from 'react-native-reanimated';
import {
  Bell,
  MapPin,
  ArrowRight,
  X,
  Sparkles,
  Compass,
  RefreshCw,
  ScanEye,
} from 'lucide-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import ThinkingDots from '../../components/ui/ThinkingDots';
import ResolvedSubjectImage from '../../components/ui/ResolvedSubjectImage';
import { usePlaces } from '../../context';
import { useUser } from '../../context';
import type { TabScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants';
import type { Place } from '../../utils/api/places/types';
import {
  getPersonalizedFacts,
  elaboratePersonalizedFact,
} from '../../utils/api/user';
import type { PersonalizedFact } from '../../utils/api/user';
import { getRecommendations } from '../../utils/api/recommendations';
import type { Recommendation } from '../../utils/api/recommendations';
import { buildSiteDetailData } from '../../shared/utils';
import { placeTypeLabel } from '../../utils/places/placeTypeLabel';
import { useExplorerPass } from '../../shared/hooks';
import ExplorerPassPopup from '../../components/ExplorerPassPopup';
import OnboardingTooltips from '../../components/OnboardingTooltips';

const FACT_LOADING_LINES = [
  'Tracing your heritage...',
  'Weaving nearby context...',
  'Preparing your insights...',
  'Connecting the threads...',
  'Reading the monuments...',
];

const NOIR = {
  bg: '#000000',
  cardBg: '#0A0A0A',
  cardBorder: 'rgba(212, 134, 10, 0.12)',
  glowAmber: 'rgba(212, 134, 10, 0.08)',
  amber: '#D4860A',
  gold: '#C9A84C',
  warmWhite: '#F5F0E8',
} as const;

function buildFallbackFacts(
  userName: string,
  places: Place[],
): PersonalizedFact[] {
  const nearest = places[0];
  const nearestName = nearest?.name ?? 'your nearby monument';
  const firstCategory = nearest?.categories[0] ?? 'heritage';

  return [
    {
      id: 'fallback-1',
      headline: 'Your route holds hidden layers',
      summary: `${userName}, ${nearestName} is linked to lesser-known ${firstCategory.toLowerCase()} traditions that shifted over generations.`,
      detail: `${nearestName} carries traces of daily rituals and civic memory that most visitors walk past. Look closely at the layout and ornament — the stories are already there.`,
    },
    {
      id: 'fallback-2',
      headline: 'Architecture reveals social memory',
      summary:
        'Many preserved sites encode daily rituals, trade patterns, and migration stories in plain sight through layout and ornament.',
      detail:
        'The placement of doorways, the height of columns, the orientation of courtyards — each was a deliberate choice that reflected the values and relationships of its builders.',
    },
    {
      id: 'fallback-3',
      headline: 'Monuments were living spaces',
      summary:
        'Historical sites were active civic hubs, not static relics; ceremonies, decisions, and storytelling happened there regularly.',
      detail:
        'Pull up any of the nearby sites and you can start to trace those threads — the overlapping eras, the repurposed walls, the names that stuck even as the original meaning faded.',
    },
  ];
}

type Props = TabScreenProps<'Home'>;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface PlaceCardProps {
  place: Place;
  index: number;
  onPress: (place: Place) => void;
}

const PlaceCard: React.FC<PlaceCardProps> = React.memo(({ place, index, onPress }) => {
  const scale = useSharedValue(1);
  const distanceKm = (place.distance_meters / 1000).toFixed(1);
  const friendlyTag = placeTypeLabel(place.place_type, place.categories);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(500)}>
      <AnimatedTouchable
        style={[cardStyles.container, animatedCardStyle]}
        onPress={() => onPress(place)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`Visit ${place.name}, ${distanceKm} km away`}
        accessibilityHint="Opens the site details screen"
      >
        <LinearGradient
          colors={['#120E08', '#0A0806', '#120E08']}
          locations={[0, 0.5, 1]}
          style={cardStyles.gradient}
        >
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1 rounded-full bg-brand-amber/15 border border-brand-amber/30 px-2.5 py-1">
              <Sparkles color="#D4860A" size={11} />
              <Text className="text-brand-amber text-[10px] uppercase tracking-[0.6px] font-['MontserratAlternates-SemiBold']">
                {friendlyTag}
              </Text>
            </View>
            <View className="flex-row items-center gap-1 rounded-full bg-[rgba(10,10,10,0.7)] border border-[rgba(201,168,76,0.35)] px-2.5 py-1">
              <Compass color="#C9A84C" size={11} />
              <Text className="text-parchment text-[10px] leading-4 font-['MontserratAlternates-SemiBold']">
                {distanceKm} km
              </Text>
            </View>
          </View>

          <View>
            <Text
              className="text-parchment text-[22px] leading-7 font-['MontserratAlternates-Bold']"
              numberOfLines={3}
            >
              {place.name}
            </Text>
            <View className="flex-row items-center gap-1 mt-2">
              <MapPin color="#B8AF9E" size={14} />
              <Text
                className="text-parchment-muted text-[13px] leading-[18px] font-['MontserratAlternates-Medium'] flex-shrink"
                numberOfLines={1}
              >
                {place.city}, {place.country}
              </Text>
            </View>

            <View className="mt-4 self-start flex-row items-center gap-1 rounded-full bg-brand-gold px-3 py-2">
              <Text className="text-ink text-xs leading-4 uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold']">
                Explore the Era
              </Text>
              <ArrowRight color="#0A0A0A" size={14} />
            </View>
          </View>
        </LinearGradient>
      </AnimatedTouchable>
    </Animated.View>
  );
});

PlaceCard.displayName = 'PlaceCard';

const SkeletonCard: React.FC = () => {
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <Animated.View style={[skeletonStyles.card, animatedStyle]}>
      <View style={skeletonStyles.pill} />
      <View style={skeletonStyles.title} />
      <View style={skeletonStyles.line} />
      <View style={[skeletonStyles.line, skeletonStyles.lineShort]} />
      <View style={skeletonStyles.cta} />
    </Animated.View>
  );
};

const Home = ({ navigation }: Props) => {
  const nearbyPlaces = usePlaces(state => state.nearbyPlaces);
  const isLoadingNearby = usePlaces(state => state.isLoadingNearby);
  const nearbyError = usePlaces(state => state.nearbyError);
  const ensureLocationTracking = usePlaces(state => state.ensureLocationTracking);
  const currentLocation = usePlaces(state => state.currentLocation);
  const profile = useUser(state => state.profile);

  const [factsVisible, setFactsVisible] = useState(true);
  const [isLoadingFacts, setIsLoadingFacts] = useState(true);
  const [factsError, setFactsError] = useState<string | null>(null);
  const [facts, setFacts] = useState<PersonalizedFact[]>([]);
  const [activeFactId, setActiveFactId] = useState<string | null>(null);
  const [elaboratingFactId, setElaboratingFactId] = useState<string | null>(
    null,
  );
  const [factDetailsById, setFactDetailsById] = useState<
    Record<string, string>
  >({});
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
  const { hasAnyActivePass, loading: explorerPassLoading } = useExplorerPass();

  const entrance = useSharedValue(24);
  const contentOpacity = useSharedValue(0);
  const lensFabScale = useSharedValue(1);
  const passBorderPulse = useSharedValue(0);
  const fabRingScale = useSharedValue(1);
  const fabRingOpacity = useSharedValue(0.3);
  const refreshRotation = useSharedValue(0);

  useEffect(() => {
    entrance.value = withSpring(0, { damping: 20, stiffness: 200 });
    contentOpacity.value = withTiming(1, { duration: 400 });
    passBorderPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000 }),
        withTiming(0, { duration: 2000 }),
      ),
      -1,
    );
    fabRingScale.value = withRepeat(
      withTiming(1.3, { duration: 1500, easing: Easing.out(Easing.quad) }),
      -1,
    );
    fabRingOpacity.value = withRepeat(
      withTiming(0, { duration: 1500, easing: Easing.out(Easing.quad) }),
      -1,
    );
  }, [contentOpacity, entrance, passBorderPulse, fabRingScale, fabRingOpacity]);

  useEffect(() => {
    void ensureLocationTracking();
  }, [ensureLocationTracking]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: entrance.value }],
  }));

  const lensFabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lensFabScale.value }],
  }));

  const passBorderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(212, 134, 10, ${interpolate(passBorderPulse.value, [0, 1], [0.15, 0.5])})`,
  }));

  const fabRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabRingScale.value }],
    opacity: fabRingOpacity.value,
  }));

  const refreshIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${refreshRotation.value}deg` }],
  }));

  const handleLensPressIn = () => {
    lensFabScale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
  };

  const handleLensPressOut = () => {
    lensFabScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handleOpenLens = useCallback(() => {
    try {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    } catch {
      // Haptics are best-effort.
    }
    navigation.navigate(ROUTES.MAIN.LENS);
  }, [navigation]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userName = profile?.name || 'Explorer';
  const topNearbyPlaces = useMemo(
    () => (nearbyPlaces || []).slice(0, 20),
    [nearbyPlaces],
  );
  const handleVisitPlace = useCallback(
    (place: Place) => {
      navigation.navigate('SiteDetail', {
        site: buildSiteDetailData(place),
      });
    },
    [navigation],
  );

  const loadPersonalizedFacts = useCallback(async () => {
    setIsLoadingFacts(true);
    setFactsError(null);

    const result = await getPersonalizedFacts({
      limit: 3,
      userName,
      nearbyPlaces: topNearbyPlaces.slice(0, 3).map(place => place.name),
      regionHint: topNearbyPlaces[0]?.country,
    });

    if (result.success && result.data.facts?.length > 0) {
      setFacts(result.data.facts.slice(0, 3));
      setFactDetailsById({});
      setActiveFactId(null);
      setIsLoadingFacts(false);
      return;
    }

    setFacts(buildFallbackFacts(userName, topNearbyPlaces));
    setFactsError(
      result.success
        ? 'Showing curated insights for now.'
        : 'Showing curated insights for your area.',
    );
    setFactDetailsById({});
    setActiveFactId(null);
    setIsLoadingFacts(false);
  }, [topNearbyPlaces, userName]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void loadPersonalizedFacts();
    });

    return () => {
      task.cancel();
    };
  }, [loadPersonalizedFacts]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsLoadingRecommendations(true);
      getRecommendations({
        limit: 8,
        lat: currentLocation?.latitude,
        lon: currentLocation?.longitude,
      }).then(result => {
        if (result.success) {
          setRecommendations(result.data.items ?? []);
        }
        setIsLoadingRecommendations(false);
      });
    });

    return () => {
      task.cancel();
    };
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  const handleFactPress = useCallback(
    async (fact: PersonalizedFact) => {
      const isExpanded = activeFactId === fact.id;
      if (isExpanded) {
        setActiveFactId(null);
        return;
      }

      setActiveFactId(fact.id);

      const existingDetail = factDetailsById[fact.id] ?? fact.detail;
      if (existingDetail) {
        if (!factDetailsById[fact.id]) {
          setFactDetailsById(prev => ({ ...prev, [fact.id]: existingDetail }));
        }
        return;
      }

      setElaboratingFactId(fact.id);
      const result = await elaboratePersonalizedFact({
        factId: fact.id,
        headline: fact.headline,
        summary: fact.summary,
        userName,
        nearbyPlaceName: topNearbyPlaces[0]?.name,
      });
      setElaboratingFactId(null);

      if (result.success) {
        setFactDetailsById(prev => ({
          ...prev,
          [fact.id]: result.data.detail,
        }));
        return;
      }

      setFactDetailsById(prev => ({
        ...prev,
        [fact.id]: `${fact.summary} This connects to ${
          topNearbyPlaces[0]?.name ?? 'nearby heritage sites'
        } through shared routes, ritual patterns, and artisan exchange across generations.`,
      }));
    },
    [activeFactId, factDetailsById, topNearbyPlaces, userName],
  );

  const renderPlaceItem = useCallback(
    ({ item, index }: { item: Place; index: number }) => (
      <PlaceCard place={item} index={index} onPress={handleVisitPlace} />
    ),
    [handleVisitPlace],
  );

  return (
    <SafeAreaView className="flex-1 bg-ink-deep">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#000000', '#0A0806', '#000000']}
        locations={[0, 0.5, 1]}
        style={{ flex: 1 }}
      >
        <Animated.View style={[{ flex: 1 }, entranceStyle]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 120,
            }}
          >
            {/* Header */}
            <View
              className="flex-row items-center justify-between mb-6"
              accessibilityRole="header"
            >
              <View className="flex-1 pr-4" style={{ position: 'relative' }}>
                <View
                  style={{
                    position: 'absolute',
                    top: -20,
                    left: -30,
                    width: 160,
                    height: 100,
                    borderRadius: 80,
                    backgroundColor: NOIR.glowAmber,
                  }}
                />
                <Text className="text-parchment-muted text-xs uppercase tracking-[1px] font-['MontserratAlternates-SemiBold']">
                  {greeting}
                </Text>
                <Text className="text-parchment text-[32px] leading-10 font-['MontserratAlternates-Bold'] mt-1">
                  {userName}
                </Text>
                <Text className="text-parchment-muted text-[15px] leading-[22px] font-['MontserratAlternates-Medium'] mt-1">
                  Ready to uncover history today?
                </Text>
              </View>
              <TouchableOpacity
                className="w-11 h-11 rounded-xl items-center justify-center"
                style={{
                  borderWidth: 1,
                  borderColor: NOIR.cardBorder,
                  backgroundColor: NOIR.cardBg,
                }}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                accessibilityHint="Opens your notification centre"
              >
                <Bell color="#F5F0E8" size={20} />
              </TouchableOpacity>
            </View>

            {/* Nearby Highlights */}
            <View style={{ height: 1, backgroundColor: 'rgba(201,168,76,0.15)', marginBottom: 20 }} />
            <View className="mb-4">
              <View className="flex-row items-center gap-2">
                <Sparkles color="#C9A84C" size={18} />
                <Text className="text-parchment text-[22px] leading-[30px] font-['MontserratAlternates-SemiBold']">
                  Nearby Highlights
                </Text>
              </View>
              <Text className="text-parchment-dim text-[13px] leading-[18px] font-['MontserratAlternates-Regular'] mt-1">
                Curated sites around your location
              </Text>
              {nearbyError ? (
                <Text className="text-status-warning text-[13px] leading-[18px] font-['MontserratAlternates-Medium'] mt-2">
                  {nearbyError}
                </Text>
              ) : null}
            </View>

            {isLoadingNearby ? (
              <View className="flex-row gap-3 mb-4">
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ) : topNearbyPlaces.length === 0 ? (
              <View className="mb-4 rounded-[20px] bg-surface-1 border border-[rgba(255,255,255,0.08)] py-7 px-5 items-center justify-center gap-2">
                <MapPin color="#C9A84C" size={36} />
                <Text className="text-parchment text-lg leading-6 text-center font-['MontserratAlternates-SemiBold']">
                  No monuments discovered nearby yet
                </Text>
                <Text className="text-parchment-muted text-sm leading-5 text-center font-['MontserratAlternates-Regular']">
                  Try moving to a nearby heritage district or check location
                  permissions.
                </Text>
              </View>
            ) : (
              <FlatList
                horizontal
                data={topNearbyPlaces}
                renderItem={renderPlaceItem}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                initialNumToRender={4}
                maxToRenderPerBatch={3}
                windowSize={5}
                contentContainerStyle={{ paddingRight: 8, paddingBottom: 8 }}
              />
            )}

            {/* Explorer Pass banner */}
            {!explorerPassLoading && !hasAnyActivePass && (
              <Animated.View
                entering={FadeInDown.delay(200).duration(500)}
                style={[{ marginTop: 24, borderRadius: 20, overflow: 'hidden', borderWidth: 1 }, passBorderStyle]}
              >
                <TouchableOpacity
                  onPress={() => navigation.navigate(ROUTES.MAIN.PURCHASE)}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Get Explorer Pass"
                >
                  <LinearGradient
                    colors={['#0A0A0A', '#1A1206', '#0A0A0A']}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: 18 }}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="w-12 h-12 rounded-full bg-brand-amber/15 items-center justify-center">
                        <Sparkles color="#D4860A" size={22} />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-0.5">
                          <Text className="text-brand-amber text-[10px] uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold']">
                            Explorer Pass
                          </Text>
                          <View style={{ backgroundColor: '#D4860A', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                            <Text className="text-ink-deep text-[8px] uppercase tracking-[0.5px] font-['MontserratAlternates-Bold']">
                              PREMIUM
                            </Text>
                          </View>
                        </View>
                        <Text className="text-parchment text-base font-['MontserratAlternates-Bold'] mt-0.5">
                          Unlock heritage sites near you
                        </Text>
                        <Text className="text-parchment-muted text-xs font-['MontserratAlternates-Regular'] mt-0.5">
                          Tap to choose places
                        </Text>
                      </View>
                      <ArrowRight color="#D4860A" size={20} />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Recommended for you */}
            {(isLoadingRecommendations || recommendations.length > 0) && (
              <View className="mt-6 mb-2">
                <View className="flex-row items-center gap-2 mb-3">
                  <Compass color="#C9A84C" size={18} />
                  <Text className="text-parchment text-[22px] leading-[30px] font-['MontserratAlternates-SemiBold']">
                    Recommended for you
                  </Text>
                </View>
                {isLoadingRecommendations ? (
                  <View className="flex-row gap-3">
                    <SkeletonCard />
                    <SkeletonCard />
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12, paddingRight: 8, paddingBottom: 4 }}
                  >
                    {recommendations.map((rec, recIndex) => (
                      <Animated.View
                        key={rec.monument_id}
                        entering={FadeInDown.delay(recIndex * 60).duration(400)}
                      >
                        <TouchableOpacity
                          onPress={() =>
                            navigation.navigate('SiteDetail', {
                              site: {
                                id: rec.monument_id,
                                name: rec.name,
                                city: rec.city,
                                country: rec.country,
                                lat: rec.latitude,
                                lon: rec.longitude,
                                formatted: [rec.city, rec.state, rec.country]
                                  .filter(Boolean)
                                  .join(', '),
                              },
                            })
                          }
                          className="w-48 rounded-[16px] p-3"
                          style={{
                            backgroundColor: NOIR.cardBg,
                            borderWidth: 1,
                            borderColor: NOIR.cardBorder,
                          }}
                          activeOpacity={0.85}
                        >
                          <Text
                            className="text-brand-amber text-[10px] uppercase tracking-[0.6px] font-['MontserratAlternates-SemiBold'] mb-1"
                            numberOfLines={1}
                          >
                            {rec.state || rec.country || 'Heritage'}
                          </Text>
                          <Text
                            className="text-parchment text-sm font-['MontserratAlternates-Bold'] leading-5 mb-2"
                            numberOfLines={2}
                          >
                            {rec.name}
                          </Text>
                          <Text
                            className="text-parchment-dim text-[11px] font-['MontserratAlternates-Regular']"
                            numberOfLines={1}
                          >
                            {rec.reason}
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Insights */}
            {factsVisible && (
              <View className="mt-6 mb-3">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-parchment text-lg leading-6 font-['MontserratAlternates-SemiBold']">
                    Insights For You
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFactsVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss insights"
                  >
                    <X color="#6B6357" size={20} />
                  </TouchableOpacity>
                </View>

                {isLoadingFacts ? (
                  <View
                    className="items-center py-6 gap-4 rounded-[20px]"
                    style={{ backgroundColor: NOIR.cardBg, borderWidth: 1, borderColor: NOIR.cardBorder }}
                  >
                    <AnimatedLogo size={58} motion="orbit" variant="white" />
                    <ThinkingDots messages={FACT_LOADING_LINES} />
                    <Text className="text-parchment-muted text-xs leading-[18px] text-center font-['MontserratAlternates-Regular']">
                      Preparing expandable details you can tap into.
                    </Text>
                  </View>
                ) : (
                  <View className="gap-3">
                    {factsError ? (
                      <Text className="text-parchment-faint text-[11px] leading-4 mb-0.5 font-['MontserratAlternates-Regular']">
                        {factsError}
                      </Text>
                    ) : null}

                    {facts.map((fact, factIndex) => {
                      const isExpanded = activeFactId === fact.id;
                      const isElaborating = elaboratingFactId === fact.id;
                      const detailText =
                        factDetailsById[fact.id] ?? fact.detail;
                      const factMonument = fact.monument || topNearbyPlaces[factIndex]?.name;

                      return (
                        <Animated.View
                          key={fact.id}
                          entering={FadeInDown.delay(factIndex * 100).duration(400)}
                        >
                          <TouchableOpacity
                            className="rounded-2xl p-3.5"
                            style={[
                              {
                                backgroundColor: NOIR.cardBg,
                                borderWidth: 1,
                                borderColor: isExpanded ? 'rgba(212, 134, 10, 0.3)' : NOIR.cardBorder,
                              },
                              isExpanded && {
                                shadowColor: '#D4860A',
                                shadowOpacity: 0.12,
                                shadowRadius: 16,
                                shadowOffset: { width: 0, height: 4 },
                                elevation: 8,
                              },
                            ]}
                            onPress={() => {
                              handleFactPress(fact).catch(() => {
                                setFactDetailsById(prev => ({
                                  ...prev,
                                  [fact.id]: `${fact.summary} This connects to ${
                                    topNearbyPlaces[0]?.name ??
                                    'nearby heritage sites'
                                  } through shared routes, ritual patterns, and artisan exchange across generations.`,
                                }));
                              });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Open insight ${factIndex + 1}`}
                            accessibilityHint="Shows a detailed explanation"
                          >
                            <View className="flex-row items-start gap-3">
                              {factMonument ? (
                                <ResolvedSubjectImage
                                  subject={factMonument}
                                  context="insight card"
                                  style={{ width: 72, height: 72, borderRadius: 14 }}
                                  imageStyle={{ borderRadius: 14 }}
                                />
                              ) : (
                                <View
                                  style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: 14,
                                    backgroundColor: 'rgba(212,134,10,0.1)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Sparkles color="#D4860A" size={24} />
                                </View>
                              )}
                              <View className="flex-1">
                                <Text className="text-parchment text-sm leading-5 font-['MontserratAlternates-SemiBold']">
                                  {fact.headline}
                                </Text>
                                <Text
                                  className="text-parchment-muted text-[13px] leading-[19px] mt-1 font-['MontserratAlternates-Regular']"
                                  numberOfLines={isExpanded ? undefined : 2}
                                >
                                  {fact.summary}
                                </Text>
                              </View>
                            </View>

                            {isExpanded ? (
                              <View className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                                {isElaborating ? (
                                  <ThinkingDots
                                    messages={['Expanding this insight...']}
                                    color="#B8AF9E"
                                  />
                                ) : detailText ? (
                                  <Text className="text-brand-goldSoft text-[13px] leading-5 font-['MontserratAlternates-Regular']">
                                    {detailText}
                                  </Text>
                                ) : null}
                              </View>
                            ) : null}

                            <Text className="mt-2 text-parchment-faint text-[10px] leading-[14px] uppercase tracking-[0.7px] font-['MontserratAlternates-SemiBold']">
                              {isExpanded ? 'Tap to collapse' : 'Tap to expand'}
                            </Text>
                          </TouchableOpacity>
                        </Animated.View>
                      );
                    })}

                    <TouchableOpacity
                      onPress={() => {
                        refreshRotation.value = withSequence(
                          withTiming(360, { duration: 600 }),
                          withTiming(0, { duration: 0 }),
                        );
                        loadPersonalizedFacts().catch(() => {
                          setFacts(
                            buildFallbackFacts(userName, topNearbyPlaces),
                          );
                          setFactsError(
                            'Showing curated insights for your area.',
                          );
                          setIsLoadingFacts(false);
                        });
                      }}
                      className="mt-2 flex-row items-center self-end gap-1"
                      accessibilityRole="button"
                      accessibilityLabel="Refresh insights"
                    >
                      <Text className="text-brand-gold text-xs leading-4 uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold']">
                        Refresh Insights
                      </Text>
                      <Animated.View style={refreshIconStyle}>
                        <RefreshCw color="#C9A84C" size={16} />
                      </Animated.View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>

        <View style={fabStyle.fabContainer}>
          <Animated.View
            style={[fabStyle.fabRing, fabRingStyle]}
          />
          <AnimatedTouchable
            style={[fabStyle.fab, lensFabStyle]}
            onPress={handleOpenLens}
            onPressIn={handleLensPressIn}
            onPressOut={handleLensPressOut}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Open Lens"
            accessibilityHint="Opens the Lens camera to detect nearby monuments"
          >
            <ScanEye color="#0A0A0A" size={24} />
          </AnimatedTouchable>
        </View>
      </LinearGradient>

      {/* Explorer Pass upsell popup (once per session if no active pass) */}
      <ExplorerPassPopup
        hasActivePass={hasAnyActivePass}
        onGetPass={() => navigation.navigate(ROUTES.MAIN.PURCHASE)}
      />

      {/* First-launch feature walkthrough */}
      <OnboardingTooltips />
    </SafeAreaView>
  );
};

// Only styles that cannot be expressed as className (animated views, image masks, FAB position)
const cardStyles = {
  container: {
    width: 238,
    height: 232,
    marginRight: 16,
  },
  gradient: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: NOIR.cardBorder,
    padding: 16,
    justifyContent: 'space-between' as const,
    shadowColor: '#D4860A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
};

const skeletonStyles = {
  card: {
    width: 210,
    height: 248,
    borderRadius: 16,
    backgroundColor: NOIR.cardBg,
    borderWidth: 1,
    borderColor: NOIR.cardBorder,
    padding: 16,
    justifyContent: 'flex-end' as const,
  },
  pill: {
    width: 86,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  title: {
    width: '75%' as const,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginBottom: 8,
  },
  line: {
    width: '100%' as const,
    height: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 8,
  },
  lineShort: {
    width: '64%' as const,
  },
  cta: {
    marginTop: 8,
    width: 124,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(201,168,76,0.25)',
  },
};

const fabStyle = {
  fabContainer: {
    position: 'absolute' as const,
    right: 20,
    bottom: 88,
    width: 56,
    height: 56,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  fabRing: {
    position: 'absolute' as const,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#E8A020',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8A020',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(212,134,10,0.15)',
  },
};

export default Home;
