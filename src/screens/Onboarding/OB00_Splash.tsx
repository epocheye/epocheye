import React, {useEffect} from 'react';
import {View, Image, StyleSheet, StatusBar} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import {OB_COLORS} from '../../constants/onboarding';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB00_Splash'>;

const OB00_Splash: React.FC<Props> = ({navigation}) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    const goNext = () => {
      navigation.replace('OB01_Welcome');
    };

    opacity.value = withTiming(1, {duration: 600});

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
        <Image
          source={require('../../assets/images/logo-white.png')}
          style={styles.logo}
          resizeMode="contain"
        />
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
  logo: {
    width: 120,
    height: 120,
  },
});

export default OB00_Splash;
