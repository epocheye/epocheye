import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Heart,
  Share2,
  MapPin,
  Clock,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Demo data for a monument
const DEMO_SITE = {
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
    "Humayun's Tomb is a UNESCO World Heritage Site and the tomb of the Mughal Emperor Humayun. It was commissioned by his first wife and chief consort, Empress Bega Begum, in 1558.",
  fullDescription:
    "Humayun's Tomb is a UNESCO World Heritage Site and the tomb of the Mughal Emperor Humayun. It was commissioned by his first wife and chief consort, Empress Bega Begum, in 1558, and designed by Mirak Mirza Ghiyas and his son, Sayyid Muhammad, Persian architects chosen by Bega Begum.\n\nThe tomb was the first garden-tomb on the Indian subcontinent, and is located in Nizamuddin East, Delhi, India, close to the Dina-panah Citadel, also known as Purana Qila (Old Fort), that Humayun founded in 1533.\n\nThe tomb was declared a UNESCO World Heritage Site in 1993, and since then has undergone extensive restoration work, which is complete. Besides the main tomb enclosure of Humayun, several smaller monuments dot the pathway leading up to it, from the main entrance in the West.",
  funFacts: [
    {
      id: 'fact-1',
      icon: 'star',
      title: 'Inspiration for Taj Mahal',
      description:
        'This tomb inspired the design of the Taj Mahal, built 70 years later.',
    },
    {
      id: 'fact-2',
      icon: 'compass',
      title: 'Perfect Symmetry',
      description:
        'The tomb is perfectly symmetrical on all four sides, a rare architectural feat.',
    },
    {
      id: 'fact-3',
      icon: 'flower',
      title: 'Char Bagh Garden',
      description:
        'The Persian-style garden is divided into 36 square plots by water channels.',
    },
  ],
  visitorTips: [
    'Best visited during early morning or late afternoon for softer light.',
    'Carry water during summer months as it can get very hot.',
    'Hire a local guide for deeper historical insights.',
    'Photography is allowed; tripods need special permission.',
    'Combine with a visit to nearby Nizamuddin Dargah.',
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
    {
      id: 'related-3',
      name: 'Red Fort',
      location: 'Delhi, India',
      image:
        'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=400&q=80',
      distance: '5 km',
    },
  ],
  rating: 4.8,
  reviews: 2847,
};

interface SiteDetailScreenProps {
  navigation: any;
  route: any;
}

