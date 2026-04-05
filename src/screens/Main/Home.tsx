import {
  StatusBar,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ImageBackground,
  ScrollView,
} from 'react-native';
import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
} from 'react';
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
import { usePermissionCheck } from '../../utils/usePermissionCheck';
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

const FACT_LOADING_LINES = [
  'Tracing your heritage...',
  'Weaving nearby context...',
  'Preparing your insights...',
  'Connecting the threads...',
  'Reading the monuments...',
];

const CATEGORY_IMAGE_MAP: Record<string, string> = {
  temple:
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80',
  religious:
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80',
  fort: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
  castle:
    'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
};
const FALLBACK_PLACE_IMAGE =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80';

function getPlaceImage(categories: string[]): string {
  const first = categories[0]?.toLowerCase() ?? '';
  for (const [keyword, uri] of Object.entries(CATEGORY_IMAGE_MAP)) {
    if (first.includes(keyword)) {
      return uri;
    }
  }
  return FALLBACK_PLACE_IMAGE;
}

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
  onPress: (place: Place) => void;
}

const PlaceCard: React.FC<PlaceCardProps> = React.memo(({ place, onPress }) => {
  const scale = useSharedValue(1);
  const imageUri = getPlaceImage(place.categories);
  const distanceKm = (place.distance_meters / 1000).toFixed(1);
  const shortDescription = place.categories[0] || 'Historic site';

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
      <ImageBackground
        source={{ uri: imageUri }}
        style={cardStyles.image}
        imageStyle={cardStyles.imageMask}
      >
        <LinearGradient
          colors={['rgba(8,8,8,0.12)', 'rgba(8,8,8,0.88)']}
          style={cardStyles.gradient}
        >
          <View className="self-start flex-row items-center gap-1 rounded-full bg-[rgba(10,10,10,0.7)] border border-[rgba(201,168,76,0.35)] px-3 py-1.5">
            <Compass color="#C9A84C" size={14} />
            <Text className="text-[#F5F0E8] text-xs leading-4 font-['MontserratAlternates-SemiBold']">
              {distanceKm} km away
            </Text>
          </View>

          <View>
            <Text
              className="text-[#F5F0E8] text-2xl leading-8 font-['MontserratAlternates-Bold']"
              numberOfLines={2}
            >
              {place.name}
            </Text>
            <View className="flex-row items-center gap-1 mt-2">
              <MapPin color="#B8AF9E" size={15} />
              <Text
                className="text-[#B8AF9E] text-[13px] leading-[18px] font-['MontserratAlternates-Medium'] flex-shrink"
                numberOfLines={1}
              >
                {place.city}, {place.country}
              </Text>
            </View>

            <Text
              className="text-[#B8AF9E] text-sm leading-5 mt-3 font-['MontserratAlternates-Regular']"
              numberOfLines={2}
            >
              {shortDescription}
            </Text>

            <View className="mt-4 self-start flex-row items-center gap-1 rounded-full bg-[#C9A84C] px-3 py-2">
              <Text className="text-[#0A0A0A] text-xs leading-4 uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold']">
                Explore the Era
              </Text>
              <ArrowRight color="#0A0A0A" size={14} />
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </AnimatedTouchable>
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
  usePermissionCheck();
  const { nearbyPlaces, isLoadingNearby, nearbyError } = usePlaces();
  const { profile } = useUser();

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

  const entrance = useSharedValue(24);
  const contentOpacity = useSharedValue(0);
  const lensFabScale = useSharedValue(1);

  useEffect(() => {
    entrance.value = withSpring(0, { damping: 20, stiffness: 200 });
    contentOpacity.value = withTiming(1, { duration: 400 });
  }, [contentOpacity, entrance]);


  const entranceStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: entrance.value }],
  }));

  const lensFabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lensFabScale.value }],
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
      const siteData = {
        id: place.id,
        name: place.name,
        location: place.formatted || `${place.city}, ${place.country}`,
        era: place.categories[0] || 'Historic',
        style: place.categories.join(', ') || 'Architecture',
        yearBuilt: 'Unknown',
        distance: `${(place.distance_meters / 1000).toFixed(1)} km`,
        estimatedTime: '45 min',
        heroImages: [getPlaceImage(place.categories)],
        shortDescription: `Explore ${place.name} located at ${place.formatted}.`,
        fullDescription: `${place.name} is a historic site located at ${place.formatted}. Discover its rich history and cultural significance.`,
        funFacts: [],
        visitorTips: [
          'Best visited during early morning or late afternoon.',
          'Carry water and wear comfortable shoes.',
        ],
        relatedSites: [],
        rating: 4.5,
        reviews: 0,
        lat: place.lat,
        lon: place.lon,
        address_line1: place.address_line1,
        city: place.city,
        country: place.country,
      };
      navigation.navigate('SiteDetail', { site: siteData });
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

    if (result.success && result.data.facts.length > 0) {
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
    loadPersonalizedFacts();
  }, [loadPersonalizedFacts]);

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
    ({ item }: { item: Place }) => (
      <PlaceCard place={item} onPress={handleVisitPlace} />
    ),
    [handleVisitPlace],
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0A0A0A', '#12100D', '#0A0A0A']}
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
              <View className="flex-1 pr-4">
                <Text className="text-[#B8AF9E] text-xs uppercase tracking-[1px] font-['MontserratAlternates-SemiBold']">
                  {greeting}
                </Text>
                <Text className="text-[#F5F0E8] text-[32px] leading-10 font-['MontserratAlternates-Bold'] mt-1">
                  {userName}
                </Text>
                <Text className="text-[#B8AF9E] text-[15px] leading-[22px] font-['MontserratAlternates-Medium'] mt-1">
                  Ready to uncover history today?
                </Text>
              </View>
              <TouchableOpacity
                className="w-11 h-11 rounded-full bg-[#1C1C1C] border border-[rgba(201,168,76,0.3)] items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                accessibilityHint="Opens your notification centre"
              >
                <Bell color="#F5F0E8" size={20} />
              </TouchableOpacity>
            </View>

            {/* Nearby Highlights */}
            <View className="mb-4">
              <View className="flex-row items-center gap-2">
                <Sparkles color="#C9A84C" size={18} />
                <Text className="text-[#F5F0E8] text-[22px] leading-[30px] font-['MontserratAlternates-SemiBold']">
                  Nearby Highlights
                </Text>
              </View>
              <Text className="text-[#6B6357] text-[13px] leading-[18px] font-['MontserratAlternates-Regular'] mt-1">
                Curated sites around your location
              </Text>
              {nearbyError ? (
                <Text className="text-[#E05C5C] text-[13px] leading-[18px] font-['MontserratAlternates-Medium'] mt-2">
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
              <View className="mb-4 rounded-[20px] bg-[#141414] border border-[rgba(255,255,255,0.08)] py-7 px-5 items-center justify-center gap-2">
                <MapPin color="#C9A84C" size={36} />
                <Text className="text-[#F5F0E8] text-lg leading-6 text-center font-['MontserratAlternates-SemiBold']">
                  No monuments discovered nearby yet
                </Text>
                <Text className="text-[#B8AF9E] text-sm leading-5 text-center font-['MontserratAlternates-Regular']">
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
                contentContainerStyle={{ paddingRight: 8, paddingBottom: 8 }}
              />
            )}

            {/* Insights card */}
            {factsVisible && (
              <View className="mt-6 mb-3 rounded-[20px] bg-[#141414] border border-[rgba(201,168,76,0.3)] p-5">
                <View className="flex-row items-center justify-between mb-2.5">
                  <Text className="text-[#F5F0E8] text-lg leading-6 font-['MontserratAlternates-SemiBold']">
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
                  <View className="items-center py-4 gap-4">
                    <AnimatedLogo size={58} motion="orbit" variant="white" />
                    <ThinkingDots messages={FACT_LOADING_LINES} />
                    <Text className="text-[#B8AF9E] text-xs leading-[18px] text-center font-['MontserratAlternates-Regular']">
                      Preparing expandable details you can tap into.
                    </Text>
                  </View>
                ) : (
                  <View className="gap-2.5 mt-1">
                    {factsError ? (
                      <Text className="text-[#8F8576] text-[11px] leading-4 mb-0.5 font-['MontserratAlternates-Regular']">
                        {factsError}
                      </Text>
                    ) : null}

                    {facts.map((fact, index) => {
                      const isExpanded = activeFactId === fact.id;
                      const isElaborating = elaboratingFactId === fact.id;
                      const detailText =
                        factDetailsById[fact.id] ?? fact.detail;

                      return (
                        <TouchableOpacity
                          key={fact.id}
                          className="rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3"
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
                          accessibilityLabel={`Open insight ${index + 1}`}
                          accessibilityHint="Shows a detailed explanation"
                        >
                          <View className="flex-row items-start gap-2.5">
                            <View className="w-[22px] h-[22px] rounded-full bg-[rgba(201,168,76,0.2)] border border-[rgba(201,168,76,0.45)] items-center justify-center mt-0.5">
                              <Text className="text-[#E8A33A] text-[11px] font-['MontserratAlternates-SemiBold']">
                                {index + 1}
                              </Text>
                            </View>
                            <View className="flex-1">
                              <Text className="text-[#F5F0E8] text-sm leading-5 font-['MontserratAlternates-SemiBold']">
                                {fact.headline}
                              </Text>
                              <Text className="text-[#B8AF9E] text-[13px] leading-[19px] mt-1 font-['MontserratAlternates-Regular']">
                                {fact.summary}
                              </Text>
                            </View>
                          </View>

                          {isExpanded ? (
                            <View className="mt-2.5 pt-2.5 border-t border-[rgba(255,255,255,0.08)]">
                              {isElaborating ? (
                                <ThinkingDots
                                  messages={['Expanding this insight...']}
                                  color="#B8AF9E"
                                />
                              ) : detailText ? (
                                <Text className="text-[#E6DFC7] text-[13px] leading-5 font-['MontserratAlternates-Regular']">
                                  {detailText}
                                </Text>
                              ) : null}
                            </View>
                          ) : null}

                          <Text className="mt-2 text-[#8C7F6B] text-[10px] leading-[14px] uppercase tracking-[0.7px] font-['MontserratAlternates-SemiBold']">
                            {isExpanded ? 'Tap to collapse' : 'Tap to expand'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      onPress={() => {
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
                      <Text className="text-[#C9A84C] text-xs leading-4 uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold']">
                        Refresh Insights
                      </Text>
                      <RefreshCw color="#C9A84C" size={16} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>

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
      </LinearGradient>
    </SafeAreaView>
  );
};

// Only styles that cannot be expressed as className (animated views, image masks, FAB position)
const cardStyles = {
  container: {
    width: 238,
    height: 292,
    marginRight: 16,
  },
  image: {
    flex: 1,
  },
  imageMask: {
    borderRadius: 20,
  },
  gradient: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    justifyContent: 'space-between' as const,
  },
};

const skeletonStyles = {
  card: {
    width: 210,
    height: 248,
    borderRadius: 16,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
  fab: {
    position: 'absolute' as const,
    right: 20,
    bottom: 88,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8A020',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(10,10,10,0.2)',
  },
};

export default Home;
