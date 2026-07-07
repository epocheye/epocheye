/**
 * Spacing Tokens
 * Spacing scale, border radius, and layout values
 *
 * Numeric leaves are routed through `moderateScale` so spacing/radii/layout
 * dimensions shrink or grow with the device (see src/utils/scaling.ts).
 * `SpacingSemantic` and `Layout.screenPadding` read `Spacing.*`, so they
 * inherit the scaling for free.
 */
import { moderateScale } from '../../utils/scaling';

/**
 * Spacing scale (in pixels)
 * Based on 4px base unit
 */
export const Spacing = {
  '0': 0,
  '0.5': moderateScale(2),
  '1': moderateScale(4),
  '1.5': moderateScale(6),
  '2': moderateScale(8),
  '2.5': moderateScale(10),
  '3': moderateScale(12),
  '4': moderateScale(16),
  '5': moderateScale(20),
  '6': moderateScale(24),
  '7': moderateScale(28),
  '8': moderateScale(32),
  '9': moderateScale(36),
  '10': moderateScale(40),
  '11': moderateScale(44),
  '12': moderateScale(48),
  '14': moderateScale(56),
  '16': moderateScale(64),
  '20': moderateScale(80),
  '24': moderateScale(96),
  '28': moderateScale(112),
  '32': moderateScale(128),
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
  sm: moderateScale(8),
  md: moderateScale(12),
  lg: moderateScale(16),
  xl: moderateScale(20),
  '2xl': moderateScale(24),
  '3xl': moderateScale(32),
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
  screenPadding: Spacing['6'],      // 24 (scaled)
  containerMaxWidth: 500,
  inputHeight: moderateScale(52),
  buttonHeight: moderateScale(52),
  buttonHeightSmall: moderateScale(40),
  buttonHeightLarge: moderateScale(56),
  headerHeight: moderateScale(56),
  tabBarHeight: moderateScale(60),
  iconSize: {
    xs: moderateScale(12),
    sm: moderateScale(16),
    md: moderateScale(24),
    lg: moderateScale(32),
    xl: moderateScale(40),
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
