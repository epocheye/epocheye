import React, {useEffect} from 'react';
import {View, StyleSheet, StatusBar, Dimensions} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import {ROUTES} from '../../core/constants/routes';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import DustMotes from '../../components/onboarding/DustMotes';
import ARViewfinder from '../../components/onboarding/ARViewfinder';
import {ACCENT, BG} from '../../constants/onboarding';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB00_Splash'>;

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const OB00_Splash: React.FC<Props> = ({navigation}) => {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);

  useEffect(() => {
    const goNext = () => {
      navigation.replace(ROUTES.ONBOARDING.OB01_WELCOME);
    };

    logoOpacity.value = withDelay(400, withTiming(1, {duration: 700}));
    logoScale.value = withDelay(
      400,
      withSpring(1, {damping: 14, stiffness: 120}),
    );

    const timer = setTimeout(() => {
      runOnJS(goNext)();
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation, logoOpacity, logoScale]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{scale: logoScale.value}],
  }));

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Radial indigo bloom */}
      <View style={styles.indigoBloom} pointerEvents="none" />

      {/* Dust motes */}
      <DustMotes />

      {/* AR viewfinder with logo at center */}
      <Animated.View style={[styles.viewfinder, logoStyle]}>
        <ARViewfinder size={220}>
          <AnimatedLogo size={80} variant="white" motion="drift" />
        </ARViewfinder>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indigoBloom: {
    position: 'absolute',
    width: SCREEN_WIDTH * 1.3,
    height: SCREEN_WIDTH * 1.3,
    top: SCREEN_HEIGHT / 2 - SCREEN_WIDTH * 0.65,
    left: -(SCREEN_WIDTH * 0.15),
    borderRadius: SCREEN_WIDTH,
    backgroundColor: ACCENT.indigoGlow,
    opacity: 0.35,
  },
  viewfinder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default OB00_Splash;
