import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { FONTS } from '../../../core/constants/theme';

interface EpochChipsProps {
  visible: boolean;
  onPress: () => void;
}

const EpochChips: React.FC<EpochChipsProps> = ({ visible, onPress }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withDelay(1500, withTiming(1, { duration: 500 }));
    } else {
      opacity.value = withTiming(0, { duration: 180 });
    }
  }, [opacity, visible]);

  const chipStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View style={chipStyle}>
        <Pressable onPress={onPress} style={styles.chip}>
          <Text style={styles.chipText}>You have an ancestor here</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '42%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: {
    color: '#E8A020',
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
});

export default EpochChips;
