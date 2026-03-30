import React, {useEffect} from 'react';
import {View, Dimensions, StyleSheet} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface Props {
  current: number;
  total: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const OBProgressBar: React.FC<Props> = ({current, total}) => {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(current / total, {
      duration: 400,
      easing: Easing.inOut(Easing.ease),
    });
  }, [current, total, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: progress.value * SCREEN_WIDTH,
  }));

  return (
    <View style={[styles.container, {marginTop: insets.top}]}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 2,
    width: SCREEN_WIDTH,
    backgroundColor: '#2A2A2A',
  },
  fill: {
    height: 2,
    backgroundColor: '#E8A020',
    borderRadius: 1,
  },
});

export default OBProgressBar;
