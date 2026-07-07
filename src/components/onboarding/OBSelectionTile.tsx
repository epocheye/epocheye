import React from 'react';
import {Text, View, Pressable, Dimensions} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import GlassCard from './GlassCard';
import {GOLD, SPACING, TEXT, TYPE, RADIUS} from '../../constants/onboarding';
import {moderateScale} from '../../utils/scaling';

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
      className={`${isGrid ? '' : 'mx-6'} overflow-hidden`}
      style={[
        {
          height: isGrid ? moderateScale(116) : moderateScale(76),
          borderRadius: moderateScale(14),
        },
        isGrid ? {width: GRID_TILE_WIDTH} : undefined,
        animatedStyle,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}>
      <GlassCard
        variant={selected ? 'gold' : 'default'}
        radius={RADIUS.md}
        style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}>
        <View />
      </GlassCard>

      {badge ? (
        <View
          className="absolute top-2 right-2 rounded-lg px-2 py-[3px] z-[2]"
          style={{
            backgroundColor: selected ? GOLD.primary : 'rgba(255,255,255,0.10)',
          }}>
          <Text
            style={{
              fontFamily: TYPE.label.fontFamily,
              fontSize: moderateScale(10),
              color: selected ? TEXT.dark : TEXT.muted,
            }}>
            {badge}
          </Text>
        </View>
      ) : null}

      {isGrid ? (
        <View className="flex-1 items-center justify-center px-3 gap-[10px]">
          <View className="w-11 h-11 items-center justify-center">
            {selected ? (
              <View className="absolute w-10 h-10 rounded-full bg-ob-goldSoft" />
            ) : null}
            <View className="items-center justify-center">{icon}</View>
          </View>
          <Text
            className="text-center text-ob-warm"
            style={{
              fontFamily: TYPE.uiMedium.fontFamily,
              fontSize: moderateScale(13),
              lineHeight: moderateScale(18),
            }}
            numberOfLines={2}>
            {label}
          </Text>
        </View>
      ) : (
        <View className="flex-1 flex-row items-center px-4">
          <View className="w-11 h-11 items-center justify-center">
            {selected ? (
              <View className="absolute w-10 h-10 rounded-full bg-ob-goldSoft" />
            ) : null}
            <View className="items-center justify-center">{icon}</View>
          </View>
          <View className="flex-1 ml-4">
            <Text
              className="text-ob-warm"
              style={{
                fontFamily: TYPE.uiMedium.fontFamily,
                fontSize: moderateScale(15),
                lineHeight: moderateScale(22),
              }}>
              {label}
            </Text>
            {sublabel ? (
              <Text
                className="mt-0.5 text-ob-warmMuted"
                style={{
                  fontFamily: TYPE.uiSmall.fontFamily,
                  fontSize: moderateScale(12),
                  lineHeight: moderateScale(18),
                }}>
                {sublabel}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </AnimatedPressable>
  );
};

export default OBSelectionTile;
