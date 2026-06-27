/**
 * Guided product-tour step definitions.
 *
 * Each step declares WHERE to navigate (`nav`), an optional element to spotlight
 * (`targetId`, registered by screens via useTourTarget), and i18n copy keys. The
 * driver (src/components/tour/TourHost.tsx) walks these in order; steps without a
 * resolvable on-screen target render a centered explainer card instead.
 */
import {ROUTES} from '../core/constants';

export type TourPlacement = 'top' | 'bottom' | 'auto';

export type TourNav =
  | {kind: 'tab'; tab: string}
  | {kind: 'screen'; route: string; params?: Record<string, unknown>}
  | {kind: 'site'} // open SiteDetail with the resolved sample site
  | {kind: 'detectAr'}; // open the AR camera in tour mode (sample site)

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
    id: 'home.bell',
    nav: {kind: 'tab', tab: ROUTES.TABS.HOME},
    targetId: 'home.bell',
    titleKey: 'tour.bell.title',
    bodyKey: 'tour.bell.body',
    placement: 'bottom',
  },
  {
    id: 'home.hud',
    nav: {kind: 'tab', tab: ROUTES.TABS.HOME},
    targetId: 'home.hud',
    titleKey: 'tour.hud.title',
    bodyKey: 'tour.hud.body',
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
    id: 'passport.stamps',
    nav: {kind: 'tab', tab: ROUTES.TABS.PASSPORT},
    targetId: 'passport.stamps',
    titleKey: 'tour.stamps.title',
    bodyKey: 'tour.stamps.body',
    placement: 'top',
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
    id: 'daily.story',
    nav: {kind: 'tab', tab: ROUTES.TABS.DAILY},
    targetId: 'daily.story',
    titleKey: 'tour.story.title',
    bodyKey: 'tour.story.body',
    placement: 'top',
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
    id: 'account.language',
    nav: {kind: 'tab', tab: ROUTES.TABS.ACCOUNT},
    targetId: 'account.language',
    titleKey: 'tour.language.title',
    bodyKey: 'tour.language.body',
    placement: 'top',
  },
  {
    id: 'siteDetail',
    nav: {kind: 'site'},
    targetId: 'siteDetail.viewAr',
    titleKey: 'tour.site.title',
    bodyKey: 'tour.site.body',
    placement: 'top',
  },
  {
    id: 'detectAr',
    nav: {kind: 'detectAr'},
    titleKey: 'tour.scan.title',
    bodyKey: 'tour.scan.body',
  },
  {
    id: 'purchase',
    nav: {kind: 'screen', route: ROUTES.MAIN.PURCHASE},
    titleKey: 'tour.passport.title',
    bodyKey: 'tour.passport.body',
  },
  {
    id: 'finish',
    nav: {kind: 'tab', tab: ROUTES.TABS.HOME},
    titleKey: 'tour.finish.title',
    bodyKey: 'tour.finish.body',
  },
];
