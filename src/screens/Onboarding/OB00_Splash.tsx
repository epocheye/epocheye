import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { OB_COLORS } from '../../constants/onboarding';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB00_Splash'>;

const OB00_Splash: React.FC<Props> = ({ navigation }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    const goNext = () => {
      navigation.replace('OB01_Welcome');
    };

    opacity.value = withTiming(1, { duration: 600 });

    // Hold 800ms after fade-in completes, then navigate
    const timer = setTimeout(() => {
      runOnJS(goNext)();
    }, 1400);

    return () => clearTimeout(timer);
  }, [navigation, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <Animated.View style={animatedStyle}>
        <AnimatedLogo size={120} motion="drift" variant="white" />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OB_COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default OB00_Splash;
