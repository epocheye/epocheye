import React, {useEffect} from 'react';
import {Image, StatusBar, Text, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {ROUTES} from '../../core/constants/routes';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB00_Splash'>;

const HOLD_DURATION_MS = 1600;

const OB00_Splash: React.FC<Props> = ({navigation}) => {
  const logoOpacity = useSharedValue(0);
  const wordmarkOpacity = useSharedValue(0);

  useEffect(() => {
    const goNext = () => navigation.replace(ROUTES.ONBOARDING.OB01_WELCOME);

    logoOpacity.value = withTiming(1, {duration: 700});
    wordmarkOpacity.value = withDelay(500, withTiming(1, {duration: 600}));

    const timer = setTimeout(() => runOnJS(goNext)(), HOLD_DURATION_MS + 900);
    return () => clearTimeout(timer);
  }, [navigation, logoOpacity, wordmarkOpacity]);

  const logoStyle = useAnimatedStyle(() => ({opacity: logoOpacity.value}));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
  }));

  return (
    <View className="flex-1 bg-ink-warm items-center justify-center">
      <StatusBar barStyle="light-content" translucent />

      <Animated.View className="w-[110px] h-[108px]" style={logoStyle}>
        <Image
          source={require('../../assets/images/logo-white.png')}
          className="w-full h-full"
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View className="absolute bottom-[88px] items-center" style={wordmarkStyle}>
        <Text className="font-ui-medium text-[36px] text-parchment tracking-[0.5px]">
          epocheye
        </Text>
      </Animated.View>
    </View>
  );
};

export default OB00_Splash;
