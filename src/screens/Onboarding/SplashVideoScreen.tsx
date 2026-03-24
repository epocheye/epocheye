import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StatusBar, Animated } from 'react-native';
import Video, { OnProgressData } from 'react-native-video';
import GhostButton from '../../components/onboarding/GhostButton';
import { FONTS, COLORS, FONT_SIZES } from '../../core/constants/theme';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants/routes';

type Props = OnboardingScreenProps<'SplashVideo'>;

/**
 * Screen 1 — Full-bleed intro video.
 * At 3 seconds the hero text and "Begin" button fade in.
 * After video ends, auto-navigates if user hasn't tapped Begin.
 */
const SplashVideoScreen: React.FC<Props> = ({ navigation }) => {
  const [showOverlay, setShowOverlay] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hasNavigated = useRef(false);

  const navigateNext = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    navigation.navigate(ROUTES.ONBOARDING.HOOK);
  }, [navigation]);

  const handleProgress = useCallback(
    (data: OnProgressData) => {
      if (data.currentTime >= 3 && !showOverlay) {
        setShowOverlay(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      }
    },
    [showOverlay, fadeAnim],
  );

  const handleEnd = useCallback(() => {
    navigateNext();
  }, [navigateNext]);

  return (
    <View className="flex-1 bg-[#1A1612]">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <Video
        source={require('../../assets/video/epocheye_intro.mp4')}
        style={{ position: 'absolute', inset: 0 }}
        resizeMode="cover"
        muted
        repeat={false}
        playInBackground={false}
        onProgress={handleProgress}
        onEnd={handleEnd}
      />

      {showOverlay && (
        <Animated.View
          className="absolute inset-0 items-center justify-end px-6 pb-24"
          style={{ opacity: fadeAnim }}
        >
          <Text className="mb-8 text-center font-['MontserratAlternates-SemiBold'] text-[36px] leading-[44px] tracking-[0.3px] text-[#F5E9D8]">
            What if you could go back?
          </Text>
          <View className="w-full px-10">
            <GhostButton title="Begin" onPress={navigateNext} />
          </View>
        </Animated.View>
      )}
    </View>
  );
};

export default SplashVideoScreen;
