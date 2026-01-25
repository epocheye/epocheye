/**
 * Color Tokens
 * Centralized color palette for the design system
 */

/**
 * Color palette for the EpochEye app
 */
export const Colors = {
  // ============================================
  // Primary Colors
  // ============================================
  primary: '#FFFFFF',
  primaryDark: '#E0E0E0',
  secondary: '#3B82F6',
  secondaryDark: '#2563EB',

  // ============================================
  // Background Colors
  // ============================================
  background: '#111111',
  backgroundLight: '#1A1A1A',
  backgroundCard: '#222222',
  backgroundInput: '#040404',
  backgroundOverlay: '#10101A',

  // ============================================
  // Text Colors
  // ============================================
  text: '#FFFFFF',
  textSecondary: '#888888',
  textTertiary: '#666666',
  textMuted: '#999999',
  textDisabled: '#555555',

  // ============================================
  // Status Colors
  // ============================================
  success: '#10B981',
  successLight: '#34D399',
  successDark: '#059669',

  error: '#EF4444',
  errorLight: '#F87171',
  errorDark: '#DC2626',

  warning: '#F59E0B',
  warningLight: '#FBBF24',
  warningDark: '#D97706',

  info: '#3B82F6',
  infoLight: '#60A5FA',
  infoDark: '#2563EB',

  // ============================================
  // Accent Colors
  // ============================================
  accent: '#8B5CF6',
  accentLight: '#A78BFA',
  accentDark: '#7C3AED',

  gold: '#FFD700',
  goldLight: '#FFE44D',
  goldDark: '#E6C200',

  // ============================================
  // UI Element Colors
  // ============================================
  border: '#333333',
  borderLight: '#444444',
  borderDark: '#222222',

  disabled: '#555555',
  placeholder: '#888888',

  divider: '#2A2A2A',

  // ============================================
  // Transparency
  // ============================================
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  overlayDark: 'rgba(0, 0, 0, 0.7)',
  overlayWhite: 'rgba(255, 255, 255, 0.1)',
  overlayWhiteLight: 'rgba(255, 255, 255, 0.05)',
} as const;

/**
 * Type for color keys
 */
export type ColorKey = keyof typeof Colors;

/**
 * Type for color values
 */
export type ColorValue = (typeof Colors)[ColorKey];

/**
 * Get a color value by key with optional fallback
 */
export function getColor(key: ColorKey, fallback?: string): string {
  return Colors[key] || fallback || Colors.text;
}
