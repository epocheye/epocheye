/**
 * Route Constants
 * Type-safe route name constants for navigation
 */

/**
 * Route names for the entire application
 */
export const ROUTES = {
  /**
   * Onboarding Stack Routes (12-screen Duolingo-style flow)
   * OB00_Splash → OB01_Welcome → ... → OB12_Arrival
   */
  ONBOARDING: {
    OB00_SPLASH: 'OB00_Splash',
    OB01_WELCOME: 'OB01_Welcome',
    OB02_MOTIVATION: 'OB02_Motivation',
    OB03_FREQUENCY: 'OB03_Frequency',
    OB04_GOAL: 'OB04_Goal',
    OB05_REGION: 'OB05_Region',
    OB06_NAME: 'OB06_Name',
    OB07_PROMISE: 'OB07_Promise',
    OB08_DEMO_STORY: 'OB08_DemoStory',
    OB09_REACTION: 'OB09_Reaction',
    OB10_SIGNUP: 'OB10_SignUp',
    OB10_LOGIN: 'OB10_Login',
    OB11_NOTIFICATIONS: 'OB11_Notifications',
    OB12_ARRIVAL: 'OB12_Arrival',
  },

  /**
   * Main Stack Routes (authenticated users)
   */
  MAIN: {
    TABS: 'MainTabs',
    LENS: 'Lens',
    SITE_DETAIL: 'SiteDetail',
    AR_EXPERIENCE: 'ARExperience',
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
