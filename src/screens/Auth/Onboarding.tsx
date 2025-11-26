import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  TouchableOpacity,
  FlatList,
  ViewToken,
} from 'react-native';
import React, { useRef, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import { Button } from '../../components/ui';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../constants/theme';
import { Eye, MapPin, Shield, Sparkles } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  navigation: NavigationProp<any>;
}

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  backgroundColor: string;
}

const onboardingData: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Discover History',
    description:
      'Explore historical sites and monuments with immersive AR experiences that bring the past to life.',
    icon: <Eye size={80} color={Colors.text} />,
    backgroundColor: Colors.accent,
  },
  {
    id: '2',
    title: 'Navigate with Ease',
    description:
      'Find historic locations near you with precise GPS navigation and personalized recommendations.',
    icon: <MapPin size={80} color={Colors.text} />,
    backgroundColor: Colors.secondary,
  },
  {
    id: '3',
    title: 'Safe & Secure',
    description:
      'Your privacy matters. We protect your data with industry-leading security measures.',
    icon: <Shield size={80} color={Colors.text} />,
    backgroundColor: Colors.success,
  },
  {
    id: '4',
    title: 'Personalized Experience',
    description:
      'Get tailored content based on your interests and explore history your way.',
    icon: <Sparkles size={80} color={Colors.text} />,
    backgroundColor: Colors.warning,
  },
];

const Onboarding: React.FC<Props> = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);

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
    if (currentIndex < onboardingData.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = () => {
    handleGetStarted();
  };

  const handleGetStarted = () => {
    // Navigate to Register or Login screen
    navigation.navigate('Register');
  };

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        {onboardingData.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, currentIndex === index && styles.dotActive]}
            accessibilityLabel={`Page ${index + 1} of ${onboardingData.length}`}
          />
        ))}
      </View>
    );
  };

  const renderItem = ({ item }: { item: OnboardingSlide }) => {
    return (
      <View style={styles.slide}>
        <View style={styles.contentContainer}>
          {/* Icon Container */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: item.backgroundColor },
            ]}
          >
            {item.icon}
          </View>

          {/* Text Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.wrapper}>
        {/* Skip Button */}
        {currentIndex < onboardingData.length - 1 && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}

        {/* Carousel */}
        <FlatList
          ref={flatListRef}
          data={onboardingData}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          bounces={false}
          scrollEventThrottle={32}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />

        {/* Bottom Section */}
        <View style={styles.bottomContainer}>
          {/* Progress Dots */}
          {renderDots()}

          {/* Action Buttons */}
          <View style={styles.buttonsContainer}>
            {currentIndex === onboardingData.length - 1 ? (
              <Button
                title="Get Started"
                onPress={handleGetStarted}
                fullWidth
                size="large"
              />
            ) : (
              <Button
                title="Next"
                onPress={handleNext}
                fullWidth
                size="large"
              />
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Onboarding;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  wrapper: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: Spacing.xl,
    right: Spacing.lg,
    zIndex: 10,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.secondary,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.lg * Typography.lineHeight.relaxed,
    paddingHorizontal: Spacing.md,
  },
  bottomContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xs,
  },
  dotActive: {
    width: 30,
    backgroundColor: Colors.secondary,
  },
  buttonsContainer: {
    width: '100%',
  },
});
