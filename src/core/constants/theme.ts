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
  handwritten: 'NothingYouCouldDo-Regular',
  serifItalic: 'InstrumentSerif-Italic',

  /** Instrument family — primary for Round 3 redesign screens. */
  serif: 'InstrumentSerif-Regular',
  sans: 'InstrumentSans-Regular',
  sansMedium: 'InstrumentSans-Medium',
  sansSemiBold: 'InstrumentSans-SemiBold',
  sansBold: 'InstrumentSans-Bold',

  /**
   * Premium pairing (heritage-gold redesign): Cormorant Garamond display serif
   * for headlines/numerals + DM Sans grotesk for UI/body. Both already bundled
   * and natively linked — no rebuild required.
   */
  display: 'CormorantGaramond-SemiBold',
  displayRegular: 'CormorantGaramond-Regular',
  ui: 'DMSans-Regular',
  uiMedium: 'DMSans-Medium',
} as const;

export const COLORS = {
  /** Core backgrounds — premium warm-black, layered. */
  bg: '#0A0A0C',
  bgWarm: '#131218',
  bgCard: 'rgba(255,255,255,0.05)',

  /**
   * Primary accent — antique champagne gold (premium heritage redesign).
   * `amber*` / `sky*` key names kept so every existing screen repoints for free.
   */
  amber: '#CBA862',
  amberLight: '#E6C88B',
  amberDark: '#B8923F',
  amberSubtle: 'rgba(203,168,98,0.14)',

  /** Gold accents (aliases of the primary above; key names preserved). */
  sky: '#CBA862',
  skyLight: '#E6C88B',
  skyDark: '#B8923F',
  /** Deep end for the gold gradient. */
  skyDeep: '#9C7B3A',
  /** Gold glow used for depth on dark surfaces (in place of drop shadows). */
  skyGlow: 'rgba(203,168,98,0.16)',
  lime: '#C9A24B',
  limeDark: '#A8843A',

  /** Explicit gold tokens for new (gamification) UI. */
  gold: '#CBA862',
  goldLight: '#E6C88B',
  goldDeep: '#9C7B3A',

  /** Elevated surface + glass treatment for premium cards. */
  cardElevated: '#1A1822',
  glass: 'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(255,255,255,0.10)',

  /** Gamification helpers. */
  xpTrack: 'rgba(255,255,255,0.08)',
  badgeLocked: '#1B1A21',

  /** Text hierarchy — warm parchment white. */
  textPrimary: '#F4EFE7',
  textSecondary: 'rgba(244,239,231,0.70)',
  textTertiary: 'rgba(244,239,231,0.45)',
  textMuted: 'rgba(244,239,231,0.30)',

  /** Borders & dividers — hairlines. */
  border: 'rgba(255,255,255,0.10)',
  borderFocus: 'rgba(203,168,98,0.35)',

  /** Overlays */
  overlayLight: 'rgba(0,0,0,0.4)',
  overlayDark: 'rgba(0,0,0,0.75)',

  /** Social auth */
  google: '#FFFFFF',
  apple: '#000000',

  /** Status */
  error: '#C2553F',
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

/**
 * Gold accent gradient (light → base → deep) for headers, hero cards, CTAs.
 * Exported as a plain mutable string[] so it satisfies LinearGradient's
 * `colors` prop type (COLORS is `as const`, which would make it readonly).
 */
export const SKY_GRADIENT: string[] = ['#E6C88B', '#CBA862', '#B8923F'];

/** Alias under the redesign's own name; same values as SKY_GRADIENT. */
export const GOLD_GRADIENT: string[] = ['#E6C88B', '#CBA862', '#B8923F'];

/** CDN base for monument/region images */
export const CDN_BASE =
  'https://cdn.jsdelivr.net/gh/epocheye/epocheye/src/assets/';
