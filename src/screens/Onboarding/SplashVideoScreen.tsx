import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, Animated } from 'react-native';
import Video, { OnProgressData } from 'react-native-video';
import GhostButton from '../../components/onboarding/GhostButton';
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
    navigation.navigate(ROUTES.ONBOARDING.EMOTIONAL_QUESTION);
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
    backgroundColor: '#1A1612',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 100,
  },
  heroText: {
    fontFamily: 'CormorantGaramond-SemiBold',
    fontSize: 44,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 32,
  },
  buttonContainer: {
    width: 180,
  },
});

export default SplashVideoScreen;
