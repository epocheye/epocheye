/**
 * Route Constants
 * Type-safe route name constants for navigation
 */

/**
 * Route names for the entire application
 */
export const ROUTES = {
  /**
   * Onboarding Stack Routes (4-screen Figma flow + retained auth/arrival screens)
   * OB00_Splash → OB01_Welcome → OB02_Name → OB03_Region
   *   → OB10_SignUp (or OB10_Login) → OB11_Notifications → OB12_Arrival
   */
  ONBOARDING: {
    OB00_SPLASH: 'OB00_Splash',
    OB01_WELCOME: 'OB01_Welcome',
    OB02_NAME: 'OB02_Name',
    OB03_REGION: 'OB03_Region',
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
    AR_COMPOSER: 'ARComposer',
    TOUR_LIST: 'TourList',
    TOUR_DETAIL: 'TourDetail',
    MY_TOURS: 'MyTours',
    PURCHASE: 'Purchase',
    NOTIFICATIONS: 'Notifications',
  },

  /**
   * Tab Navigator Routes
   */
  TABS: {
    HOME: 'Home',
    EXPLORE: 'Explore',
    PLAN: 'Plan',
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
