/**
 * Primary CTA used across the premium designs: a gold gradient pill with a dark
 * label. Mirrors the Efecto `bg-primary` buttons (which were gold-gradient via
 * set_fill). Use for the single main action on a screen/sheet.
 */
import React from 'react';
import {
  Pressable,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {COLORS, FONTS, GOLD_GRADIENT} from '../../core/constants/theme';

interface Props {
  label: string;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Corner radius (default 16). */
  radius?: number;
  /** Vertical padding (default 16). */
  paddingVertical?: number;
}

const GoldButton: React.FC<Props> = ({
  label,
  onPress,
  leftIcon,
  rightIcon,
  disabled,
  style,
  radius = 16,
  paddingVertical = 16,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({pressed}) => [
      {borderRadius: radius, overflow: 'hidden', opacity: disabled ? 0.5 : pressed ? 0.92 : 1},
      style,
    ]}>
    <LinearGradient
      colors={GOLD_GRADIENT}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 0}}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical,
        paddingHorizontal: 20,
      }}>
      {leftIcon}
      <Text style={{fontFamily: FONTS.uiMedium, fontSize: 16, color: COLORS.bg}}>{label}</Text>
      {rightIcon}
    </LinearGradient>
  </Pressable>
);

export default GoldButton;
