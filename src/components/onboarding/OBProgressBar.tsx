import React, {useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GOLD} from '../../constants/onboarding';

interface Props {
  current: number; // 0-indexed
  total: number;
}

const SEGMENT_HEIGHT = 3;
const SEGMENT_GAP = 4;

const Segment: React.FC<{index: number; current: number}> = ({
  index,
  current,
}) => {
  const isCompleted = index < current;
  const isActive = index === current;
  const fill = useSharedValue(isCompleted ? 1 : 0);

  useEffect(() => {
    if (index < current) {
      fill.value = withTiming(1, {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      });
    } else if (index === current) {
      fill.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      fill.value = withTiming(0, {duration: 250});
    }
  }, [current, index, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
    backgroundColor: isActive ? GOLD.light : GOLD.primary,
  }));

  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fillStyle]} />
    </View>
  );
};

const OBProgressBar: React.FC<Props> = ({current, total}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, {paddingTop: insets.top + 14}]}>
      <View style={styles.row}>
        {Array.from({length: total}, (_, i) => (
          <Segment key={i} index={i} current={current} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: SEGMENT_GAP,
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    borderRadius: SEGMENT_HEIGHT / 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    borderRadius: SEGMENT_HEIGHT / 2,
  },
});

export default OBProgressBar;
