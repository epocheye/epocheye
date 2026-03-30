import React from 'react';
import {
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  AccessibilityRole,
} from 'react-native';
import AnimatedLogo from './AnimatedLogo';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const sizeClass =
    size === 'small'
      ? 'h-10 px-4 py-2'
      : size === 'large'
      ? 'h-[60px] px-8 py-4'
      : 'h-14 px-6 py-3';
  const variantClass =
    variant === 'primary'
      ? 'bg-[#D4860A]'
      : variant === 'secondary'
      ? 'bg-[#2B2520]'
      : variant === 'outline'
      ? 'border border-[rgba(255,255,255,0.2)] bg-transparent'
      : 'bg-transparent';
  const textSizeClass =
    size === 'small' ? 'text-sm' : size === 'large' ? 'text-xl' : 'text-lg';
  const textColorClass =
    variant === 'primary' ? 'text-[#1A1612]' : 'text-[#F5E9D8]';

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center gap-2 rounded-xl ${sizeClass} ${variantClass} ${
        fullWidth ? 'w-full' : ''
      } ${isDisabled ? 'opacity-50' : ''}`}
      style={style}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole={'button' as AccessibilityRole}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <AnimatedLogo
          size={18}
          variant={variant === 'primary' ? 'black' : 'white'}
          motion="pulse"
          showRing={false}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text
            className={`text-center font-['MontserratAlternates-SemiBold'] ${textSizeClass} ${textColorClass}`}
            style={textStyle}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </TouchableOpacity>
  );
};

export default Button;
