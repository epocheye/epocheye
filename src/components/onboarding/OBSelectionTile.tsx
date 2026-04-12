import React from 'react';
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {FONTS} from '../../core/constants/theme';

interface Props {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
  layout?: 'grid' | 'stack';
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_TILE_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const OBSelectionTile: React.FC<Props> = ({
  icon,
  label,
  sublabel,
  badge,
  selected,
  onPress,
  layout = 'stack',
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, {duration: 60});
  };

  const handlePressOut = () => {
    scale.value = withSpring(selected ? 1.02 : 1, {
      damping: 14,
      stiffness: 280,
    });
  };

  const handlePress = () => {
    try {
      ReactNativeHapticFeedback.trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    } catch {}
    onPress();
  };

  const isGrid = layout === 'grid';

  return (
    <AnimatedPressable
      style={[
        styles.tile,
        isGrid ? styles.gridTile : styles.stackTile,
        {
          borderColor: selected
            ? 'rgba(232, 160, 32, 0.7)'
            : 'rgba(255, 255, 255, 0.08)',
          backgroundColor: selected
            ? 'rgba(232, 160, 32, 0.08)'
            : 'rgba(255, 255, 255, 0.04)',
        },
        animatedStyle,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}>
      {badge && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: selected ? '#E8A020' : 'rgba(255,255,255,0.1)',
            },
          ]}>
          <Text
            style={[
              styles.badgeText,
              {color: selected ? '#0D0D0D' : '#8C93A0'},
            ]}>
            {badge}
          </Text>
        </View>
      )}

      {/* Amber inner glow for selected state */}
      {selected && <View style={styles.innerGlow} />}

      {isGrid ? (
        <View style={styles.gridContent}>
          <View style={styles.iconWrapGrid}>{icon}</View>
          <Text style={styles.gridLabel} numberOfLines={2}>
            {label}
          </Text>
        </View>
      ) : (
        <View style={styles.stackContent}>
          <View style={styles.iconWrapStack}>{icon}</View>
          <View style={styles.textWrapper}>
            <Text style={styles.stackLabel}>{label}</Text>
            {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
          </View>
        </View>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  tile: {
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  gridTile: {
    width: GRID_TILE_WIDTH,
    height: 110,
  },
  stackTile: {
    height: 72,
    marginHorizontal: 24,
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    backgroundColor: 'rgba(232, 160, 32, 0.04)',
  },
  gridContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  iconWrapGrid: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
    textAlign: 'center',
  },
  stackContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  iconWrapStack: {
    width: 44,
    alignItems: 'center',
  },
  textWrapper: {
    flex: 1,
    marginLeft: 14,
  },
  stackLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
  },
  sublabel: {
    fontSize: 12,
    color: '#8C93A0',
    marginTop: 3,
    fontFamily: FONTS.regular,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
});

export default OBSelectionTile;
