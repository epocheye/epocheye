import React, { useState, useCallback, useMemo } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Extrapolation,
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
  Lightbulb,
  Users,
  Star,
  Bookmark,
} from 'lucide-react-native';
import { usePlaces } from '../../context';
import ResolvedSubjectImage from '../../components/ui/ResolvedSubjectImage';
import { useResolvedSubjectImage } from '../../shared/hooks';
import type {
  MainScreenProps,
  PlaceNavParam,
} from '../../core/types/navigation.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 320;

interface FunFact {
  id: string;
  title: string;
  description: string;
}

interface RelatedSite {
  id: string;
  name: string;
  location: string;
  image: string;
  distance: string;
}

interface SiteDetailData extends PlaceNavParam {
  location: string;
  era: string;
  style: string;
  yearBuilt: string;
  distance: string;
  estimatedTime: string;
  heroImages: string[];
  shortDescription: string;
  fullDescription: string;
  funFacts: FunFact[];
  visitorTips: string[];
  relatedSites: RelatedSite[];
  rating: number;
  reviews: number;
  address_line1?: string;
}

const DEMO_SITE: SiteDetailData = {
  id: 'humayuns-tomb',
  name: "Humayun's Tomb",
  location: 'Nizamuddin East, Delhi, India',
  era: 'Mughal Era',
  style: 'Persian-Mughal Architecture',
  yearBuilt: '1570 CE',
  distance: '2.4 km',
  estimatedTime: '45 min',
  heroImages: [
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1585135497273-1a86b09fe70e?auto=format&fit=crop&w=1200&q=80',
  ],
  shortDescription:
    "Humayun's Tomb is a UNESCO World Heritage Site and the tomb of the Mughal Emperor Humayun.",
  fullDescription:
    "Humayun's Tomb is a UNESCO World Heritage Site and the tomb of the Mughal Emperor Humayun. It was commissioned by Empress Bega Begum and designed by Persian architects Mirak Mirza Ghiyas and Sayyid Muhammad.\n\nIt was the first garden-tomb on the Indian subcontinent and became an architectural inspiration for later wonders, including the Taj Mahal.",
  funFacts: [
    {
      id: 'fact-1',
      title: 'Inspiration for Taj Mahal',
      description:
        'Its form and garden layout inspired the Taj Mahal decades later.',
    },
    {
      id: 'fact-2',
      title: 'Perfect Symmetry',
      description:
        'The tomb achieves exceptional symmetry in all four elevations.',
    },
    {
      id: 'fact-3',
      title: 'Char Bagh Garden',
      description:
        'The surrounding Persian garden is divided by water channels.',
    },
  ],
  visitorTips: [
    'Best visited in early morning or late afternoon for softer light.',
    'Carry water and comfortable footwear for long walking paths.',
    'Hire a local guide for richer stories and context.',
    'Photography is allowed; check policy for tripods.',
  ],
  relatedSites: [
    {
      id: 'related-1',
      name: 'Taj Mahal',
      location: 'Agra, India',
      image:
        'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=400&q=80',
      distance: '210 km',
    },
    {
      id: 'related-2',
      name: 'Qutub Minar',
      location: 'Delhi, India',
      image:
        'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=400&q=80',
      distance: '12 km',
    },
  ],
  rating: 4.8,
  reviews: 2847,
};

function normalizeSite(site?: PlaceNavParam): SiteDetailData {
  if (!site) {
    return DEMO_SITE;
  }

  return {
    ...DEMO_SITE,
    ...site,
    location:
      typeof site.formatted === 'string' && site.formatted.length > 0
        ? site.formatted
        : DEMO_SITE.location,
    heroImages:
      Array.isArray(site.heroImages) && site.heroImages.length > 0
        ? site.heroImages.filter(
            (img): img is string => typeof img === 'string',
          )
        : DEMO_SITE.heroImages,
  };
}

type Props = MainScreenProps<'SiteDetail'>;

const SiteDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { toggleSavePlace, isPlaceSaved } = usePlaces();
  const site = useMemo(
    () => normalizeSite(route.params?.site),
    [route.params?.site],
  );

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { url: resolvedHeroImage } = useResolvedSubjectImage({
    subject: site.name,
    context: `${site.location} ${site.era} ${site.style}`,
    enabled: !!site.name,
  });
  const heroImages = useMemo(() => {
    const existing = site.heroImages;
    if (!resolvedHeroImage) {
      return existing;
    }

    if (existing.includes(resolvedHeroImage)) {
      return existing;
    }

    return [resolvedHeroImage, ...existing];
  }, [resolvedHeroImage, site.heroImages]);

  const scrollY = useSharedValue(0);
  const isSaved = isPlaceSaved(site.id);

  const onScroll = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });

  const stickyHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [100, 180],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
    };
  });

  const handleToggleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await toggleSavePlace(site.id, {
        id: site.id,
        name: site.name,
        lat: site.lat,
        lon: site.lon,
        city: site.city,
        country: site.country,
        formatted: site.location,
        address_line1: site.address_line1 || site.location,
        address_line2: '',
        state: '',
        postcode: '',
        street: '',
        distance_meters: 0,
        categories: [site.era, site.style].filter(Boolean),
      });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, site, toggleSavePlace]);

  const handleStartARExperience = useCallback(() => {
    navigation.navigate('ARExperience', { site });
  }, [navigation, site]);

  const handleImageScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.x;
      setCurrentImageIndex(Math.round(offset / SCREEN_WIDTH));
    },
    [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <Animated.View style={[styles.stickyHeader, stickyHeaderStyle]}>
        <Text numberOfLines={1} style={styles.stickyTitle}>
          {site.name}
        </Text>
      </Animated.View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroWrap}>
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
                style={styles.heroImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          <LinearGradient
            colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.65)']}
            style={styles.heroOverlay}
          />

          <View style={styles.heroHeaderControls}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.heroIconButton}
            >
              <ArrowLeft color="#F5F0E8" size={20} />
            </TouchableOpacity>

            <View style={styles.heroRightActions}>
              <TouchableOpacity
                onPress={() => setIsLiked(prev => !prev)}
                style={styles.heroIconButton}
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
                style={styles.heroIconButton}
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
              <TouchableOpacity style={styles.heroIconButton}>
                <Share2 color="#F5F0E8" size={20} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroFooter}>
            <Text style={styles.heroKicker}>Heritage Landmark</Text>
            <Text style={styles.heroTitle}>{site.name}</Text>
            <View style={styles.heroLocationRow}>
              <MapPin color="#B8AF9E" size={14} />
              <Text numberOfLines={1} style={styles.heroLocationText}>
                {site.location}
              </Text>
            </View>

            <View style={styles.heroDots}>
              {heroImages.map((_, index) => (
                <View
                  key={`dot-${index}`}
                  style={[
                    styles.heroDot,
                    currentImageIndex === index ? styles.heroDotActive : null,
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.contentWrap}>
          <View style={styles.infoCard}>
            <View style={styles.tagRow}>
              <View style={styles.primaryTag}>
                <Text style={styles.primaryTagText}>{site.era}</Text>
              </View>
              <View style={styles.secondaryTag}>
                <Text style={styles.secondaryTagText}>{site.style}</Text>
              </View>
              <View style={styles.tertiaryTag}>
                <Text style={styles.tertiaryTagText}>{site.yearBuilt}</Text>
              </View>
            </View>

            <View style={styles.ratingRow}>
              <Star color="#C9A84C" fill="#C9A84C" size={16} />
              <Text style={styles.ratingText}>{site.rating.toFixed(1)}</Text>
              <Text style={styles.reviewText}>
                ({site.reviews.toLocaleString()} reviews)
              </Text>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <View style={styles.metaIconWrap}>
                  <Navigation color="#C9A84C" size={16} />
                </View>
                <View>
                  <Text style={styles.metaValue}>{site.distance}</Text>
                  <Text style={styles.metaLabel}>Distance</Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <View style={styles.metaIconWrap}>
                  <Clock3 color="#C9A84C" size={16} />
                </View>
                <View>
                  <Text style={styles.metaValue}>{site.estimatedTime}</Text>
                  <Text style={styles.metaLabel}>Tour Time</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleStartARExperience}
            style={styles.ctaButton}
            activeOpacity={0.88}
          >
            <Camera color="#0A0A0A" size={18} />
            <Text style={styles.ctaText}>Begin Your Journey</Text>
          </TouchableOpacity>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Historical Overview</Text>
            <Text
              style={styles.sectionBody}
              numberOfLines={isDescriptionExpanded ? undefined : 3}
            >
              {isDescriptionExpanded
                ? site.fullDescription
                : site.shortDescription}
            </Text>
            <TouchableOpacity
              onPress={() => setIsDescriptionExpanded(prev => !prev)}
              style={styles.expandButton}
              accessibilityRole="button"
              accessibilityLabel={
                isDescriptionExpanded
                  ? 'Collapse description'
                  : 'Expand description'
              }
            >
              <Text style={styles.expandButtonText}>
                {isDescriptionExpanded ? 'Show Less' : 'Read More'}
              </Text>
              {isDescriptionExpanded ? (
                <ChevronUp color="#C9A84C" size={16} />
              ) : (
                <ChevronDown color="#C9A84C" size={16} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeadingRow}>
              <Lightbulb color="#C9A84C" size={18} />
              <Text style={styles.sectionHeading}>Fun Facts</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalContent}
            >
              {site.funFacts.map(fact => (
                <View key={fact.id} style={styles.factCard}>
                  <Text style={styles.factTitle}>{fact.title}</Text>
                  <Text style={styles.factDescription}>{fact.description}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <Users color="#C9A84C" size={18} />
              <Text style={styles.sectionHeading}>Visitor Tips</Text>
            </View>
            {site.visitorTips.map((tip, index) => (
              <View key={`${tip}-${index}`} style={styles.tipRow}>
                <View style={styles.tipIndexPill}>
                  <Text style={styles.tipIndexText}>{index + 1}</Text>
                </View>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeading}>Related Sites</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalContent}
            >
              {site.relatedSites.map(related => (
                <TouchableOpacity
                  key={related.id}
                  style={styles.relatedCard}
                  activeOpacity={0.86}
                >
                  <ResolvedSubjectImage
                    subject={related.name}
                    context={`${related.location} related heritage site`}
                    fallbackUri={related.image}
                    style={styles.relatedImage}
                    imageStyle={styles.relatedImage}
                    loadingLabel="Loading related site..."
                  />
                  <Text style={styles.relatedTitle} numberOfLines={1}>
                    {related.name}
                  </Text>
                  <Text style={styles.relatedLocation} numberOfLines={1}>
                    {related.location}
                  </Text>
                  <Text style={styles.relatedDistance}>{related.distance}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = {
  safe: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    height: 56,
    backgroundColor: 'rgba(10,10,10,0.94)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 56,
  },
  stickyTitle: {
    color: '#F5F0E8',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroWrap: {
    height: HERO_HEIGHT,
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  heroHeaderControls: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  heroIconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFooter: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
  },
  heroKicker: {
    color: '#C9A84C',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  heroTitle: {
    color: '#F5F0E8',
    fontSize: 28,
    lineHeight: 36,
    fontFamily: 'MontserratAlternates-Bold',
    marginTop: 4,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  heroLocationText: {
    color: '#B8AF9E',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    fontFamily: 'MontserratAlternates-Medium',
  },
  heroDots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  heroDotActive: {
    width: 22,
    backgroundColor: '#C9A84C',
  },
  contentWrap: {
    marginTop: -24,
    paddingHorizontal: 20,
    gap: 16,
  },
  infoCard: {
    borderRadius: 20,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  primaryTag: {
    borderRadius: 999,
    backgroundColor: 'rgba(201,168,76,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  primaryTagText: {
    color: '#E8C870',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  secondaryTag: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  secondaryTagText: {
    color: '#F5F0E8',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  tertiaryTag: {
    borderRadius: 999,
    backgroundColor: 'rgba(92,155,224,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tertiaryTagText: {
    color: '#9DC6F1',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  ratingText: {
    color: '#F5F0E8',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  reviewText: {
    color: '#B8AF9E',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'MontserratAlternates-Regular',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: '#1C1C1C',
    padding: 12,
  },
  metaIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(201,168,76,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaValue: {
    color: '#F5F0E8',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  metaLabel: {
    color: '#6B6357',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'MontserratAlternates-Regular',
  },
  ctaButton: {
    borderRadius: 12,
    backgroundColor: '#C9A84C',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaText: {
    color: '#0A0A0A',
    fontSize: 15,
    lineHeight: 22,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'MontserratAlternates-Bold',
  },
  sectionWrap: {
    gap: 12,
  },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
  },
  sectionTitle: {
    color: '#F5F0E8',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'MontserratAlternates-SemiBold',
    marginBottom: 8,
  },
  sectionBody: {
    color: '#B8AF9E',
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'MontserratAlternates-Regular',
  },
  expandButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  expandButtonText: {
    color: '#C9A84C',
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeading: {
    color: '#F5F0E8',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  horizontalContent: {
    paddingRight: 20,
    gap: 12,
  },
  factCard: {
    width: 240,
    borderRadius: 16,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.28)',
    padding: 14,
  },
  factTitle: {
    color: '#F5F0E8',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'MontserratAlternates-SemiBold',
    marginBottom: 6,
  },
  factDescription: {
    color: '#B8AF9E',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'MontserratAlternates-Regular',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
  },
  tipIndexPill: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(201,168,76,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tipIndexText: {
    color: '#E8C870',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  tipText: {
    flex: 1,
    color: '#B8AF9E',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'MontserratAlternates-Regular',
  },
  relatedCard: {
    width: 166,
    borderRadius: 12,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 8,
  },
  relatedImage: {
    width: '100%',
    height: 92,
    borderRadius: 8,
    marginBottom: 8,
  },
  relatedTitle: {
    color: '#F5F0E8',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  relatedLocation: {
    color: '#B8AF9E',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'MontserratAlternates-Regular',
    marginTop: 2,
  },
  relatedDistance: {
    color: '#C9A84C',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'MontserratAlternates-SemiBold',
    marginTop: 6,
  },
};

export default SiteDetailScreen;
