/**
 * Spacing Tokens
 * Spacing scale, border radius, and layout values
 */

/**
 * Spacing scale (in pixels)
 * Based on 4px base unit
 */
export const Spacing = {
  '0': 0,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '9': 36,
  '10': 40,
  '11': 44,
  '12': 48,
  '14': 56,
  '16': 64,
  '20': 80,
  '24': 96,
  '28': 112,
  '32': 128,
} as const;

/**
 * Semantic spacing aliases
 */
export const SpacingSemantic = {
  xs: Spacing['1'],    // 4
  sm: Spacing['2'],    // 8
  md: Spacing['4'],    // 16
  lg: Spacing['6'],    // 24
  xl: Spacing['8'],    // 32
  '2xl': Spacing['10'], // 40
  '3xl': Spacing['12'], // 48
  '4xl': Spacing['16'], // 64
} as const;

/**
 * Border radius values
 */
export const BorderRadius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

/**
 * Border width values
 */
export const BorderWidth = {
  '0': 0,
  '1': 1,
  '2': 2,
  '4': 4,
  '8': 8,
} as const;

/**
 * Shadow definitions
 */
export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
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
  '2xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
} as const;

/**
 * Layout constants
 */
export const Layout = {
  screenPadding: Spacing['6'],      // 24
  containerMaxWidth: 500,
  inputHeight: 52,
  buttonHeight: 52,
  buttonHeightSmall: 40,
  buttonHeightLarge: 56,
  headerHeight: 56,
  tabBarHeight: 60,
  iconSize: {
    xs: 12,
    sm: 16,
    md: 24,
    lg: 32,
    xl: 40,
  },
  hitSlop: {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
  },
} as const;

/**
 * Z-index values for layering
 */
export const ZIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
} as const;

export type SpacingKey = keyof typeof Spacing;
export type BorderRadiusKey = keyof typeof BorderRadius;
export type ShadowKey = keyof typeof Shadows;
