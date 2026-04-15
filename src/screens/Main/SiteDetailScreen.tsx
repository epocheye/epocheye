import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import ThinkingDots from '../../components/ui/ThinkingDots';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  ArrowLeft,
  Heart,
  Share2,
  MapPin,
  Clock3,
  Navigation,
  Camera,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bookmark,
  BookOpen,
  Shield,
} from 'lucide-react-native';
import { formatPlaceType } from '../../shared/utils/formatters';
import { ROUTES } from '../../core/constants';
import { usePlaces, useUser } from '../../context';
import { useResolvedSubjectImage, useExplorerPass } from '../../shared/hooks';
import {
  getPersonalizedFacts,
  elaboratePersonalizedFact,
} from '../../utils/api/user';
import type { PersonalizedFact } from '../../utils/api/user';
import type { MainScreenProps } from '../../core/types/navigation.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 340;

const FACT_LOADING_LINES = [
  'Reading the stones...',
  'Uncovering connections...',
  'Weaving the narrative...',
];

type Props = MainScreenProps<'SiteDetail'>;

const SiteDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const site = route.params.site;
  const profile = useUser(state => state.profile);
  const toggleSavePlace = usePlaces(state => state.toggleSavePlace);
  const isPlaceSaved = usePlaces(state => state.isPlaceSaved);
  const { checkAccess } = useExplorerPass();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  // Personalized facts state
  const [facts, setFacts] = useState<PersonalizedFact[]>([]);
  const [factsLoading, setFactsLoading] = useState(true);
  const [expandedFactId, setExpandedFactId] = useState<string | null>(null);
  const [elaboratingFactId, setElaboratingFactId] = useState<string | null>(
    null,
  );

  const { url: resolvedHeroImage, loading: resolvingHeroImage } =
    useResolvedSubjectImage({
      subject: site.name,
      context: `${(site as any).formatted ?? site.city ?? ''} heritage monument`,
      enabled: !!site.name,
      remote: true,
    });

  const heroImages = useMemo(() => {
    const existing =
      Array.isArray(site.heroImages) && site.heroImages.length > 0
        ? (site.heroImages.filter(
            (img): img is string => typeof img === 'string',
          ) as string[])
        : [];
    if (!resolvedHeroImage) {
      return existing;
    }
    if (existing.includes(resolvedHeroImage)) {
      return existing;
    }
    return [resolvedHeroImage, ...existing];
  }, [resolvedHeroImage, site.heroImages]);

  const showHeroSkeleton = heroImages.length === 0 && resolvingHeroImage;

  const scrollY = useSharedValue(0);
  const isSaved = isPlaceSaved(site.id);

  const placeType = useMemo(() => {
    const pt = (site as any).place_type;
    return typeof pt === 'string' ? formatPlaceType(pt) : 'Heritage Landmark';
  }, [site]);

  const location = useMemo(() => {
    const formatted = (site as any).formatted;
    if (typeof formatted === 'string' && formatted.length > 0) {
      return formatted;
    }
    return [site.city, site.country].filter(Boolean).join(', ') || 'India';
  }, [site]);

  const categories = useMemo(() => {
    const cats = (site as any).categories;
    return Array.isArray(cats) ? cats.slice(0, 3) : [];
  }, [site]);

  const description = useMemo(() => {
    const desc = (site as any).description;
    const sig = (site as any).significance;
    return (
      desc ||
      sig ||
      `Explore ${site.name}, a historic heritage site located at ${location}.`
    );
  }, [site, location]);

  const distance = useMemo(() => {
    const meters = (site as any).distance_meters;
    if (typeof meters === 'number' && meters > 0) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return null;
  }, [site]);

  // Prefetch hero image
  useEffect(() => {
    if (resolvedHeroImage) {
      void Image.prefetch(resolvedHeroImage);
    }
  }, [resolvedHeroImage]);

  // Check explorer pass access
  useEffect(() => {
    checkAccess(site.id).then(result => {
      if (result?.has_access) {
        setHasAccess(true);
      }
    });
  }, [checkAccess, site.id]);

  // Fetch personalized facts
  useEffect(() => {
    let cancelled = false;

    async function loadFacts() {
      setFactsLoading(true);
      const result = await getPersonalizedFacts({
        userName: profile?.name ?? 'Explorer',
        nearbyPlaces: [site.name],
        limit: 4,
      });
      if (!cancelled) {
        if (result.success) {
          setFacts(result.data.facts);
        }
        setFactsLoading(false);
      }
    }

    loadFacts();
    return () => {
      cancelled = true;
    };
  }, [site.name, profile?.name]);

  const onScroll = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });

  const stickyHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [100, 180],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const handleToggleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await toggleSavePlace(site.id, {
        id: site.id,
        name: site.name,
        lat: site.lat ?? 0,
        lon: site.lon ?? 0,
        city: site.city ?? '',
        country: site.country ?? '',
        formatted: (site as any).formatted ?? location,
        address_line1: (site as any).address_line1 ?? location,
        address_line2: '',
        state: '',
        postcode: '',
        street: '',
        distance_meters: 0,
        categories: categories,
      });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, site, toggleSavePlace, location, categories]);

  const handleStartARExperience = useCallback(() => {
    navigation.navigate('ARExperience', { site });
  }, [navigation, site]);

  const handleViewTours = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.TOUR_LIST, {
      monumentId: site.id,
      monumentName: site.name,
    });
  }, [navigation, site]);

  const handleImageScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.x;
      setCurrentImageIndex(Math.round(offset / SCREEN_WIDTH));
    },
    [],
  );

  const handleElaborateFact = useCallback(
    async (fact: PersonalizedFact) => {
      if (expandedFactId === fact.id && fact.detail) {
        setExpandedFactId(null);
        return;
      }

      setExpandedFactId(fact.id);

      if (fact.detail) {
        return;
      }

      setElaboratingFactId(fact.id);
      const result = await elaboratePersonalizedFact({
        factId: fact.id,
        headline: fact.headline,
        summary: fact.summary,
        userName: profile?.name,
        nearbyPlaceName: site.name,
      });

      if (result.success) {
        setFacts(prev =>
          prev.map(f =>
            f.id === fact.id ? { ...f, detail: result.data.detail } : f,
          ),
        );
      }
      setElaboratingFactId(null);
    },
    [expandedFactId, profile?.name, site.name],
  );

  return (
    <SafeAreaView className="flex-1 bg-ink-deep" edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Sticky header */}
      <Animated.View
        className="absolute top-0 left-0 right-0 z-20 h-14 justify-center items-center px-14"
        style={[
          { backgroundColor: 'rgba(10,10,10,0.94)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
          stickyHeaderStyle,
        ]}
      >
        <Text
          numberOfLines={1}
          className="text-parchment text-[15px] font-['MontserratAlternates-SemiBold']"
        >
          {site.name}
        </Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Hero */}
        <View style={{ height: HERO_HEIGHT }}>
          {showHeroSkeleton ? (
            <View
              style={{
                width: SCREEN_WIDTH,
                height: HERO_HEIGHT,
                backgroundColor: '#141414',
              }}
              className="items-center justify-center"
            >
              <AnimatedLogo
                size={44}
                variant="white"
                motion="pulse"
                showRing
              />
              <Text className="text-parchment-muted text-[12px] mt-3 tracking-[0.8px] uppercase font-['MontserratAlternates-SemiBold']">
                Rendering the scene
              </Text>
            </View>
          ) : heroImages.length === 0 ? (
            <View
              style={{
                width: SCREEN_WIDTH,
                height: HERO_HEIGHT,
                backgroundColor: '#0F0F0F',
              }}
            />
          ) : (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleImageScroll}
            >
              {heroImages.map((image, index) => (
                <Image
                  key={`${image}-${index}`}
                  source={{ uri: image }}
                  style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.7)']}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />

          {/* Hero controls */}
          <View className="absolute top-4 left-5 right-5 flex-row justify-between items-center">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-10 h-10 rounded-full bg-black/45 border border-white/20 items-center justify-center"
            >
              <ArrowLeft color="#F5F0E8" size={20} />
            </TouchableOpacity>

            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setIsLiked(prev => !prev)}
                className="w-10 h-10 rounded-full bg-black/45 border border-white/20 items-center justify-center"
              >
                <Heart
                  color={isLiked ? '#E05C5C' : '#F5F0E8'}
                  fill={isLiked ? '#E05C5C' : 'transparent'}
                  size={20}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleToggleSave}
                disabled={isSaving}
                className="w-10 h-10 rounded-full bg-black/45 border border-white/20 items-center justify-center"
              >
                {isSaving ? (
                  <AnimatedLogo
                    size={16}
                    variant="white"
                    motion="pulse"
                    showRing={false}
                  />
                ) : (
                  <Bookmark
                    color={isSaved ? '#C9A84C' : '#F5F0E8'}
                    fill={isSaved ? '#C9A84C' : 'transparent'}
                    size={20}
                  />
                )}
              </TouchableOpacity>
              <TouchableOpacity className="w-10 h-10 rounded-full bg-black/45 border border-white/20 items-center justify-center">
                <Share2 color="#F5F0E8" size={20} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero footer */}
          <View className="absolute left-5 right-5 bottom-[18px]">
            <Text className="text-brand-gold text-[11px] uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold']">
              {placeType}
            </Text>
            <Text className="text-parchment text-[28px] leading-9 font-['MontserratAlternates-Bold'] mt-1">
              {site.name}
            </Text>
            <View className="flex-row items-center gap-1 mt-1.5">
              <MapPin color="#B8AF9E" size={14} />
              <Text
                numberOfLines={1}
                className="flex-1 text-parchment-muted text-[13px] font-['MontserratAlternates-Medium']"
              >
                {location}
              </Text>
            </View>

            {heroImages.length > 1 && (
              <View className="flex-row gap-1.5 mt-2.5">
                {heroImages.map((_, index) => (
                  <View
                    key={`dot-${index}`}
                    className={`h-2 rounded-full ${
                      currentImageIndex === index
                        ? 'w-[22px] bg-brand-gold'
                        : 'w-2 bg-white/55'
                    }`}
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        <View className="-mt-6 px-5 gap-4">
          {/* Info card */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            className="rounded-[20px] bg-surface-1 border border-white/[0.08] p-4"
          >
            {/* Category tags */}
            {categories.length > 0 && (
              <View className="flex-row flex-wrap gap-2 mb-3">
                {categories.map((cat: string, i: number) => (
                  <View
                    key={cat}
                    className={`rounded-full px-2.5 py-1 ${
                      i === 0
                        ? 'bg-[rgba(201,168,76,0.18)]'
                        : 'bg-white/[0.08]'
                    }`}
                  >
                    <Text
                      className={`text-xs font-['MontserratAlternates-SemiBold'] ${
                        i === 0 ? 'text-brand-gold' : 'text-parchment'
                      }`}
                    >
                      {typeof cat === 'string'
                        ? cat.charAt(0).toUpperCase() + cat.slice(1)
                        : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Meta row */}
            <View className="flex-row gap-3">
              {distance && (
                <View className="flex-1 flex-row items-center gap-2.5 rounded-xl bg-surface-2 p-3">
                  <View className="w-7 h-7 rounded-full bg-[rgba(201,168,76,0.15)] items-center justify-center">
                    <Navigation color="#C9A84C" size={16} />
                  </View>
                  <View>
                    <Text className="text-parchment text-sm font-['MontserratAlternates-SemiBold']">
                      {distance}
                    </Text>
                    <Text className="text-parchment-dim text-xs font-['MontserratAlternates-Regular']">
                      Distance
                    </Text>
                  </View>
                </View>
              )}
              <View className="flex-1 flex-row items-center gap-2.5 rounded-xl bg-surface-2 p-3">
                <View className="w-7 h-7 rounded-full bg-[rgba(201,168,76,0.15)] items-center justify-center">
                  <Clock3 color="#C9A84C" size={16} />
                </View>
                <View>
                  <Text className="text-parchment text-sm font-['MontserratAlternates-SemiBold']">
                    45 min
                  </Text>
                  <Text className="text-parchment-dim text-xs font-['MontserratAlternates-Regular']">
                    Est. Tour
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Explorer Pass badge */}
          {hasAccess && (
            <Animated.View
              entering={FadeIn.delay(200)}
              className="flex-row items-center gap-2 bg-status-success/10 border border-status-success/20 rounded-xl px-4 py-3"
            >
              <Shield color="#10B981" size={16} />
              <Text className="text-status-success text-sm font-['MontserratAlternates-SemiBold']">
                Explorer Pass Active
              </Text>
            </Animated.View>
          )}

          {/* CTA: Begin Your Journey */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <TouchableOpacity
              onPress={handleStartARExperience}
              className="rounded-xl bg-brand-gold py-3.5 items-center justify-center flex-row gap-2"
              activeOpacity={0.88}
            >
              <Camera color="#0A0A0A" size={18} />
              <Text className="text-ink text-[15px] uppercase tracking-[0.8px] font-['MontserratAlternates-Bold']">
                Begin Your Journey
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* CTA: View Tours */}
          <TouchableOpacity
            onPress={handleViewTours}
            className="rounded-xl border border-[rgba(212,134,10,0.45)] py-3 items-center justify-center flex-row gap-2"
            activeOpacity={0.88}
          >
            <BookOpen color="#D4860A" size={18} />
            <Text className="text-brand-amber text-sm font-['MontserratAlternates-SemiBold']">
              View Tours
            </Text>
          </TouchableOpacity>

          {/* Historical Overview */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(400)}
            className="rounded-2xl bg-surface-1 border border-white/[0.08] p-4"
          >
            <Text className="text-parchment text-lg font-['MontserratAlternates-SemiBold'] mb-2">
              Historical Overview
            </Text>
            <Text
              className="text-parchment-muted text-sm leading-[22px] font-['MontserratAlternates-Regular']"
              numberOfLines={isDescriptionExpanded ? undefined : 3}
            >
              {description}
            </Text>
            {description.length > 120 && (
              <TouchableOpacity
                onPress={() => setIsDescriptionExpanded(prev => !prev)}
                className="mt-2.5 flex-row items-center gap-1 self-start"
                accessibilityRole="button"
              >
                <Text className="text-brand-gold text-xs uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold']">
                  {isDescriptionExpanded ? 'Show Less' : 'Read More'}
                </Text>
                {isDescriptionExpanded ? (
                  <ChevronUp color="#C9A84C" size={16} />
                ) : (
                  <ChevronDown color="#C9A84C" size={16} />
                )}
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Personalized Insights */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <View className="flex-row items-center gap-1.5 mb-3">
              <Sparkles color="#C9A84C" size={18} />
              <Text className="text-parchment text-lg font-['MontserratAlternates-SemiBold']">
                Insights
              </Text>
            </View>

            {factsLoading ? (
              <View className="rounded-2xl bg-surface-1 border border-white/[0.08] p-5 items-center">
                <ThinkingDots messages={FACT_LOADING_LINES} color="#C9A84C" />
              </View>
            ) : facts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 20, gap: 12 }}
              >
                {facts.map(fact => (
                  <TouchableOpacity
                    key={fact.id}
                    onPress={() => handleElaborateFact(fact)}
                    activeOpacity={0.86}
                    className="w-[240px] rounded-2xl bg-surface-1 border border-[rgba(201,168,76,0.28)] p-3.5"
                  >
                    <Text className="text-parchment text-[15px] leading-[22px] font-['MontserratAlternates-SemiBold'] mb-1.5">
                      {fact.headline}
                    </Text>
                    <Text className="text-parchment-muted text-[13px] leading-[18px] font-['MontserratAlternates-Regular']">
                      {fact.summary}
                    </Text>

                    {expandedFactId === fact.id && (
                      <View className="mt-3 pt-3 border-t border-white/[0.08]">
                        {elaboratingFactId === fact.id ? (
                          <View className="items-center py-2">
                            <AnimatedLogo
                              size={16}
                              variant="white"
                              motion="pulse"
                              showRing={false}
                            />
                          </View>
                        ) : fact.detail ? (
                          <Text className="text-brand-goldSoft text-[13px] leading-[20px] font-['MontserratAlternates-Regular']">
                            {fact.detail}
                          </Text>
                        ) : null}
                      </View>
                    )}

                    <Text className="text-brand-gold text-[11px] mt-2 font-['MontserratAlternates-SemiBold']">
                      {expandedFactId === fact.id ? 'Collapse' : 'Learn more'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View className="rounded-2xl bg-surface-1 border border-white/[0.08] p-4">
                <Text className="text-parchment-dim text-sm text-center font-['MontserratAlternates-Regular']">
                  Insights will appear as you explore nearby monuments
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

export default SiteDetailScreen;
