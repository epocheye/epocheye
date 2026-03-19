import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, Animated } from 'react-native';
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
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <Video
        source={require('../../assets/video/epocheye_intro.mp4')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        muted
        repeat={false}
        playInBackground={false}
        onProgress={handleProgress}
        onEnd={handleEnd}
      />

      {showOverlay && (
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <Text style={styles.heroText}>What if you could go back?</Text>
          <View style={styles.buttonContainer}>
            <GhostButton title="Begin" onPress={navigateNext} />
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgWarm,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 96,
    paddingHorizontal: 24,
  },
  heroText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZES.hero,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: 32,
    letterSpacing: 0.3,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 40,
  },
});

export default SplashVideoScreen;
