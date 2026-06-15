/**
 * Display + UI font families for the onboarding v2 design system.
 *
 * Premium heritage-gold pairing (bundled in `src/assets/fonts/`, linked via
 * `npx react-native-asset`):
 *
 *   Display → Fraunces (Regular, SemiBold, Bold)
 *   UI      → Plus Jakarta Sans (Regular, Medium, SemiBold)
 *
 * File names == PostScript names so the same family resolves on Android
 * (filename) and iOS (Info.plist UIAppFonts / PostScript name). No italic TTF
 * is bundled, so italic is expressed via `fontStyle: 'italic'` on Regular.
 *
 * MontserratAlternates continues to drive the brand mark (AnimatedLogo)
 * via `FONTS` in `./theme`.
 */

export const DISPLAY_FONTS = {
  regular: 'Fraunces-Regular',
  semiBold: 'Fraunces-SemiBold',
  bold: 'Fraunces-Bold',
  // No bundled ExtraBold — fall back to Bold.
  extraBold: 'Fraunces-Bold',
  // No bundled italic — consumers must also set `fontStyle: 'italic'`.
  italic: 'Fraunces-Regular',
  boldItalic: 'Fraunces-Bold',
} as const;

export const UI_FONTS = {
  light: 'PlusJakartaSans-Regular',
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semiBold: 'PlusJakartaSans-SemiBold',
  // No bundled Bold — fall back to SemiBold.
  bold: 'PlusJakartaSans-SemiBold',
} as const;

export type DisplayFont = (typeof DISPLAY_FONTS)[keyof typeof DISPLAY_FONTS];
export type UiFont = (typeof UI_FONTS)[keyof typeof UI_FONTS];
