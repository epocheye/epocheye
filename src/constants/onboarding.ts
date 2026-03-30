/**
 * Onboarding Design Tokens & Constants
 * Used across all OB00–OB12 onboarding screens.
 */

import { baseUrl } from '@env';
import { FONTS } from '../core/constants/theme';

export const OB_COLORS = {
  bg: '#0D0D0D',
  accent: '#E8A020',
  accentBg: '#1F1800',
  white: '#FFFFFF',
  grey: '#8C93A0',
  tile: '#1A1A1A',
  tileBorder: '#2A2A2A',
  lgrey: '#DDE1E7',
} as const;

export const OB_TYPOGRAPHY = {
  heading: {
    fontSize: 26,
    lineHeight: 34,
    color: '#FFFFFF',
    fontFamily: FONTS.extraBold,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: '#8C93A0',
    fontFamily: FONTS.regular,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: '#FFFFFF',
    fontFamily: FONTS.regular,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
  },
  tiny: {
    fontSize: 11,
    lineHeight: 16,
    color: '#8C93A0',
    fontFamily: FONTS.medium,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
} as const;

const parsedBaseUrl = typeof baseUrl === 'string' ? baseUrl.trim() : '';
export const BACKEND_URL = parsedBaseUrl.length > 0 ? parsedBaseUrl : 'http://localhost:8080';
