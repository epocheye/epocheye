/**
 * Route Constants
 * Type-safe route name constants for navigation
 */

/**
 * Route names for the entire application
 */
export const ROUTES = {
  /**
   * Auth Stack Routes (unauthenticated users)
   */
  AUTH: {
    LANDING: 'Landing',
    LOGIN: 'Login',
    REGISTER: 'Register',
    ONBOARDING: 'OnboardingFlow',
    PERMISSIONS: 'Permissions',
    FORGOT_PASSWORD: 'ForgotPassword',
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

  /**
   * Onboarding Flow Sub-routes
   */
  ONBOARDING: {
    INTRO: 'OnboardingIntro',
    QUESTIONNAIRE: 'Questionnaire',
    SETUP_COMPLETE: 'SetupComplete',
  },
} as const;

/**
 * Type helper for route names
 */
export type AuthRoutes = (typeof ROUTES.AUTH)[keyof typeof ROUTES.AUTH];
export type MainRoutes = (typeof ROUTES.MAIN)[keyof typeof ROUTES.MAIN];
export type TabRoutes = (typeof ROUTES.TABS)[keyof typeof ROUTES.TABS];
export type OnboardingRoutes = (typeof ROUTES.ONBOARDING)[keyof typeof ROUTES.ONBOARDING];
