/**
 * Theme Constants
 * Centralized design tokens for the EpochEye app.
 * All onboarding and auth screens pull from these values.
 */

export const FONTS = {
  light: 'MontserratAlternates-Light',
  regular: 'MontserratAlternates-Regular',
  medium: 'MontserratAlternates-Medium',
  semiBold: 'MontserratAlternates-SemiBold',
  bold: 'MontserratAlternates-Bold',
  extraBold: 'MontserratAlternates-ExtraBold',
  italic: 'MontserratAlternates-Italic',
  mediumItalic: 'MontserratAlternates-MediumItalic',
} as const;

export const COLORS = {
  /** Core backgrounds */
  bg: '#111111',
  bgWarm: '#1A1612',
  bgCard: 'rgba(255,255,255,0.06)',

  /** Brand amber */
  amber: '#D4860A',
  amberLight: '#E8A33A',
  amberDark: '#B06F08',
  amberSubtle: 'rgba(212,134,10,0.15)',

  /** Text hierarchy */
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textTertiary: 'rgba(255,255,255,0.45)',
  textMuted: 'rgba(255,255,255,0.3)',

  /** Borders & dividers */
  border: 'rgba(255,255,255,0.12)',
  borderFocus: 'rgba(255,255,255,0.25)',

  /** Overlays */
  overlayLight: 'rgba(0,0,0,0.4)',
  overlayDark: 'rgba(0,0,0,0.75)',

  /** Social auth */
  google: '#FFFFFF',
  apple: '#000000',

  /** Status */
  error: '#E5534B',
  success: '#3FB950',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
  screen: 48,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 40,
} as const;

export const FONT_SIZES = {
  caption: 12,
  small: 13,
  body: 15,
  button: 16,
  subtitle: 18,
  title: 22,
  heading: 28,
  hero: 34,
  display: 40,
} as const;

/** CDN base for monument/region images */
export const CDN_BASE =
  'https://cdn.jsdelivr.net/gh/epocheye/epocheye/src/assets/monuments';
