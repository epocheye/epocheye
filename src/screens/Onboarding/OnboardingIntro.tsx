import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  ViewToken,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Eye,
  Clock,
  Trophy,
  Users,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingIntroProps {
  onComplete: () => void;
}

interface IntroSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  illustration?: string;
}

const INTRO_SLIDES: IntroSlide[] = [
  {
    id: 'discover',
    title: 'Discover Monuments',
    subtitle: 'Explore History Around You',
    description:
      'Find historic sites, temples, and heritage monuments near you. Get detailed information, visitor tips, and fascinating stories.',
    icon: <Eye color="#FFFFFF" size={48} />,
    iconBg: '#FF7A18',
    illustration:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'timetravel',
    title: 'Time Travel & AR',
    subtitle: 'Step Into the Past',
    description:
      'Experience monuments as they looked centuries ago. Use AR to visualize history and unlock hidden stories through your camera.',
    icon: <Clock color="#FFFFFF" size={48} />,
    iconBg: '#8B5CF6',
    illustration:
      'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'badges',
    title: 'Earn Badges',
    subtitle: 'Collect Achievements',
    description:
      'Complete challenges, visit sites, and unlock exclusive badges. Track your heritage journey and become a history explorer.',
    icon: <Trophy color="#FFFFFF" size={48} />,
    iconBg: '#10B981',
    illustration:
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'community',
    title: 'Join the Community',
    subtitle: 'Connect & Share',
    description:
      'Share your discoveries, join local heritage groups, and connect with fellow history enthusiasts. Your journey inspires others.',
    icon: <Users color="#FFFFFF" size={48} />,
    iconBg: '#3B82F6',
    illustration:
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80',
  },
];

const OnboardingIntro: React.FC<OnboardingIntroProps> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<IntroSlide>>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleNext = () => {
    if (currentIndex < INTRO_SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const renderSlide = ({ item }: { item: IntroSlide }) => (
    <View className="w-screen flex-1">
      {/* Illustration */}
      <View className="h-[45%] relative">
        {item.illustration && (
          <Image
            source={{ uri: item.illustration }}
            className="w-full h-full"
            resizeMode="cover"
          />
        )}
        <View className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#070709]" />

        {/* Icon Badge */}
        <View
          className="absolute bottom-6 left-6 w-20 h-20 rounded-3xl items-center justify-center shadow-lg"
          style={{ backgroundColor: item.iconBg }}
        >
          {item.icon}
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 px-6 pt-6">
        <Text className="text-[#FF7A18] text-sm font-montserrat-semibold uppercase tracking-widest mb-2">
          {item.subtitle}
        </Text>
        <Text className="text-white text-3xl font-montserrat-bold mb-4">
          {item.title}
        </Text>
        <Text className="text-[#A0A0A8] text-base font-montserrat-regular leading-7">
          {item.description}
        </Text>
      </View>
    </View>
  );

  const isLastSlide = currentIndex === INTRO_SLIDES.length - 1;

  return (
    <SafeAreaView className="flex-1 bg-[#070709]" edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Skip Button */}
      {!isLastSlide && (
        <TouchableOpacity
          onPress={handleSkip}
          className="absolute top-16 right-6 z-10 py-2 px-4"
        >
          <Text className="text-[#8D8D92] text-base font-montserrat-semibold">
            Skip
          </Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={INTRO_SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Bottom Controls */}
      <View className="px-6 pb-8">
        {/* Progress Dots */}
        <View className="flex-row items-center justify-center mb-6">
          {INTRO_SLIDES.map((_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full mx-1 ${
                currentIndex === index ? 'w-8 bg-[#FF7A18]' : 'w-2 bg-[#333340]'
              }`}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleNext}
          className="bg-[#FF7A18] rounded-2xl py-4 flex-row items-center justify-center"
        >
          <Text className="text-white text-lg font-montserrat-semibold mr-2">
            {isLastSlide ? 'Continue' : 'Next'}
          </Text>
          {isLastSlide ? (
            <Sparkles color="#FFFFFF" size={20} />
          ) : (
            <ChevronRight color="#FFFFFF" size={22} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default OnboardingIntro;
