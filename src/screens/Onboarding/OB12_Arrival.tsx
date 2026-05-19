import React, {useEffect, useRef} from 'react';
import {View, Text, Image, StatusBar, Dimensions} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ConfettiCannon from 'react-native-confetti-cannon';
import {FONTS, CDN_BASE} from '../../core/constants/theme';
import {BACKEND_URL} from '../../constants/onboarding';
import {useOnboardingStore} from '../../stores/onboardingStore';
import {useOnboardingComplete} from '../../context/OnboardingCallbackContext';
import {track} from '../../services/analytics';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSkipLink from '../../components/onboarding/OBSkipLink';
import {getValidAccessToken} from '../../utils/api/auth';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB12_Arrival'>;

const SCREEN_WIDTH = Dimensions.get('window').width;

const OB12_Arrival: React.FC<Props> = () => {
  const firstName = useOnboardingStore(s => s.firstName);
  const region = useOnboardingStore(s => s.region);
  const completeOnboarding = useOnboardingStore(s => s.completeOnboarding);
  const onOnboardingComplete = useOnboardingComplete();
  const insets = useSafeAreaInsets();
  const confettiRef = useRef<ConfettiCannon | null>(null);
  const hasCompleted = useRef(false);

  const h1O = useSharedValue(0);
  const h1Y = useSharedValue(20);
  const h2O = useSharedValue(0);
  const h2Y = useSharedValue(20);
  const cardO = useSharedValue(0);
  const cardScale = useSharedValue(0.95);
  const ctaO = useSharedValue(0);
  const ctaY = useSharedValue(20);

  useEffect(() => {
    if (hasCompleted.current) {
      return;
    }
    hasCompleted.current = true;

    completeOnboarding();
    track('onboarding_completed');

    (async () => {
      try {
        const token = await getValidAccessToken();
        if (token) {
          const state = useOnboardingStore.getState();
          await fetch(`${BACKEND_URL}/api/user/onboarding-data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              firstName: state.firstName,
              region: state.region,
            }),
          });
        }
      } catch {}
    })();

    confettiRef.current?.start();

    h1O.value = withDelay(500, withTiming(1, {duration: 500}));
    h1Y.value = withDelay(500, withSpring(0, {damping: 18, stiffness: 120}));
    h2O.value = withDelay(1000, withTiming(1, {duration: 500}));
    h2Y.value = withDelay(1000, withSpring(0, {damping: 18, stiffness: 120}));
    cardO.value = withDelay(1600, withTiming(1, {duration: 500}));
    cardScale.value = withDelay(1600, withSpring(1, {damping: 14, stiffness: 100}));
    ctaO.value = withDelay(2200, withTiming(1, {duration: 500}));
    ctaY.value = withDelay(2200, withSpring(0, {damping: 16, stiffness: 120}));
  }, [completeOnboarding, h1O, h1Y, h2O, h2Y, cardO, cardScale, ctaO, ctaY]);

  const s1 = useAnimatedStyle(() => ({
    opacity: h1O.value,
    transform: [{translateY: h1Y.value}],
  }));
  const s2 = useAnimatedStyle(() => ({
    opacity: h2O.value,
    transform: [{translateY: h2Y.value}],
  }));
  const sCard = useAnimatedStyle(() => ({
    opacity: cardO.value,
    transform: [{scale: cardScale.value}],
  }));
  const sCta = useAnimatedStyle(() => ({
    opacity: ctaO.value,
    transform: [{translateY: ctaY.value}],
  }));

  const monumentImage = `${CDN_BASE}monuments/Konarka_Temple-2.jpg`;
  void region;

  return (
    <View className="flex-1 bg-ob-bgDeep">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <View
        className="flex-1 justify-between"
        style={{paddingBottom: insets.bottom + 24}}>
        <View className="flex-1 items-center justify-center px-[28px]">
          <Animated.Text
            className="text-[30px] leading-[38px] font-montserrat-extrabold text-parchment text-center mb-4"
            style={s1}>
            {firstName || 'Explorer'},{'\n'}your lineage is ready.
          </Animated.Text>

          <Animated.Text
            className="text-grey-muted text-[15px] text-center mx-5 font-montserrat leading-[23px]"
            style={s2}>
            Head to any heritage site and your ancestor will be waiting.
          </Animated.Text>

          <Animated.View
            className="h-[180px] rounded-[18px] overflow-hidden mt-8 bg-grey-subtle border border-[rgba(232,160,32,0.2)]"
            style={[sCard, {width: SCREEN_WIDTH - 56}]}>
            <Image
              source={{uri: monumentImage}}
              className="absolute inset-0 w-full h-full"
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
            />
            <View className="absolute bottom-4 left-[18px] right-[18px]">
              <Text
                className="text-[10px] tracking-[1px] text-accent-amber font-montserrat-semibold mb-1">
                YOUR FIRST DESTINATION
              </Text>
              <Text
                className="text-parchment text-[17px] font-montserrat-bold">
                {'Explore nearby monuments'}
              </Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={sCta}>
          <OBPrimaryButton
            label={'Explore nearby  →'}
            onPress={() => onOnboardingComplete()}
          />
          <OBSkipLink
            label="Browse all monuments"
            onPress={() => onOnboardingComplete()}
          />
        </Animated.View>
      </View>

      <ConfettiCannon
        ref={confettiRef}
        count={60}
        origin={{x: SCREEN_WIDTH / 2, y: -10}}
        colors={['#E8A020', '#FFD700', '#FFFFFF', '#FFA500', '#D4860A']}
        autoStart={false}
        fadeOut
      />
    </View>
  );
};

export default OB12_Arrival;
