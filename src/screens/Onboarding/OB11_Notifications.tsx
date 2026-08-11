import React, {useCallback, useEffect, useRef} from 'react';
import {View, Text, StatusBar} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BellRing, MapPin, Sparkles} from 'lucide-react-native';
import {requestNotifications, RESULTS} from 'react-native-permissions';
import {fcmRegisterAfterPermission} from '../../services/fcmService';
import {BACKEND_URL, GOLD} from '../../constants/onboarding';
import {useOnboardingStore} from '../../stores/onboardingStore';
import {useOnboardingComplete} from '../../context/OnboardingCallbackContext';
import {track} from '../../services/analytics';
import {getValidAccessToken} from '../../utils/api/auth';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSkipLink from '../../components/onboarding/OBSkipLink';
import {AmbientGlow} from '../../components/ui/premium';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB11_Notifications'>;

const BENEFITS = [
  {icon: MapPin, text: "A gentle nudge when you're near a heritage site"},
  {icon: Sparkles, text: 'Never miss an AR experience around you'},
] as const;

const OB11_Notifications: React.FC<Props> = () => {
  const insets = useSafeAreaInsets();

  const completeOnboarding = useOnboardingStore(s => s.completeOnboarding);
  const onOnboardingComplete = useOnboardingComplete();
  const hasCompleted = useRef(false);

  // Entrance animation — one calm fade + rise for the whole content block.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withDelay(60, withTiming(1, {duration: 460}));
  }, [enter]);

  const sBell = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{scale: 0.92 + enter.value * 0.08}],
  }));
  const sBody = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{translateY: (1 - enter.value) * 16}],
  }));

  // All onboarding-completion side effects now live here (OB12 removed).
  // Guarded so a double tap can't fire the transition twice.
  const finishOnboarding = useCallback(() => {
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

    onOnboardingComplete();
  }, [completeOnboarding, onOnboardingComplete]);

  const handleEnable = useCallback(async () => {
    try {
      const {status} = await requestNotifications(['alert', 'badge', 'sound']);
      if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
        void fcmRegisterAfterPermission();
      }
    } catch {}
    finishOnboarding();
  }, [finishOnboarding]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <AmbientGlow height={360} />
      {/* Five interactive onboarding screens (Welcome → Region → Pull → SignUp
          → here); the splash isn't a step. The old 9-of-10 predated the flow
          being shortened and rendered a full bar over a stale total. */}
      <OBProgressBar current={4} total={5} />

      <View
        className="flex-1 justify-between"
        style={{paddingBottom: insets.bottom + 24}}>
        <View className="flex-1 items-center justify-center px-7">
          <Animated.View
            className="w-[120px] h-[120px] rounded-full items-center justify-center bg-[rgba(203,168,98,0.08)]"
            style={sBell}>
            <View className="w-[84px] h-[84px] rounded-full items-center justify-center bg-[rgba(203,168,98,0.12)]">
              <BellRing size={40} color={GOLD.primary} />
            </View>
          </Animated.View>

          {/* w-full matters: the benefit rows below size off this wrapper, and
              their labels are flex-1 (zero intrinsic width). Without it the
              wrapper shrink-wraps and the rows collapse to bare icon circles. */}
          <Animated.View className="mt-9 w-full items-center" style={sBody}>
            <Text className="text-[11px] tracking-[0.22em] uppercase text-brand-gold font-ui-semibold">
              One last thing
            </Text>
            <Text className="mt-3 text-[30px] leading-[38px] text-center text-parchment font-display">
              Stay close to{'\n'}history
            </Text>
            <Text className="mt-3 text-[14px] leading-[21px] text-center text-muted-foreground font-ui px-2">
              Turn on notifications and we'll let you know the moment a heritage
              site is near.
            </Text>

            <View className="mt-8 w-full gap-y-3">
              {BENEFITS.map(({icon: Icon, text}) => (
                <View
                  key={text}
                  className="flex-row items-center px-4 py-3.5 rounded-2xl bg-card border border-white/10">
                  <View className="w-10 h-10 rounded-full items-center justify-center bg-[rgba(203,168,98,0.12)]">
                    <Icon size={18} color={GOLD.primary} />
                  </View>
                  <Text className="ml-3 flex-1 text-[13px] leading-[19px] text-foreground/90 font-ui">
                    {text}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </View>

        <View>
          <OBPrimaryButton label="Enable notifications" onPress={handleEnable} />
          <OBSkipLink label="Not now" onPress={finishOnboarding} />
        </View>
      </View>
    </View>
  );
};

export default OB11_Notifications;
