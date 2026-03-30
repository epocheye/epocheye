import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfettiCannon from 'react-native-confetti-cannon';
import { OB_COLORS } from '../../constants/onboarding';
import { FONTS, CDN_BASE } from '../../core/constants/theme';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useOnboardingComplete } from '../../context/OnboardingCallbackContext';
import { track } from '../../services/analytics';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSkipLink from '../../components/onboarding/OBSkipLink';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { BACKEND_URL } from '../../constants/onboarding';
import { getValidAccessToken } from '../../utils/api/auth';

type Props = OnboardingScreenProps<'OB12_Arrival'>;

const SCREEN_WIDTH = Dimensions.get('window').width;

const OB12_Arrival: React.FC<Props> = () => {
  const { firstName } = useOnboardingStore();
  const completeOnboarding = useOnboardingStore(s => s.completeOnboarding);
  const onOnboardingComplete = useOnboardingComplete();
  const insets = useSafeAreaInsets();
  const confettiRef = useRef<ConfettiCannon | null>(null);
  const hasCompleted = useRef(false);

  const h1 = useSharedValue(0);
  const h2 = useSharedValue(0);
  const h3 = useSharedValue(0);
  const h4 = useSharedValue(0);

  useEffect(() => {
    if (hasCompleted.current) {
      return;
    }
    hasCompleted.current = true;

    // Complete onboarding in store + AsyncStorage
    completeOnboarding();
    track('onboarding_completed');

    // Post onboarding data to backend if authenticated
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
              motivation: state.motivation,
              visitFrequency: state.visitFrequency,
              goal: state.goal,
              regions: state.regions,
              reactionEmoji: state.reactionEmoji,
            }),
          });
        }
      } catch {
        // Silent failure — onboarding data upload is best-effort
      }
    })();

    // Start confetti immediately
    confettiRef.current?.start();

    // Staggered text reveals
    h1.value = withDelay(600, withTiming(1, { duration: 500 }));
    h2.value = withDelay(1200, withTiming(1, { duration: 500 }));
    h3.value = withDelay(2000, withTiming(1, { duration: 500 }));
    h4.value = withDelay(2600, withTiming(1, { duration: 500 }));
  }, [completeOnboarding, h1, h2, h3, h4]);

  const s1 = useAnimatedStyle(() => ({ opacity: h1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: h2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: h3.value }));
  const s4 = useAnimatedStyle(() => ({ opacity: h4.value }));

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.centerArea}>
          <Animated.Text style={[styles.heroText, s1]}>
            {firstName}, your lineage is ready.
          </Animated.Text>

          <Animated.Text style={[styles.subText, s2]}>
            Head to any heritage site and your ancestor will be waiting.
          </Animated.Text>

          {/* Map placeholder */}
          <Animated.View style={[styles.mapPlaceholder, s3]}>
            <Image
              source={{ uri: `${CDN_BASE}monuments/Konarka_Temple-2.jpg` }}
              style={styles.mapImage}
              resizeMode="cover"
            />
            <View style={styles.mapOverlay}>
              <Text style={styles.mapText}>Explore nearby monuments</Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={s4}>
          <OBPrimaryButton
            label="Explore nearby →"
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
        count={150}
        origin={{ x: SCREEN_WIDTH / 2, y: -10 }}
        colors={['#E8A020', '#FFD700', '#FFFFFF', '#FFA500']}
        autoStart={false}
        fadeOut
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OB_COLORS.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  heroText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: FONTS.extraBold,
    textAlign: 'center',
    marginBottom: 16,
  },
  subText: {
    color: '#8C93A0',
    fontSize: 15,
    textAlign: 'center',
    marginHorizontal: 32,
    fontFamily: FONTS.regular,
    lineHeight: 22,
  },
  mapPlaceholder: {
    width: SCREEN_WIDTH - 48,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 32,
    backgroundColor: '#1A1A1A',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
});

export default OB12_Arrival;
