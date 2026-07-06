/**
 * Guided product-tour step definitions.
 *
 * Each step declares WHERE to navigate (`nav`), an optional element to spotlight
 * (`targetId`, registered by screens via useTourTarget), and i18n copy keys. The
 * driver (src/components/tour/TourHost.tsx) walks these in order; steps without a
 * resolvable on-screen target render a centered explainer card instead.
 *
 * Deliberately short (8 steps) and limited to ABOVE-THE-FOLD targets on the four
 * tabs: off-fold targets can't be spotlighted (no auto-scroll) and used to degrade
 * into mis-placed centered cards, and the old deep-flow steps (SiteDetail → live
 * camera → paywall) yanked first-run users into a camera-permission prompt and a
 * purchase screen mid-tour. Deep flows are discoverable from Home instead.
 */
import {ROUTES} from '../core/constants';

export type TourPlacement = 'top' | 'bottom' | 'auto';

export type TourNav =
  | {kind: 'tab'; tab: string}
  | {kind: 'screen'; route: string; params?: Record<string, unknown>};

export interface TourStep {
  id: string;
  nav: TourNav;
  /** Element to spotlight; omit (or if unmeasurable) → centered explainer. */
  targetId?: string;
  titleKey: string;
  bodyKey: string;
  placement?: TourPlacement;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    nav: {kind: 'tab', tab: ROUTES.TABS.HOME},
    titleKey: 'tour.welcome.title',
    bodyKey: 'tour.welcome.body',
  },
  {
    id: 'home.search',
    nav: {kind: 'tab', tab: ROUTES.TABS.HOME},
    targetId: 'home.search',
    titleKey: 'tour.search.title',
    bodyKey: 'tour.search.body',
    placement: 'bottom',
  },
  {
    id: 'home.map',
    nav: {kind: 'tab', tab: ROUTES.TABS.HOME},
    targetId: 'home.map',
    titleKey: 'tour.map.title',
    bodyKey: 'tour.map.body',
    placement: 'auto',
  },
  {
    id: 'home.nearest',
    nav: {kind: 'tab', tab: ROUTES.TABS.HOME},
    targetId: 'home.nearest',
    titleKey: 'tour.nearest.title',
    bodyKey: 'tour.nearest.body',
    placement: 'top',
  },
  {
    id: 'passport.rank',
    nav: {kind: 'tab', tab: ROUTES.TABS.PASSPORT},
    targetId: 'passport.rank',
    titleKey: 'tour.rank.title',
    bodyKey: 'tour.rank.body',
    placement: 'bottom',
  },
  {
    id: 'daily.streak',
    nav: {kind: 'tab', tab: ROUTES.TABS.DAILY},
    targetId: 'daily.streak',
    titleKey: 'tour.streak.title',
    bodyKey: 'tour.streak.body',
    placement: 'bottom',
  },
  {
    id: 'account.profile',
    nav: {kind: 'tab', tab: ROUTES.TABS.ACCOUNT},
    targetId: 'account.profile',
    titleKey: 'tour.profile.title',
    bodyKey: 'tour.profile.body',
    placement: 'bottom',
  },
  {
    id: 'finish',
    nav: {kind: 'tab', tab: ROUTES.TABS.HOME},
    titleKey: 'tour.finish.title',
    bodyKey: 'tour.finish.body',
  },
];
