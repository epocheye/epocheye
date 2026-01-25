/**
 * Typography Tokens
 * Font families, sizes, and line heights
 */

/**
 * Font family variants
 */
export const FontFamily = {
  regular: 'MontserratAlternates-Regular',
  thin: 'MontserratAlternates-Thin',
  thinItalic: 'MontserratAlternates-ThinItalic',
  extraLight: 'MontserratAlternates-ExtraLight',
  extraLightItalic: 'MontserratAlternates-ExtraLightItalic',
  light: 'MontserratAlternates-Light',
  lightItalic: 'MontserratAlternates-LightItalic',
  italic: 'MontserratAlternates-Italic',
  medium: 'MontserratAlternates-Medium',
  mediumItalic: 'MontserratAlternates-MediumItalic',
  semiBold: 'MontserratAlternates-SemiBold',
  semiBoldItalic: 'MontserratAlternates-SemiBoldItalic',
  bold: 'MontserratAlternates-Bold',
  boldItalic: 'MontserratAlternates-BoldItalic',
  extraBold: 'MontserratAlternates-ExtraBold',
  extraBoldItalic: 'MontserratAlternates-ExtraBoldItalic',
  black: 'MontserratAlternates-Black',
  blackItalic: 'MontserratAlternates-BlackItalic',
} as const;

/**
 * Font size scale
 */
export const FontSize = {
  '2xs': 10,
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
} as const;

/**
 * Line height multipliers
 */
export const LineHeight = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

/**
 * Letter spacing values
 */
export const LetterSpacing = {
  tighter: -0.05,
  tight: -0.025,
  normal: 0,
  wide: 0.025,
  wider: 0.05,
  widest: 0.1,
} as const;

/**
 * Pre-defined text styles for common use cases
 */
export const TextStyles = {
  // Headings
  h1: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['4xl'],
    lineHeight: LineHeight.tight,
  },
  h2: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['3xl'],
    lineHeight: LineHeight.tight,
  },
  h3: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize['2xl'],
    lineHeight: LineHeight.snug,
  },
  h4: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xl,
    lineHeight: LineHeight.snug,
  },
  h5: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.lg,
    lineHeight: LineHeight.normal,
  },
  h6: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    lineHeight: LineHeight.normal,
  },

  // Body text
  bodyLarge: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.lg,
    lineHeight: LineHeight.relaxed,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    lineHeight: LineHeight.normal,
  },
  bodySmall: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: LineHeight.normal,
  },

  // Labels
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    lineHeight: LineHeight.normal,
  },
  labelSmall: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    lineHeight: LineHeight.normal,
  },

  // Captions
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: LineHeight.normal,
  },
  captionSmall: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize['2xs'],
    lineHeight: LineHeight.normal,
  },

  // Buttons
  button: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    lineHeight: LineHeight.tight,
  },
  buttonSmall: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    lineHeight: LineHeight.tight,
  },
} as const;

export type FontFamilyKey = keyof typeof FontFamily;
export type FontSizeKey = keyof typeof FontSize;
export type LineHeightKey = keyof typeof LineHeight;
export type TextStyleKey = keyof typeof TextStyles;
