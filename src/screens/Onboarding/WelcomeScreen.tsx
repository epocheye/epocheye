import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  PermissionsAndroid,
  Animated,
} from 'react-native';
import { request, PERMISSIONS } from 'react-native-permissions';
import AmberButton from '../../components/onboarding/AmberButton';
import { useOnboardingComplete } from '../../context/OnboardingCallbackContext';
import { FONTS, COLORS, FONT_SIZES, SPACING } from '../../core/constants/theme';
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
      style={[styles.permissionContent, { opacity: contentOpacity }]}
    >
      <View style={styles.iconCircle}>
        <Text style={styles.iconEmoji}>
          {step === 'location' ? '📍' : '🔔'}
        </Text>
      </View>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.ctaContainer}>
        <AmberButton title={buttonTitle} onPress={onPress} />
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
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
        <View style={styles.readyContainer}>
          <Animated.View
            style={[
              styles.banner,
              {
                transform: [{ translateY: bannerTranslateY }],
                opacity: bannerOpacity,
              },
            ]}
          >
            <Text style={styles.bannerText}>
              You're 2.3km from a story that belongs to you.
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgWarm,
  },
  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.amberSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xxl,
  },
  iconEmoji: {
    fontSize: 32,
  },
  heading: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZES.heading,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: SPACING.lg,
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.section,
  },
  ctaContainer: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
  },
  readyContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 80,
  },
  banner: {
    backgroundColor: COLORS.amber,
    paddingVertical: 16,
    paddingHorizontal: SPACING.xxl,
    borderRadius: 28,
    maxWidth: '85%',
  },
  bannerText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
});

export default WelcomeScreen;
