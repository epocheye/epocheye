/**
 * Theme Constants
 * Centralized color, typography, and spacing system for the app
 */

export const Colors = {
  // Primary Colors
  primary: '#FFFFFF',
  primaryDark: '#E0E0E0',
  secondary: '#3B82F6',
  secondaryDark: '#2563EB',
  
  // Background Colors
  background: '#111111',
  backgroundLight: '#1A1A1A',
  backgroundCard: '#222222',
  backgroundInput: '#040404',
  
  // Text Colors
  text: '#FFFFFF',
  textSecondary: '#888888',
  textTertiary: '#666666',
  textMuted: '#999999',
  
  // Status Colors
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  // Accent Colors
  accent: '#8B5CF6',
  accentLight: '#A78BFA',
  
  // UI Elements
  border: '#333333',
  borderLight: '#444444',
  disabled: '#555555',
  placeholder: '#888888',
  
  // Transparent
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

export const Typography = {
  // Font Families
  fontFamily: {
    regular: 'MontserratAlternates-Regular',
    thin: 'MontserratAlternates-Thin',
    light: 'MontserratAlternates-Light',
    medium: 'MontserratAlternates-Medium',
    semiBold: 'MontserratAlternates-SemiBold',
    bold: 'MontserratAlternates-Bold',
    extraBold: 'MontserratAlternates-ExtraBold',
    black: 'MontserratAlternates-Black',
  },
  
  // Font Sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.37,
    shadowRadius: 7.49,
    elevation: 12,
  },
};

export const Layout = {
  screenPadding: Spacing.lg,
  containerMaxWidth: 500,
  inputHeight: 52,
  buttonHeight: 52,
  iconSize: {
    sm: 16,
    md: 24,
    lg: 32,
    xl: 40,
  },
};

export default {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Layout,
};