const SiteDetailScreen: React.FC<SiteDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const site = route.params?.site || DEMO_SITE;
  const { toggleSavePlace, isPlaceSaved } = usePlaces();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check if this place is saved
  const isSaved = isPlaceSaved(site.id);

  const handleToggleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      // Pass the full site data when saving
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
  };

  const handleStartARExperience = useCallback(() => {
    navigation.navigate('ARExperience', { site });
  }, [navigation, site]);

  const handleImageScroll = (event: any) => {
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / SCREEN_WIDTH);
    setCurrentImageIndex(index);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#070709]" edges={['top']}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero Image Gallery */}
        <View className="relative">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleImageScroll}
          >
            {site.heroImages.map((image: string, index: number) => (
              <Image
                key={index}
                source={{ uri: image }}
                className="w-screen h-72"
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {/* Gradient Overlay */}
          <View className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

          {/* Header Controls */}
          <View className="absolute top-4 left-5 right-5 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-11 h-11 rounded-full bg-black/40 items-center justify-center"
            >
              <ArrowLeft color="#FFFFFF" size={22} />
            </TouchableOpacity>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setIsLiked(!isLiked)}
                className="w-11 h-11 rounded-full bg-black/40 items-center justify-center"
              >
                <Heart
                  color={isLiked ? '#EF4444' : '#FFFFFF'}
                  size={22}
                  fill={isLiked ? '#EF4444' : 'transparent'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleToggleSave}
                disabled={isSaving}
                className="w-11 h-11 rounded-full bg-black/40 items-center justify-center"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFB347" />
                ) : (
                  <Bookmark
                    color={isSaved ? '#FFB347' : '#FFFFFF'}
                    size={22}
                    fill={isSaved ? '#FFB347' : 'transparent'}
                  />
                )}
              </TouchableOpacity>
              <TouchableOpacity className="w-11 h-11 rounded-full bg-black/40 items-center justify-center">
                <Share2 color="#FFFFFF" size={22} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Image Pagination */}
          <View className="absolute bottom-4 left-0 right-0 flex-row items-center justify-center gap-2">
            {site.heroImages.map((_: string, index: number) => (
              <View
                key={index}
                className={`h-2 rounded-full ${
                  currentImageIndex === index
                    ? 'w-6 bg-white'
                    : 'w-2 bg-white/50'
                }`}
              />
            ))}
          </View>
        </View>

        {/* Content */}
        <View className="px-5 -mt-6 relative z-10">
          {/* Main Info Card */}
          <View className="bg-[#12121A] rounded-3xl p-5 border border-[#272730]">
            {/* Tags */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              <View className="bg-[#FF7A18]/20 rounded-full px-3 py-1">
                <Text className="text-[#FF7A18] text-xs font-montserrat-semibold">
                  {site.era}
                </Text>
              </View>
              <View className="bg-[#3B82F6]/20 rounded-full px-3 py-1">
                <Text className="text-[#3B82F6] text-xs font-montserrat-semibold">
                  {site.style}
                </Text>
              </View>
              <View className="bg-[#10B981]/20 rounded-full px-3 py-1">
                <Text className="text-[#10B981] text-xs font-montserrat-semibold">
                  UNESCO Heritage
                </Text>
              </View>
            </View>

            {/* Title */}
            <Text className="text-white text-2xl font-montserrat-bold mb-2">
              {site.name}
            </Text>

            {/* Location */}
            <View className="flex-row items-center mb-4">
              <MapPin color="#8D8D92" size={16} />
              <Text className="text-[#8D8D92] text-sm font-montserrat-medium ml-2">
                {site.location}
              </Text>
            </View>

            {/* Rating */}
            <View className="flex-row items-center mb-4">
              <Star color="#FFB347" size={18} fill="#FFB347" />
              <Text className="text-white text-base font-montserrat-semibold ml-2">
                {site.rating}
              </Text>
              <Text className="text-[#8D8D92] text-sm font-montserrat-medium ml-2">
                ({site.reviews.toLocaleString()} reviews)
              </Text>
            </View>

            {/* Distance & Time */}
            <View className="flex-row items-center gap-6">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-[#1F1F2A] items-center justify-center">
                  <Navigation color="#FF7A18" size={18} />
                </View>
                <View className="ml-3">
                  <Text className="text-white text-base font-montserrat-semibold">
                    {site.distance}
                  </Text>
                  <Text className="text-[#8D8D92] text-xs font-montserrat-medium">
                    Distance
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-[#1F1F2A] items-center justify-center">
                  <Clock color="#3B82F6" size={18} />
                </View>
                <View className="ml-3">
                  <Text className="text-white text-base font-montserrat-semibold">
                    {site.estimatedTime}
                  </Text>
                  <Text className="text-[#8D8D92] text-xs font-montserrat-medium">
                    Est. Tour
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="mt-5">
            <TouchableOpacity
              onPress={handleStartARExperience}
              className="bg-[#FF7A18] rounded-2xl py-4 flex-row items-center justify-center"
            >
              <Camera color="#FFFFFF" size={20} />
              <Text className="text-white text-base font-montserrat-semibold ml-2">
                Start AR Experience
              </Text>
            </TouchableOpacity>
          </View>

          {/* Historical Summary */}
          <View className="bg-[#12121A] rounded-3xl p-5 border border-[#272730] mt-5">
            <Text className="text-white text-lg font-montserrat-semibold mb-3">
              About
            </Text>
            <Text className="text-[#B4B4BA] text-sm font-montserrat-regular leading-6">
              {isDescriptionExpanded
                ? site.fullDescription
                : site.shortDescription}
            </Text>
            <TouchableOpacity
              onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              className="flex-row items-center mt-3"
            >
              <Text className="text-[#FF7A18] text-sm font-montserrat-semibold mr-1">
                {isDescriptionExpanded ? 'Read Less' : 'Read More'}
              </Text>
              {isDescriptionExpanded ? (
                <ChevronUp color="#FF7A18" size={18} />
              ) : (
                <ChevronDown color="#FF7A18" size={18} />
              )}
            </TouchableOpacity>
          </View>

          {/* Fun Facts */}
          <View className="mt-5">
            <View className="flex-row items-center mb-4">
              <Lightbulb color="#FFB347" size={22} />
              <Text className="text-white text-lg font-montserrat-semibold ml-2">
                Fun Facts
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 20 }}
              style={{ marginHorizontal: -20, paddingLeft: 20 }}
            >
              {site.funFacts.map((fact: any) => (
                <View
                  key={fact.id}
                  className="w-64 bg-[#12121A] rounded-2xl p-4 mr-4 border border-[#272730]"
                >
                  <View className="w-10 h-10 rounded-full bg-[#FF7A18]/20 items-center justify-center mb-3">
                    <Star color="#FF7A18" size={20} />
                  </View>
                  <Text className="text-white text-base font-montserrat-semibold mb-2">
                    {fact.title}
                  </Text>
                  <Text className="text-[#8D8D92] text-sm font-montserrat-regular leading-5">
                    {fact.description}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Visitor Tips */}
          <View className="bg-[#12121A] rounded-3xl p-5 border border-[#272730] mt-5">
            <View className="flex-row items-center mb-4">
              <Users color="#10B981" size={22} />
              <Text className="text-white text-lg font-montserrat-semibold ml-2">
                Visitor Tips
              </Text>
            </View>
            {site.visitorTips.map((tip: string, index: number) => (
              <View key={index} className="flex-row items-start mb-3 last:mb-0">
                <View className="w-6 h-6 rounded-full bg-[#10B981]/20 items-center justify-center mt-0.5">
                  <Text className="text-[#10B981] text-xs font-montserrat-semibold">
                    {index + 1}
                  </Text>
                </View>
                <Text className="text-[#B4B4BA] text-sm font-montserrat-regular ml-3 flex-1 leading-5">
                  {tip}
                </Text>
              </View>
            ))}
          </View>

          {/* Related Sites */}
          <View className="mt-5 mb-8">
            <Text className="text-white text-lg font-montserrat-semibold mb-4">
              Related Sites
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 20 }}
              style={{ marginHorizontal: -20, paddingLeft: 20 }}
            >
              {site.relatedSites.map((related: any) => (
                <TouchableOpacity
                  key={related.id}
                  className="w-44 mr-4"
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: related.image }}
                    className="w-full h-28 rounded-2xl mb-2"
                    resizeMode="cover"
                  />
                  <Text className="text-white text-sm font-montserrat-semibold">
                    {related.name}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <MapPin color="#8D8D92" size={12} />
                    <Text className="text-[#8D8D92] text-xs font-montserrat-medium ml-1">
                      {related.distance}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SiteDetailScreen;
