import React, {useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface Props {
  current: number;
  total: number;
}

const DOT_SIZE = 8;
const DOT_GAP = 10;

const Dot: React.FC<{index: number; current: number}> = ({index, current}) => {
  const scale = useSharedValue(index < current ? 1 : index === current ? 1 : 0.8);
  const opacity = useSharedValue(index < current ? 1 : index === current ? 1 : 0.3);

  useEffect(() => {
    if (index < current) {
      // Completed
      scale.value = withTiming(1, {duration: 300});
      opacity.value = withTiming(1, {duration: 300});
    } else if (index === current) {
      // Active
      scale.value = withSpring(1.25, {damping: 12, stiffness: 200});
      opacity.value = withTiming(1, {duration: 200});
    } else {
      // Upcoming
      scale.value = withTiming(0.8, {duration: 300});
      opacity.value = withTiming(0.3, {duration: 300});
    }
  }, [current, index, scale, opacity]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
    opacity: opacity.value,
    backgroundColor: index <= current ? '#E8A020' : '#3A3A3A',
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
};

const OBProgressBar: React.FC<Props> = ({current, total}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, {paddingTop: insets.top + 12}]}>
      <View style={styles.dotsRow}>
        {Array.from({length: total}, (_, i) => (
          <Dot key={i} index={i} current={current} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DOT_GAP,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});

export default OBProgressBar;
