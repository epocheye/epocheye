import React, {useEffect, useRef} from 'react';
import {View, Text, Image, StyleSheet, StatusBar, Dimensions} from 'react-native';
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
import {OB_COLORS, BACKEND_URL} from '../../constants/onboarding';
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
  const {firstName, demoMonument, regions} = useOnboardingStore();
  const completeOnboarding = useOnboardingStore(s => s.completeOnboarding);
  const onOnboardingComplete = useOnboardingComplete();
  const insets = useSafeAreaInsets();
  const confettiRef = useRef<ConfettiCannon | null>(null);
  const hasCompleted = useRef(false);

  // Staggered text animations
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

    // Staggered reveals with springs
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

  const monumentImage = demoMonument
    ? `${CDN_BASE}monuments/Konarka_Temple-2.jpg`
    : regions.length > 0
    ? `${CDN_BASE}monuments/Konarka_Temple-2.jpg`
    : `${CDN_BASE}monuments/Konarka_Temple-2.jpg`;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
        <View style={styles.centerArea}>
          <Animated.Text style={[styles.heroText, s1]}>
            {firstName || 'Explorer'},{'\n'}your lineage is ready.
          </Animated.Text>

          <Animated.Text style={[styles.subText, s2]}>
            Head to any heritage site and your ancestor will be waiting.
          </Animated.Text>

          {/* Monument destination card */}
          <Animated.View style={[styles.destinationCard, sCard]}>
            <Image
              source={{uri: monumentImage}}
              style={styles.cardImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.cardGradient}
            />
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>YOUR FIRST DESTINATION</Text>
              <Text style={styles.cardTitle}>
                {demoMonument || 'Explore nearby monuments'}
              </Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={sCta}>
          <OBPrimaryButton
            label={"Explore nearby  →"}
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
    paddingHorizontal: 28,
  },
  heroText: {
    fontSize: 30,
    lineHeight: 38,
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
    marginHorizontal: 20,
    fontFamily: FONTS.regular,
    lineHeight: 23,
  },
  destinationCard: {
    width: SCREEN_WIDTH - 56,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 32,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.2)',
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContent: {
    position: 'absolute',
    bottom: 16,
    left: 18,
    right: 18,
  },
  cardLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: '#E8A020',
    fontFamily: FONTS.semiBold,
    marginBottom: 4,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: FONTS.bold,
  },
});

export default OB12_Arrival;
