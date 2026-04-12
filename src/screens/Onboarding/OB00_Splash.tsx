import React, {useEffect} from 'react';
import {View, StyleSheet, StatusBar} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import DustMotes from '../../components/onboarding/DustMotes';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB00_Splash'>;

const OB00_Splash: React.FC<Props> = ({navigation}) => {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);

  useEffect(() => {
    const goNext = () => {
      navigation.replace('OB01_Welcome');
    };

    // Logo fades in at 400ms with scale spring
    logoOpacity.value = withDelay(400, withTiming(1, {duration: 600}));
    logoScale.value = withDelay(400, withSpring(1, {damping: 12, stiffness: 120}));

    // Auto-advance at 2000ms
    const timer = setTimeout(() => {
      runOnJS(goNext)();
    }, 2000);

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
      <DustMotes />
      <Animated.View style={logoStyle}>
        <AnimatedLogo size={100} motion="drift" variant="white" />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default OB00_Splash;
