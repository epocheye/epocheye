/**
 * Display + UI font families for the onboarding v2 design system.
 *
 * The design brief asks for Playfair Display (display) + Inter (UI).
 * Those TTFs are not bundled in this app and cannot be fetched at runtime,
 * so we substitute with already-bundled families:
 *
 *   Display → Cormorant Garamond (Regular, SemiBold)
 *   UI      → DM Sans (Regular, Medium)
 *
 * Heavier display weights collapse to SemiBold; italic is expressed via
 * `fontStyle: 'italic'` on the Regular family because no italic TTF is
 * bundled. When Playfair/Inter TTFs are later added to
 * `src/assets/fonts/` and linked via `npx react-native-asset`, flip the
 * family names here and the entire system swaps.
 *
 * MontserratAlternates continues to drive the brand mark (AnimatedLogo)
 * via `FONTS` in `./theme`.
 */

export const DISPLAY_FONTS = {
  regular: 'CormorantGaramond-Regular',
  semiBold: 'CormorantGaramond-SemiBold',
  // No bundled Bold/ExtraBold — fall back to SemiBold.
  bold: 'CormorantGaramond-SemiBold',
  extraBold: 'CormorantGaramond-SemiBold',
  // No bundled italic — consumers must also set `fontStyle: 'italic'`.
  italic: 'CormorantGaramond-Regular',
  boldItalic: 'CormorantGaramond-SemiBold',
} as const;

export const UI_FONTS = {
  light: 'DMSans-Regular',
  regular: 'DMSans-Regular',
  medium: 'DMSans-Medium',
  // DM Sans SemiBold/Bold not bundled — fall back to Medium.
  semiBold: 'DMSans-Medium',
  bold: 'DMSans-Medium',
} as const;

export type DisplayFont = (typeof DISPLAY_FONTS)[keyof typeof DISPLAY_FONTS];
export type UiFont = (typeof UI_FONTS)[keyof typeof UI_FONTS];
