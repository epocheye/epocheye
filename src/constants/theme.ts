/**
 * Theme Constants
 * Centralized color, typography, and spacing system for the app
 *
 * @deprecated Use design-system tokens directly from '@design-system/tokens'
 * This file is kept for backward compatibility during migration.
 */

import {
  Colors as DesignColors,
  FontFamily,
  FontSize,
  LineHeight,
  SpacingSemantic,
  BorderRadius as DesignBorderRadius,
  Shadows as DesignShadows,
  Layout as DesignLayout,
} from '../design-system/tokens';

/**
 * Colors - re-exported from design system
 */
export const Colors = DesignColors;

/**
 * Typography - legacy structure for backward compatibility
 */
export const Typography = {
  fontFamily: FontFamily,
  fontSize: FontSize,
  lineHeight: LineHeight,
};

/**
 * Spacing - re-exported semantic spacing from design system
 */
export const Spacing = SpacingSemantic;

/**
 * BorderRadius - re-exported from design system
 */
export const BorderRadius = DesignBorderRadius;

/**
 * Shadows - re-exported from design system
 */
export const Shadows = DesignShadows;

/**
 * Layout - re-exported from design system
 */
export const Layout = DesignLayout;

/**
 * Default export for backward compatibility
 */
export default {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Layout,
};
