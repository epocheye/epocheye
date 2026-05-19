import React, {useEffect} from 'react';
import {View} from 'react-native';
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
    <View
      className="flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.12)]"
      style={{height: SEGMENT_HEIGHT}}>
      <Animated.View className="h-full rounded-full" style={fillStyle} />
    </View>
  );
};

const OBProgressBar: React.FC<Props> = ({current, total}) => {
  const insets = useSafeAreaInsets();

  return (
    <View className="px-6 pb-3" style={{paddingTop: insets.top + 14}}>
      <View className="flex-row" style={{gap: SEGMENT_GAP}}>
        {Array.from({length: total}, (_, i) => (
          <Segment key={i} index={i} current={current} />
        ))}
      </View>
    </View>
  );
};

export default OBProgressBar;
