import React from 'react';
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
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
    scale.value = withTiming(0.97, {duration: 80});
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, {duration: 120});
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
          borderColor: selected ? '#E8A020' : '#2A2A2A',
          backgroundColor: selected ? '#1F1800' : '#1A1A1A',
        },
        animatedStyle,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}

      {isGrid ? (
        <View style={styles.gridContent}>
          <View style={{marginBottom: 8}}>
            {icon}
          </View>
          <Text
            style={[
              styles.label,
              {color: selected ? '#FFFFFF' : '#FFFFFF'},
            ]}
            numberOfLines={2}>
            {label}
          </Text>
        </View>
      ) : (
        <View style={styles.stackContent}>
          <View style={styles.iconWrapper}>
            {icon}
          </View>
          <View style={styles.textWrapper}>
            <Text
              style={[
                styles.label,
                {color: '#FFFFFF'},
              ]}>
              {label}
            </Text>
            {sublabel && (
              <Text style={styles.sublabel}>{sublabel}</Text>
            )}
          </View>
        </View>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  tile: {
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  gridTile: {
    width: GRID_TILE_WIDTH,
    height: 90,
  },
  stackTile: {
    height: 68,
    marginHorizontal: 24,
  },
  gridContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  stackContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  iconWrapper: {
    width: 40,
    alignItems: 'center',
  },
  textWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.select({
      ios: FONTS.semiBold,
      android: FONTS.semiBold,
    }),
    textAlign: 'left',
  },
  sublabel: {
    fontSize: 12,
    color: '#8C93A0',
    marginTop: 2,
    fontFamily: Platform.select({
      ios: FONTS.regular,
      android: FONTS.regular,
    }),
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#E8A020',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  badgeText: {
    color: '#0D0D0D',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: FONTS.bold,
      android: FONTS.bold,
    }),
  },
});

export default OBSelectionTile;
