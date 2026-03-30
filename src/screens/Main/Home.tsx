import {
  StatusBar,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ImageBackground,
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
} from 'react-native-reanimated';
import {
  Bell,
  MapPin,
  ArrowRight,
  X,
  Sparkles,
  Compass,
  RefreshCw,
} from 'lucide-react-native';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import { usePermissionCheck } from '../../utils/usePermissionCheck';
import { usePlaces } from '../../context';
import { useUser } from '../../context';
import type { TabScreenProps } from '../../core/types/navigation.types';
import type { Place } from '../../utils/api/places/types';
import {
  getPersonalizedFacts,
  elaboratePersonalizedFact,
} from '../../utils/api/user';
import type { PersonalizedFact } from '../../utils/api/user';

const FACT_LOADING_LINES = [
  'Gemini is tailoring facts to your journey...',
  'Cross-referencing your profile with heritage context...',
  'Preparing expandable insights you can explore...',
];

// Map a place's first category to a relevant stock image on Unsplash.
// This is a temporary measure until the backend supplies its own images.
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

/** Returns a representative image URI for a place based on its categories. */
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
      detail:
        'Gemini could not be reached right now, so this is a local backup insight. Tap refresh shortly to fetch a live personalized expansion.',
    },
    {
      id: 'fallback-2',
      headline: 'Architecture reveals social memory',
      summary:
        'Many preserved sites encode daily rituals, trade patterns, and migration stories in plain sight through layout and ornament.',
      detail:
        'When Gemini is available, this fact will expand with region-specific context based on your nearby places and profile history.',
    },
    {
      id: 'fallback-3',
      headline: 'Monuments were living spaces',
      summary:
        'Historical sites were active civic hubs, not static relics; ceremonies, decisions, and storytelling happened there regularly.',
      detail:
        'Use refresh to generate a deeper personalized thread that connects this pattern to places around you right now.',
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
      style={[styles.placeCardContainer, animatedCardStyle]}
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
        style={styles.placeImage}
        imageStyle={styles.placeImageMask}
      >
        <LinearGradient
          colors={['rgba(8,8,8,0.12)', 'rgba(8,8,8,0.88)']}
          style={styles.placeGradient}
        >
          <View style={styles.distancePill}>
            <Compass color="#C9A84C" size={14} />
            <Text style={styles.distanceText}>{distanceKm} km away</Text>
          </View>

          <View>
            <Text style={styles.placeTitle} numberOfLines={2}>
              {place.name}
            </Text>
            <View style={styles.placeLocationRow}>
              <MapPin color="#B8AF9E" size={15} />
              <Text style={styles.placeLocationText} numberOfLines={1}>
                {place.city}, {place.country}
              </Text>
            </View>

            <Text style={styles.placeDescription} numberOfLines={2}>
              {shortDescription}
            </Text>

            <View style={styles.explorePill}>
              <Text style={styles.explorePillText}>Explore the Era</Text>
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
    <Animated.View style={[styles.skeletonCard, animatedStyle]}>
      <View style={styles.skeletonPill} />
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
      <View style={styles.skeletonCta} />
    </Animated.View>
  );
};

