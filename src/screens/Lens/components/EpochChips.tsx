import React, {useEffect} from 'react';
import {Pressable, Text, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {FONTS} from '../../../core/constants/theme';

interface EpochChipsProps {
  visible: boolean;
  onPress: () => void;
}

const EpochChips: React.FC<EpochChipsProps> = ({visible, onPress}) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withDelay(1500, withTiming(1, {duration: 500}));
    } else {
      opacity.value = withTiming(0, {duration: 180});
    }
  }, [opacity, visible]);

  const chipStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) {
    return null;
  }

  return (
    <View
      className="absolute top-[42%] left-0 right-0 items-center"
      pointerEvents="box-none">
      <Animated.View style={chipStyle}>
        <Pressable
          onPress={onPress}
          className="bg-overlay-dark rounded-[20px] border border-[rgba(255,255,255,0.2)] px-[14px] py-[6px]">
          <Text
            className="text-accent-amber text-[13px]"
            style={{fontFamily: FONTS.medium}}>
            You have an ancestor here
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

export default EpochChips;
