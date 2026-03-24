import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StatusBar,
  Platform,
  PermissionsAndroid,
  Animated,
} from 'react-native';
import { request, PERMISSIONS } from 'react-native-permissions';
import AmberButton from '../../components/onboarding/AmberButton';
import { useOnboardingComplete } from '../../context/OnboardingCallbackContext';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'Welcome'>;
type WelcomeStep = 'location' | 'notification' | 'ready';

/**
 * Screen 6 — Welcome (merged Permissions + WorldOpens).
 * Step 1: Location permission.
 * Step 2: Notification permission.
 * Step 3: Welcome banner with auto-transition to main app.
 */
const WelcomeScreen: React.FC<Props> = () => {
  const [step, setStep] = useState<WelcomeStep>('location');
  const onOnboardingComplete = useOnboardingComplete();

  // Fade animation for step transitions
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const bannerTranslateY = useRef(new Animated.Value(60)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  const crossfadeToNextStep = useCallback(
    (nextStep: WelcomeStep) => {
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setStep(nextStep);
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    },
    [contentOpacity],
  );

  const handleLocationPermission = useCallback(async () => {
    const permission = Platform.select({
      ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    });

    if (permission) {
      try {
        await request(permission);
      } catch {
        // Proceed regardless
      }
    }

    crossfadeToNextStep('notification');
  }, [crossfadeToNextStep]);

  const handleNotificationPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const apiLevel =
          typeof Platform.Version === 'number'
            ? Platform.Version
            : parseInt(String(Platform.Version), 10);

        if (apiLevel >= 33) {
          await PermissionsAndroid.request(
            'android.permission.POST_NOTIFICATIONS' as typeof PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
        }
      } catch {
        // Proceed regardless
      }
    }

    crossfadeToNextStep('ready');
  }, [crossfadeToNextStep]);

  // When reaching the "ready" step, show banner then transition to main app
  useEffect(() => {
    if (step !== 'ready') return;

    // Slide banner up
    Animated.parallel([
      Animated.timing(bannerTranslateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // After 3 seconds, slide back down then complete onboarding
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(bannerTranslateY, {
          toValue: 60,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onOnboardingComplete();
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [step, bannerTranslateY, bannerOpacity, onOnboardingComplete]);

  const renderPermissionStep = (
    heading: string,
    description: string,
    buttonTitle: string,
    onPress: () => void,
  ) => (
    <Animated.View
      className="flex-1 items-center justify-center px-10"
      style={{ opacity: contentOpacity }}
    >
      <View className="mb-8 h-[72px] w-[72px] items-center justify-center rounded-full bg-[rgba(201,168,76,0.15)]">
        <Text className="text-[32px]">{step === 'location' ? '📍' : '🔔'}</Text>
      </View>
      <Text className="mb-5 text-center font-['MontserratAlternates-Bold'] text-[32px] leading-[38px] text-[#F5E9D8]">
        {heading}
      </Text>
      <Text className="mb-10 text-center font-['MontserratAlternates-Regular'] text-[15px] leading-[22px] text-[#B8AF9E]">
        {description}
      </Text>
      <View className="w-full px-5">
        <AmberButton title={buttonTitle} onPress={onPress} />
      </View>
    </Animated.View>
  );

  return (
    <View className="flex-1 bg-[#1A1612]">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {step === 'location' &&
        renderPermissionStep(
          'Let EpochEye find the\nhistory around you',
          'We use your location to show you heritage sites nearby and deliver stories that belong to your place.',
          'Allow Location Access',
          handleLocationPermission,
        )}

      {step === 'notification' &&
        renderPermissionStep(
          "We'll tell you when\nyou're near a story",
          'Get notified when a monument with your ancestry connection is nearby.',
          'Enable Notifications',
          handleNotificationPermission,
        )}

      {step === 'ready' && (
        <View className="flex-1 items-center justify-end pb-20">
          <Animated.View
            className="max-w-[85%] rounded-[28px] bg-[#D4860A] px-8 py-4"
            style={[
              {
                transform: [{ translateY: bannerTranslateY }],
                opacity: bannerOpacity,
              },
            ]}
          >
            <Text className="text-center font-['MontserratAlternates-SemiBold'] text-[15px] text-[#F5E9D8]">
              You're 2.3km from a story that belongs to you.
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

export default WelcomeScreen;