const Home = ({ navigation }: Props) => {
  // Trigger a permission check whenever this screen is active
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
  const [factLoadingLineIndex, setFactLoadingLineIndex] = useState(0);
  const entrance = useSharedValue(24);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    entrance.value = withSpring(0, { damping: 20, stiffness: 200 });
    contentOpacity.value = withTiming(1, { duration: 400 });
  }, [contentOpacity, entrance]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: entrance.value }],
  }));

  // Greeting changes based on time of day and is recalculated only once per
  // mount (the hour won't change while the user reads the screen)
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

  // Build the SiteDetail navigation param from a Place API object.
  // All fields the SiteDetail screen needs are derived here so the screen
  // itself never has to reach back into the raw API shape.
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
        // Placeholder hero images until the backend provides its own CDN URLs
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
        ? 'No personalized Gemini facts were returned yet. Showing curated fallback insights.'
        : 'Gemini is currently unavailable. Showing curated fallback insights.',
    );
    setFactDetailsById({});
    setActiveFactId(null);
    setIsLoadingFacts(false);
  }, [topNearbyPlaces, userName]);

  useEffect(() => {
    loadPersonalizedFacts();
  }, [loadPersonalizedFacts]);

  useEffect(() => {
    if (!isLoadingFacts) {
      return;
    }

    const timer = setInterval(() => {
      setFactLoadingLineIndex(prev => (prev + 1) % FACT_LOADING_LINES.length);
    }, 1700);

    return () => clearInterval(timer);
  }, [isLoadingFacts]);

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
          setFactDetailsById(prev => ({
            ...prev,
            [fact.id]: existingDetail,
          }));
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
        [fact.id]: `${fact.summary} This likely connects to ${
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0A0A0A', '#12100D', '#0A0A0A']}
        locations={[0, 0.5, 1]}
        style={styles.gradient}
      >
        <Animated.View style={[styles.content, entranceStyle]}>
          <View style={styles.topRow} accessibilityRole="header">
            <View style={styles.greetingWrap}>
              <Text style={styles.greetingLabel}>{greeting}</Text>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.subtitle}>
                Ready to uncover history today?
              </Text>
            </View>
            <TouchableOpacity
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              accessibilityHint="Opens your notification centre"
            >
              <Bell color="#F5F0E8" size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Sparkles color="#C9A84C" size={18} />
              <Text style={styles.sectionTitle}>Nearby Highlights</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Curated sites around your location
            </Text>
            {nearbyError && <Text style={styles.errorText}>{nearbyError}</Text>}
          </View>

          {isLoadingNearby ? (
            <View style={styles.skeletonRow}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : topNearbyPlaces.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <MapPin color="#C9A84C" size={36} />
              <Text style={styles.emptyStateTitle}>
                No monuments discovered nearby yet
              </Text>
              <Text style={styles.emptyStateBody}>
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
              contentContainerStyle={styles.placeListContent}
            />
          )}

          {factsVisible && (
            <View style={styles.factCard}>
              <View style={styles.factHeaderRow}>
                <Text style={styles.factHeading}>Gemini Facts For You</Text>
                <TouchableOpacity
                  onPress={() => setFactsVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss personalized facts"
                >
                  <X color="#6B6357" size={20} />
                </TouchableOpacity>
              </View>

              {isLoadingFacts ? (
                <View style={styles.factLoadingWrap}>
                  <AnimatedLogo size={58} motion="orbit" variant="white" />
                  <Text style={styles.factLoadingText}>
                    {FACT_LOADING_LINES[factLoadingLineIndex]}
                  </Text>
                  <Text style={styles.factLoadingSubtext}>
                    Preparing expandable details you can tap into.
                  </Text>
                </View>
              ) : (
                <View style={styles.factListWrap}>
                  {factsError ? (
                    <Text style={styles.factErrorText}>{factsError}</Text>
                  ) : null}

                  {facts.map((fact, index) => {
                    const isExpanded = activeFactId === fact.id;
                    const isElaborating = elaboratingFactId === fact.id;
                    const detailText = factDetailsById[fact.id] ?? fact.detail;

                    return (
                      <TouchableOpacity
                        key={fact.id}
                        style={styles.factItem}
                        onPress={() => {
                          handleFactPress(fact).catch(() => {
                            setFactDetailsById(prev => ({
                              ...prev,
                              [fact.id]: `${
                                fact.summary
                              } This likely connects to ${
                                topNearbyPlaces[0]?.name ??
                                'nearby heritage sites'
                              } through shared routes, ritual patterns, and artisan exchange across generations.`,
                            }));
                          });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Open fact ${index + 1}`}
                        accessibilityHint="Shows detailed explanation for this personalized fact"
                      >
                        <View style={styles.factItemHeader}>
                          <View style={styles.factIndexBadge}>
                            <Text style={styles.factIndexText}>
                              {index + 1}
                            </Text>
                          </View>
                          <View style={styles.factItemHeadingWrap}>
                            <Text style={styles.factItemHeading}>
                              {fact.headline}
                            </Text>
                            <Text style={styles.factItemSummary}>
                              {fact.summary}
                            </Text>
                          </View>
                        </View>

                        {isExpanded ? (
                          <View style={styles.factExpandedWrap}>
                            {isElaborating ? (
                              <View style={styles.factElaboratingRow}>
                                <AnimatedLogo
                                  size={20}
                                  motion="pulse"
                                  variant="white"
                                  showRing={false}
                                />
                                <Text style={styles.factElaboratingText}>
                                  Gemini is elaborating this insight...
                                </Text>
                              </View>
                            ) : detailText ? (
                              <Text style={styles.factExpandedText}>
                                {detailText}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}

                        <Text style={styles.factTapHint}>
                          {isExpanded ? 'Tap to collapse' : 'Tap to elaborate'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    onPress={() => {
                      loadPersonalizedFacts().catch(() => {
                        setFacts(buildFallbackFacts(userName, topNearbyPlaces));
                        setFactsError(
                          'Gemini is currently unavailable. Showing curated fallback insights.',
                        );
                        setIsLoadingFacts(false);
                      });
                    }}
                    style={styles.factAction}
                    accessibilityRole="button"
                    accessibilityLabel="Refresh personalized facts"
                  >
                    <Text style={styles.factActionText}>Refresh Facts</Text>
                    <RefreshCw color="#C9A84C" size={16} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = {
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  greetingWrap: {
    flex: 1,
    paddingRight: 16,
  },
  greetingLabel: {
    color: '#B8AF9E',
    fontSize: 12,
    fontFamily: 'MontserratAlternates-SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  userName: {
    color: '#F5F0E8',
    fontSize: 32,
    lineHeight: 40,
    fontFamily: 'MontserratAlternates-Bold',
    marginTop: 4,
  },
  subtitle: {
    color: '#B8AF9E',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'MontserratAlternates-Medium',
    marginTop: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#F5F0E8',
    fontSize: 22,
    lineHeight: 30,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  sectionSubtitle: {
    color: '#6B6357',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'MontserratAlternates-Regular',
    marginTop: 4,
  },
  errorText: {
    color: '#E05C5C',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'MontserratAlternates-Medium',
    marginTop: 8,
  },
  placeListContent: {
    paddingRight: 8,
    paddingBottom: 8,
  },
  placeCardContainer: {
    width: 238,
    height: 292,
    marginRight: 16,
  },
  placeImage: {
    flex: 1,
  },
  placeImageMask: {
    borderRadius: 20,
  },
  placeGradient: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    justifyContent: 'space-between',
  },
  distancePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,10,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  distanceText: {
    color: '#F5F0E8',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  placeTitle: {
    color: '#F5F0E8',
    fontSize: 24,
    lineHeight: 32,
    fontFamily: 'MontserratAlternates-Bold',
  },
  placeLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  placeLocationText: {
    color: '#B8AF9E',
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
    fontFamily: 'MontserratAlternates-Medium',
  },
  placeDescription: {
    color: '#B8AF9E',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    fontFamily: 'MontserratAlternates-Regular',
  },
  explorePill: {
    marginTop: 16,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#C9A84C',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  explorePillText: {
    color: '#0A0A0A',
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  skeletonCard: {
    width: 210,
    height: 248,
    borderRadius: 16,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    justifyContent: 'flex-end',
  },
  skeletonPill: {
    width: 86,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  skeletonTitle: {
    width: '75%',
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginBottom: 8,
  },
  skeletonLine: {
    width: '100%',
    height: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 8,
  },
  skeletonLineShort: {
    width: '64%',
  },
  skeletonCta: {
    marginTop: 8,
    width: 124,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(201,168,76,0.25)',
  },
  emptyStateCard: {
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyStateTitle: {
    color: '#F5F0E8',
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  emptyStateBody: {
    color: '#B8AF9E',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'MontserratAlternates-Regular',
  },
  factCard: {
    marginTop: 24,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.3)',
    padding: 20,
  },
  factHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  factHeading: {
    color: '#F5F0E8',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  factLoadingWrap: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  factLoadingText: {
    color: '#E8A33A',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  factLoadingSubtext: {
    color: '#B8AF9E',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'MontserratAlternates-Regular',
  },
  factListWrap: {
    gap: 10,
    marginTop: 4,
  },
  factErrorText: {
    color: '#8F8576',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 2,
    fontFamily: 'MontserratAlternates-Regular',
  },
  factItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
  },
  factItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  factIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(201, 168, 76, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  factIndexText: {
    color: '#E8A33A',
    fontSize: 11,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  factItemHeadingWrap: {
    flex: 1,
  },
  factItemHeading: {
    color: '#F5F0E8',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  factItemSummary: {
    color: '#B8AF9E',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    fontFamily: 'MontserratAlternates-Regular',
  },
  factExpandedWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  factExpandedText: {
    color: '#E6DFC7',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'MontserratAlternates-Regular',
  },
  factElaboratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factElaboratingText: {
    color: '#B8AF9E',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'MontserratAlternates-Regular',
  },
  factTapHint: {
    marginTop: 8,
    color: '#8C7F6B',
    fontSize: 10,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  factAction: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
  },
  factActionText: {
    color: '#C9A84C',
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
};

export default Home;
