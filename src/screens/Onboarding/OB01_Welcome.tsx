import React, {useEffect} from 'react';
import {Image, Pressable, StatusBar, Text, View} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import {moderateScale} from '../../utils/scaling';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB01_Welcome'>;

const OB01_Welcome: React.FC<Props> = ({navigation}) => {
  const insets = useSafeAreaInsets();

  const headlineO = useSharedValue(0);
  const headlineY = useSharedValue(18);
  const ctaO = useSharedValue(0);
  const ctaY = useSharedValue(22);

  useEffect(() => {
    headlineO.value = withDelay(400, withTiming(1, {duration: 700}));
    headlineY.value = withDelay(
      400,
      withTiming(0, {duration: 700, easing: Easing.out(Easing.cubic)}),
    );
    ctaO.value = withDelay(900, withTiming(1, {duration: 500}));
    ctaY.value = withDelay(
      900,
      withTiming(0, {duration: 500, easing: Easing.out(Easing.cubic)}),
    );
  }, [headlineO, headlineY, ctaO, ctaY]);

  const sHeadline = useAnimatedStyle(() => ({
    opacity: headlineO.value,
    transform: [{translateY: headlineY.value}],
  }));
  const sCta = useAnimatedStyle(() => ({
    opacity: ctaO.value,
    transform: [{translateY: ctaY.value}],
  }));

  const onGetStarted = () => {
    navigation.navigate(ROUTES.ONBOARDING.OB03_REGION);
  };

  return (
    <View className="flex-1 bg-ink-warm">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <View className="h-[68%] w-full">
        <Image
          source={require('../../assets/images/onboarding.webp')}
          className="w-full h-full"
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(10,10,12,0.6)', '#131218']}
          locations={[0, 0.7, 1]}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '45%',
          }}
        />
      </View>

      <View className="flex-1 px-[28px] items-center justify-end pt-2">
        <Animated.View className="items-center mb-7" style={sHeadline}>
          <Text
            className="font-handwritten text-parchment"
            style={{fontSize: moderateScale(44), lineHeight: moderateScale(52)}}>
            It's time to
          </Text>
          <Text
            className="font-handwritten text-brand-lime"
            style={{
              fontSize: moderateScale(60),
              lineHeight: moderateScale(68),
              marginTop: -moderateScale(6),
            }}>
            Experience
          </Text>
        </Animated.View>

        <Animated.View className="w-full items-center" style={sCta}>
          <Pressable
            onPress={onGetStarted}
            className="w-full h-14 rounded-full bg-brand-sky items-center justify-center"
            style={({pressed}) =>
              pressed
                ? {transform: [{scale: 0.98}], backgroundColor: COLORS.skyDark}
                : undefined
            }
            accessibilityRole="button"
            accessibilityLabel="Get Started">
            <Text
              className="font-ui-medium text-ink tracking-[0.3px]"
              style={{fontSize: moderateScale(17)}}>
              Get Started
            </Text>
          </Pressable>
        </Animated.View>

        <Text
          className="mt-[18px] font-ui text-[11px] text-parchment-dim tracking-[0.4px]"
          style={{marginBottom: insets.bottom + 12}}>
          Copyright @ epocheye 2026
        </Text>
      </View>
    </View>
  );
};

export default OB01_Welcome;
