import React from 'react';
import {Text, View, Pressable, StyleSheet, Dimensions} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import GlassCard from './GlassCard';
import {GOLD, SPACING, TEXT, TYPE, RADIUS} from '../../constants/onboarding';

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
const GRID_TILE_WIDTH = (SCREEN_WIDTH - SPACING.screen * 2 - 12) / 2;

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
    scale.value = withSpring(selected ? 1.01 : 1, {
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
        isGrid ? styles.gridWrap : styles.stackWrap,
        animatedStyle,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}>
      <GlassCard
        variant={selected ? 'gold' : 'default'}
        radius={RADIUS.md}
        style={StyleSheet.absoluteFill}>
        <View />
      </GlassCard>

      {badge ? (
        <View
          style={[
            styles.badge,
            {backgroundColor: selected ? GOLD.primary : 'rgba(255,255,255,0.10)'},
          ]}>
          <Text
            style={[
              styles.badgeText,
              {color: selected ? TEXT.dark : TEXT.muted},
            ]}>
            {badge}
          </Text>
        </View>
      ) : null}

      {isGrid ? (
        <View style={styles.gridContent}>
          <View style={styles.iconPillWrap}>
            {selected ? <View style={styles.iconPill} /> : null}
            <View style={styles.iconInner}>{icon}</View>
          </View>
          <Text style={styles.gridLabel} numberOfLines={2}>
            {label}
          </Text>
        </View>
      ) : (
        <View style={styles.stackContent}>
          <View style={styles.iconPillWrap}>
            {selected ? <View style={styles.iconPill} /> : null}
            <View style={styles.iconInner}>{icon}</View>
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.stackLabel}>{label}</Text>
            {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
          </View>
        </View>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  stackWrap: {
    height: 76,
    marginHorizontal: SPACING.screen,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  gridWrap: {
    width: GRID_TILE_WIDTH,
    height: 116,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  stackContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  gridContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    gap: 10,
  },
  iconPillWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPill: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(201,168,76,0.15)',
  },
  iconInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    marginLeft: 16,
  },
  stackLabel: {
    ...TYPE.uiMedium,
    color: TEXT.primary,
    fontSize: 15,
  },
  sublabel: {
    ...TYPE.uiSmall,
    color: TEXT.muted,
    fontSize: 12,
    marginTop: 2,
  },
  gridLabel: {
    ...TYPE.uiMedium,
    color: TEXT.primary,
    fontSize: 13,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 2,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: TYPE.label.fontFamily,
  },
});

export default OBSelectionTile;
