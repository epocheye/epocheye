import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  AccessibilityRole,
} from 'react-native';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
} from '../../constants/theme';

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
      style={[styles.container, containerStyle]}
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
        style={[
          styles.checkbox,
          { width: checkboxSize, height: checkboxSize },
          checked && styles.checkboxChecked,
          disabled && styles.checkboxDisabled,
        ]}
      >
        {checked && (
          <Text style={[styles.checkmark, { fontSize: checkboxSize * 0.7 }]}>
            ✓
          </Text>
        )}
      </View>
      {label &&
        (typeof label === 'string' ? (
          <Text
            style={[
              styles.label,
              styles[`label_${size}`],
              disabled && styles.labelDisabled,
              labelStyle,
            ]}
          >
            {label}
          </Text>
        ) : (
          <View style={[styles.label, disabled && styles.labelDisabled]}>
            {label}
          </View>
        ))}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  checkbox: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.backgroundInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  checkboxDisabled: {
    opacity: 0.5,
  },
  checkmark: {
    color: Colors.text,
    fontFamily: Typography.fontFamily.bold,
  },
  label: {
    marginLeft: Spacing.md,
    color: Colors.text,
    fontFamily: Typography.fontFamily.regular,
    flex: 1,
  },
  label_small: {
    fontSize: Typography.fontSize.sm,
  },
  label_medium: {
    fontSize: Typography.fontSize.base,
  },
  label_large: {
    fontSize: Typography.fontSize.lg,
  },
  labelDisabled: {
    opacity: 0.5,
  },
});

export default Checkbox;
