/**
 * Onboarding Design Tokens v2 — "Through the Lens"
 * Heritage gold, glass surfaces, AR motifs, editorial serif display.
 *
 * Font mapping — Playfair + Inter not bundled, so we substitute with
 * already-bundled Cormorant Garamond + DM Sans. See src/core/constants/fonts.ts.
 */

import {API_CONFIG} from '../core/config';
import {DISPLAY_FONTS, UI_FONTS} from '../core/constants/fonts';

// ─── Backgrounds ──────────────────────────────────────
export const BG = {
  deep: '#07060C',
  warm: '#0C0906',
  glass: 'rgba(255,255,255,0.055)',
  glassHover: 'rgba(255,255,255,0.085)',
  glassStrong: 'rgba(255,255,255,0.11)',
  glassWarm: 'rgba(201,168,76,0.06)',
  stone: '#1A1714',
  stoneLight: '#242017',
} as const;

// ─── Brand — Heritage Gold ────────────────────────────
export const GOLD = {
  primary: '#C9A84C',
  light: '#E0C06A',
  dark: '#9A7828',
  glow: 'rgba(201,168,76,0.35)',
  glowStrong: 'rgba(201,168,76,0.55)',
  subtle: 'rgba(201,168,76,0.09)',
  border: 'rgba(201,168,76,0.35)',
  borderStrong: 'rgba(201,168,76,0.70)',
  text: '#D4B05A',
} as const;

// ─── Secondary accents ────────────────────────────────
export const ACCENT = {
  indigo: '#8B9FE8',
  indigoSubtle: 'rgba(139,159,232,0.12)',
  indigoGlow: 'rgba(139,159,232,0.22)',
  terracotta: '#C46B3A',
} as const;

// ─── Text — warm parchment ────────────────────────────
export const TEXT = {
  primary: '#F4EFE8',
  secondary: 'rgba(244,239,232,0.65)',
  muted: 'rgba(244,239,232,0.40)',
  dim: 'rgba(244,239,232,0.22)',
  gold: '#D4B05A',
  dark: '#0A0808',
} as const;

// ─── Borders ──────────────────────────────────────────
export const BORDER = {
  subtle: 'rgba(255,255,255,0.07)',
  medium: 'rgba(255,255,255,0.12)',
  strong: 'rgba(255,255,255,0.20)',
  gold: GOLD.border,
  goldStrong: GOLD.borderStrong,
} as const;

// ─── Radii ────────────────────────────────────────────
export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

// ─── Spacing ──────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 44,
  screen: 24,
} as const;

// ─── Typography presets ───────────────────────────────
// Display fonts collapse to CormorantGaramond-SemiBold where the brief
// called for Bold/ExtraBold (no heavier weight is bundled). Italic is
// rendered by applying fontStyle:'italic' on the Regular family.
export const TYPE = {
  displayHero: {
    fontFamily: DISPLAY_FONTS.semiBold,
    fontSize: 40,
    lineHeight: 50,
    color: TEXT.primary,
  },
  displayLarge: {
    fontFamily: DISPLAY_FONTS.semiBold,
    fontSize: 32,
    lineHeight: 42,
    color: TEXT.primary,
  },
  displayMedium: {
    fontFamily: DISPLAY_FONTS.semiBold,
    fontSize: 26,
    lineHeight: 34,
    color: TEXT.primary,
  },
  displaySmall: {
    fontFamily: DISPLAY_FONTS.regular,
    fontSize: 20,
    lineHeight: 28,
    color: TEXT.primary,
  },
  displayItalic: {
    fontFamily: DISPLAY_FONTS.italic,
    fontStyle: 'italic' as const,
    fontSize: 16,
    lineHeight: 24,
    color: TEXT.secondary,
  },

  uiLarge: {
    fontFamily: UI_FONTS.semiBold,
    fontSize: 17,
    lineHeight: 24,
    color: TEXT.primary,
  },
  uiMedium: {
    fontFamily: UI_FONTS.medium,
    fontSize: 15,
    lineHeight: 22,
    color: TEXT.primary,
  },
  uiRegular: {
    fontFamily: UI_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: TEXT.secondary,
  },
  uiSmall: {
    fontFamily: UI_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT.muted,
  },
  uiTiny: {
    fontFamily: UI_FONTS.medium,
    fontSize: 11,
    lineHeight: 15,
    color: TEXT.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },

  storyBody: {
    fontFamily: DISPLAY_FONTS.regular,
    fontSize: 16,
    lineHeight: 28,
    color: '#F0EBD8',
  },
  label: {
    fontFamily: UI_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: TEXT.primary,
  },
  button: {
    fontFamily: UI_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFFFF',
  },
} as const;

// ─── Shadow / glow presets ────────────────────────────
export const GLOW = {
  gold: {
    shadowColor: GOLD.primary,
    shadowOffset: {width: 0, height: 0},
    shadowRadius: 20,
    shadowOpacity: 0.45,
    elevation: 12,
  },
  goldSubtle: {
    shadowColor: GOLD.primary,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 12,
    shadowOpacity: 0.25,
    elevation: 6,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 24,
    shadowOpacity: 0.5,
    elevation: 10,
  },
} as const;

// ─── Backward-compatible aliases ──────────────────────
// Preserved so non-onboarding consumers (and OB11/OB12, which retain the
// older look) keep compiling. Prefer the v2 tokens above in new code.
export const OB_COLORS = {
  bg: BG.deep,
  accent: GOLD.primary,
  accentBg: BG.stone,
  white: TEXT.primary,
  grey: TEXT.muted,
  tile: BG.glass,
  tileBorder: BORDER.medium,
  lgrey: TEXT.secondary,
} as const;

export const OB_TYPOGRAPHY = {
  heading: TYPE.displayMedium,
  sub: TYPE.uiRegular,
  body: TYPE.uiMedium,
  label: TYPE.label,
  tiny: TYPE.uiTiny,
} as const;

export const BACKEND_URL = API_CONFIG.BASE_URL;
