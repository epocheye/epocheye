/**
 * Route Constants
 * Type-safe route name constants for navigation
 */

/**
 * Route names for the entire application
 */
export const ROUTES = {
  /**
   * Onboarding Stack Routes (first-launch flow)
   * SplashVideo → Hook → AncestryInput → FirstTaste → Signup → Welcome
   */
  ONBOARDING: {
    SPLASH_VIDEO: 'SplashVideo',
    HOOK: 'Hook',
    EMOTIONAL_QUESTION: 'EmotionalQuestion',
    MIRROR_MOMENT: 'MirrorMoment',
    ANCESTRY_INPUT: 'AncestryInput',
    FIRST_TASTE: 'FirstTaste',
    SIGNUP: 'Signup',
    ONBOARDING_PERMISSIONS: 'OnboardingPermissions',
    WORLD_OPENS: 'WorldOpens',
    WELCOME: 'Welcome',
  },

  /**
   * Main Stack Routes (authenticated users)
   */
  MAIN: {
    TABS: 'MainTabs',
    SITE_DETAIL: 'SiteDetail',
    AR_EXPERIENCE: 'ARExperience',
    NAVIGATION: 'NavigationScreen',
    PERMISSIONS: 'Permissions',
  },

  /**
   * Tab Navigator Routes
   */
  TABS: {
    HOME: 'Home',
    EXPLORE: 'Explore',
    CHALLENGES: 'Challenges',
    SAVED: 'Saved',
    SETTINGS: 'Settings',
  },
} as const;

/**
 * Type helper for route names
 */
export type OnboardingRoutes = (typeof ROUTES.ONBOARDING)[keyof typeof ROUTES.ONBOARDING];
export type MainRoutes = (typeof ROUTES.MAIN)[keyof typeof ROUTES.MAIN];
export type TabRoutes = (typeof ROUTES.TABS)[keyof typeof ROUTES.TABS];
