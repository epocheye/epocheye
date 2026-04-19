import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ViewStyle,
  StyleProp,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {BG, BORDER, RADIUS} from '../../constants/onboarding';

type Variant = 'default' | 'gold' | 'stone';

interface Props {
  children: React.ReactNode;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  radius?: number;
  borderless?: boolean;
}

/**
 * Frosted-glass surface. iOS uses BlurView for a real frosted look; on
 * Android we fall back to a solid warm-tinted fill since the community
 * blur library has known issues on most OEMs. The `stone` variant always
 * uses the solid fill regardless of platform.
 */
const GlassCard: React.FC<Props> = ({
  children,
  variant = 'default',
  style,
  onPress,
  radius = RADIUS.lg,
  borderless = false,
}) => {
  const useBlur = Platform.OS === 'ios' && variant !== 'stone';

  const tint =
    variant === 'stone'
      ? BG.stone
      : variant === 'gold'
      ? BG.glassWarm
      : Platform.OS === 'ios'
      ? 'transparent'
      : 'rgba(20,18,14,0.92)';

  const borderColor =
    variant === 'gold' ? BORDER.goldStrong : BORDER.subtle;
  const borderWidth = borderless ? 0 : variant === 'gold' ? 1.5 : 1;

  const containerStyle: ViewStyle = {
    borderRadius: radius,
    borderWidth,
    borderColor,
    backgroundColor: tint,
    overflow: 'hidden',
  };

  const content = (
    <>
      {useBlur ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="dark"
          blurAmount={18}
          reducedTransparencyFallbackColor="rgba(20,18,14,0.92)"
        />
      ) : null}
      {variant === 'gold' ? <View style={styles.goldInner} pointerEvents="none" /> : null}
      <View style={styles.content}>{children}</View>
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[containerStyle, style]}>
        {content}
      </Pressable>
    );
  }
  return <View style={[containerStyle, style]}>{content}</View>;
};

const styles = StyleSheet.create({
  content: {
    position: 'relative',
  },
  goldInner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(201,168,76,0.04)',
  },
});

export default GlassCard;
