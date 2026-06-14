/**
 * Route Constants
 * Type-safe route name constants for navigation
 */

/**
 * Route names for the entire application
 */
export const ROUTES = {
  /**
   * Onboarding Stack Routes (5-screen Figma flow + retained auth screen)
   * OB00_Splash → OB01_Welcome → OB02_Name → OB03_Region → OB04_Pull
   *   → OB10_SignUp (or OB10_Login) → OB11_Notifications (final; completes onboarding)
   */
  ONBOARDING: {
    OB00_SPLASH: 'OB00_Splash',
    OB01_WELCOME: 'OB01_Welcome',
    OB02_NAME: 'OB02_Name',
    OB03_REGION: 'OB03_Region',
    OB04_PULL: 'OB04_Pull',
    OB10_SIGNUP: 'OB10_SignUp',
    OB10_LOGIN: 'OB10_Login',
    OB11_NOTIFICATIONS: 'OB11_Notifications',
  },

  /**
   * Main Stack Routes (authenticated users)
   */
  MAIN: {
    TABS: 'MainTabs',
    SITE_DETAIL: 'SiteDetail',
    AR_EXPERIENCE: 'ARExperience',
    AR_COMPOSER: 'ARComposer',
    PURCHASE: 'Purchase',
    HISTORY: 'History',
    ANCHOR_CAPTURE: 'AnchorCapture',
    AR_3D_VIEWER: 'Ar3dViewer',
    AI_GUIDE: 'AiGuide',
    DETECT_AR: 'DetectAr',
    GO_TO_VENUE: 'GoToVenue',
  },

  /**
   * Tab Navigator Routes (4-tab layout: Home · Passport · Daily · Account)
   */
  TABS: {
    HOME: 'Home',
    PASSPORT: 'Passport',
    DAILY: 'Daily',
    ACCOUNT: 'Account',
  },
} as const;

/**
 * Type helper for route names
 */
export type OnboardingRoutes = (typeof ROUTES.ONBOARDING)[keyof typeof ROUTES.ONBOARDING];
export type MainRoutes = (typeof ROUTES.MAIN)[keyof typeof ROUTES.MAIN];
export type TabRoutes = (typeof ROUTES.TABS)[keyof typeof ROUTES.TABS];
