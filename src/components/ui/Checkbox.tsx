import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  ViewStyle,
  TextStyle,
  AccessibilityRole,
} from 'react-native';
import {} from '../../constants/theme';

interface CheckboxProps {
  label?: string | React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  size?: 'small' | 'medium' | 'large';
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
  containerStyle,
  labelStyle,
  size = 'medium',
  accessibilityLabel,
  accessibilityHint,
}) => {
  const handlePress = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const getCheckboxSize = () => {
    switch (size) {
      case 'small':
        return 18;
      case 'large':
        return 28;
      default:
        return 24;
    }
  };

  const checkboxSize = getCheckboxSize();

  const labelText = typeof label === 'string' ? label : accessibilityLabel;

  return (
    <TouchableOpacity
      className="my-2 flex-row items-center"
      style={containerStyle}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole={'checkbox' as AccessibilityRole}
      accessibilityLabel={labelText}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked, disabled }}
    >
      <View
        className={`items-center justify-center rounded border-2 ${
          checked
            ? 'border-[#D4860A] bg-[#D4860A]'
            : 'border-[rgba(255,255,255,0.2)] bg-[#1F1B16]'
        } ${disabled ? 'opacity-50' : ''}`}
        style={[{ width: checkboxSize, height: checkboxSize }]}
      >
        {checked && (
          <Text
            className="font-['MontserratAlternates-Bold'] text-[#F5E9D8]"
            style={{ fontSize: checkboxSize * 0.7 }}
          >
            ✓
          </Text>
        )}
      </View>
      {label &&
        (typeof label === 'string' ? (
          <Text
            className={`ml-4 flex-1 font-['MontserratAlternates-Regular'] text-[#F5E9D8] ${
              size === 'small'
                ? 'text-sm'
                : size === 'large'
                ? 'text-lg'
                : 'text-base'
            } ${disabled ? 'opacity-50' : ''}`}
            style={[labelStyle]}
          >
            {label}
          </Text>
        ) : (
          <View className={`ml-4 flex-1 ${disabled ? 'opacity-50' : ''}`}>
            {label}
          </View>
        ))}
    </TouchableOpacity>
  );
};

export default Checkbox;
