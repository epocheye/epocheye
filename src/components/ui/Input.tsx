import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TextInputProps,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  secureTextEntry?: boolean;
  showPasswordToggle?: boolean;
  required?: boolean;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  labelStyle,
  secureTextEntry = false,
  showPasswordToggle = false,
  required = false,
  ...textInputProps
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const isSecure = secureTextEntry && !isPasswordVisible;
  const focusClass = isFocused
    ? 'border-[#D4860A]'
    : error
    ? 'border-[#D9534F]'
    : 'border-transparent';

  return (
    <View className="mb-4" style={containerStyle}>
      {label && (
        <Text
          className="mb-2 text-base font-['MontserratAlternates-Medium'] text-[#F5E9D8]"
          style={labelStyle}
          accessibilityLabel={label}
        >
          {label}
          {required && <Text className="text-[#D9534F]"> *</Text>}
        </Text>
      )}

      <View
        className={`flex-row items-center rounded-xl border bg-[#1F1B16] px-4 ${focusClass}`}
      >
        {leftIcon && (
          <View className="items-center justify-center">{leftIcon}</View>
        )}

        <TextInput
          className={`h-14 flex-1 text-base font-['MontserratAlternates-Regular'] text-[#F5E9D8] ${
            leftIcon ? 'ml-2' : ''
          }`}
          style={inputStyle}
          placeholderTextColor={Colors.placeholder}
          secureTextEntry={isSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessible={true}
          accessibilityLabel={label || textInputProps.placeholder}
          accessibilityHint={helperText}
          {...textInputProps}
        />

        {showPasswordToggle && secureTextEntry && (
          <TouchableOpacity
            onPress={togglePasswordVisibility}
            className="items-center justify-center pl-2"
            accessibilityLabel={
              isPasswordVisible ? 'Hide password' : 'Show password'
            }
            accessibilityRole="button"
          >
            <Text className="text-xl">{isPasswordVisible ? '👁️' : '👁️‍🗨️'}</Text>
          </TouchableOpacity>
        )}

        {rightIcon && !showPasswordToggle && (
          <View className="items-center justify-center pl-2">{rightIcon}</View>
        )}
      </View>

      {error && (
        <Text
          className="mt-1 text-sm font-['MontserratAlternates-Regular'] text-[#D9534F]"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}

      {helperText && !error && (
        <Text className="mt-1 text-sm font-['MontserratAlternates-Regular'] text-[#B8AF9E]">
          {helperText}
        </Text>
      )}
    </View>
  );
};

export default Input;
