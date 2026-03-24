import {
  StatusBar,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ImageBackground,
} from 'react-native';
import React, { useMemo, useState, useEffect } from 'react';
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
} from 'lucide-react-native';
import { usePermissionCheck } from '../../utils/usePermissionCheck';
import { usePlaces } from '../../context';
import { useUser } from '../../context';
import type { TabScreenProps } from '../../core/types/navigation.types';
import type { Place } from '../../utils/api/places/types';

// Rotating historical facts shown in the "Daily Fact" card.
// These are static educational content, not user-specific data.
const DAILY_FACTS = [
  'Did you know? The sound of a clap made at the entrance of the Gol Gumbaz can be heard on the other side of the dome due to its whispering gallery.',
  'The Konark Sun Temple was shaped like a colossal chariot with 24 wheels, each 12 feet in diameter, pulled by seven horses.',
  "The Ajanta Caves hold some of the oldest paintings in India, dating back to the 2nd century BCE, depicting Buddha's previous lives.",
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

type Props = TabScreenProps<'Home'>;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface PlaceCardProps {
  place: Place;
  onPress: (place: Place) => void;
}

const PlaceCard: React.FC<PlaceCardProps> = ({ place, onPress }) => {
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
};

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

  const [factIndex, setFactIndex] = useState(0);
  const [factVisible, setFactVisible] = useState(true);
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

  const currentFact = DAILY_FACTS[factIndex % DAILY_FACTS.length];

  const handleNextFact = () => {
    setFactIndex(prev => (prev + 1) % DAILY_FACTS.length);
    setFactVisible(true);
  };

  // Build the SiteDetail navigation param from a Place API object.
  // All fields the SiteDetail screen needs are derived here so the screen
  // itself never has to reach back into the raw API shape.
  const handleVisitPlace = (place: Place) => {
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
  };

  const userName = profile?.name || 'Explorer';

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
          ) : !nearbyPlaces || nearbyPlaces.length === 0 ? (
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
              data={nearbyPlaces.slice(0, 20)}
              renderItem={({ item }) => (
                <PlaceCard place={item} onPress={handleVisitPlace} />
              )}
              keyExtractor={item => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.placeListContent}
            />
          )}

          {factVisible && (
            <View style={styles.factCard}>
              <View style={styles.factHeaderRow}>
                <Text style={styles.factHeading}>Artifact of the Day</Text>
                <TouchableOpacity
                  onPress={() => setFactVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss daily fact"
                >
                  <X color="#6B6357" size={20} />
                </TouchableOpacity>
              </View>
              <Text style={styles.factBody}>{currentFact}</Text>
              <TouchableOpacity
                onPress={handleNextFact}
                style={styles.factAction}
                accessibilityRole="button"
                accessibilityLabel="Show next fact"
              >
                <Text style={styles.factActionText}>Uncover Another</Text>
                <ArrowRight color="#C9A84C" size={16} />
              </TouchableOpacity>
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
    marginBottom: 12,
  },
  factHeading: {
    color: '#F5F0E8',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  factBody: {
    color: '#B8AF9E',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'MontserratAlternates-Regular',
  },
  factAction: {
    marginTop: 16,
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
