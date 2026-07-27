/**
 * Manifest for the dev-build Workflow Health-Check board
 * (src/screens/Dev/DevHealthCheckScreen.tsx).
 *
 * One row per user-facing workflow. Each row carries exactly one launch
 * strategy:
 *   - route:   navigate to a screen (with params) via navigateSafe
 *   - action:  run an imperative dev action (reset onboarding, start tour, …)
 *   - preview: render a component inline in the health screen (for surfaces
 *              that are normally unreachable off-site, e.g. ARSafetyNotice)
 *   - manual:  cannot be deep-launched; howToTest explains the steps
 *
 * DEV-ONLY: this module is only imported by the health screen, which is
 * `require`d behind `__DEV__`, so none of this enters the release bundle.
 */

import { Alert, DevSettings, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROUTES, STORAGE_KEYS } from '../core/constants';
import { navigateSafe } from '../navigation/navigationRef';
import { useTourStore } from '../stores/tourStore';
import { DEFAULT_MONUMENT_SLUG } from '../config/monuments';
import { MARQUEE_MODEL_ID, buildGlbUrl } from '../config/glbDelivery';
import { resolveModelGlb } from '../services/glbSource';

// ── Direct-GLB render test (no scan) ────────────────────────────────────────
// A known Indian Museum statue model id that is ALREADY on the production CDN:
// buildGlbUrl() → `${GLB_BASE_URL}/seated_buddha_oval_halo.glb`, verified to
// return HTTP 200, Content-Type model/gltf-binary, ~9.66 MB (glTF magic bytes).
// This is the exact URL the app resolves for this class_id in production, so the
// test exercises the real delivery + native-render path. SWAP THIS ONE LINE to
// probe a different model (any modelId under GLB_BASE_URL/<id>.glb).
const DIRECT_GLB_TEST_MODEL_ID = 'seated_buddha_oval_halo';
const DIRECT_GLB_TEST_URL = buildGlbUrl(DIRECT_GLB_TEST_MODEL_ID);

export type HealthLaunch =
  | { kind: 'route'; route: string; params?: Record<string, unknown> }
  | { kind: 'action'; label: string; run: () => void | Promise<void> }
  | { kind: 'preview'; previewId: 'ar-safety-notice' }
  | { kind: 'manual' };

export type HealthRequires =
  | 'device-at-site'
  | 'auth'
  | 'airplane-mode'
  | 'arcore'
  | 'push-config'
  | 'razorpay-test';

export interface HealthCheckItem {
  id: string;
  title: string;
  group: 'Entry' | 'Tabs' | 'Site & AR' | 'Commerce' | 'System';
  launch: HealthLaunch;
  requires?: HealthRequires;
  howToTest: string;
}

const SAMPLE_SITE_NAME = 'Konark Sun Temple';

async function launchWithMarqueeGlb(
  route: string,
  extraParams: Record<string, unknown>,
): Promise<void> {
  const glbUrl = await resolveModelGlb(MARQUEE_MODEL_ID);
  if (!glbUrl) {
    Alert.alert(
      'No GLB available',
      'resolveModelGlb returned null — check GLB_BASE_URL / CDN connectivity.',
    );
    return;
  }
  navigateSafe(route, {
    monumentId: DEFAULT_MONUMENT_SLUG,
    objectLabel: 'Konark Vimana',
    glbUrl,
    ...extraParams,
  });
}

export const HEALTH_CHECKS: HealthCheckItem[] = [
  // ── Entry ────────────────────────────────────────────────────────────────
  {
    id: 'onboarding-auth',
    title: 'Onboarding + sign-up/login',
    group: 'Entry',
    launch: {
      kind: 'action',
      label: 'Reset & reload',
      run: async () => {
        await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING.COMPLETED);
        DevSettings.reload();
      },
    },
    howToTest:
      'Clears the onboarding flag and reloads: walk OB00→OB11, then sign in (Google + email paths).',
  },
  {
    id: 'guided-tour',
    title: 'Guided app tour',
    group: 'Entry',
    launch: {
      kind: 'action',
      label: 'Start tour',
      run: () => {
        navigateSafe(ROUTES.MAIN.TABS, { screen: ROUTES.TABS.HOME });
        useTourStore.getState().start();
      },
    },
    howToTest:
      'Tour starts on Home: check card placement, Next/Back/Skip, progress, and that finishing lands back on Home.',
  },
  // ── Tabs ─────────────────────────────────────────────────────────────────
  {
    id: 'home-map',
    title: 'Home — map, nearest site, search',
    group: 'Tabs',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.TABS,
      params: { screen: ROUTES.TABS.HOME },
    },
    howToTest:
      'Map renders with pins; nearest-venue card correct; search returns places; no crash when switching tabs repeatedly.',
  },
  {
    id: 'passport',
    title: 'Passport — XP, streak, stamps, badges',
    group: 'Tabs',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.TABS,
      params: { screen: ROUTES.TABS.PASSPORT },
    },
    howToTest:
      'Rank/XP bar, day-streak, stamps grid and achievements load; numbers match your visit history.',
  },
  {
    id: 'daily',
    title: 'Daily — on this day story',
    group: 'Tabs',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.TABS,
      params: { screen: ROUTES.TABS.DAILY },
    },
    howToTest:
      'Today’s story loads with image + CTA; streak strip renders; empty/error state is calm.',
  },
  {
    id: 'settings-profile-language',
    title: 'Account — profile, permissions, language',
    group: 'Tabs',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.TABS,
      params: { screen: ROUTES.TABS.ACCOUNT },
    },
    howToTest:
      'Edit + save profile; cycle EN/HI/BN (UI + narration change together); logout/login round-trip.',
  },
  // ── Site & AR ────────────────────────────────────────────────────────────
  {
    id: 'site-detail',
    title: 'Site detail (deep-link path)',
    group: 'Site & AR',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.SITE_DETAIL,
      params: { slug: DEFAULT_MONUMENT_SLUG },
    },
    howToTest:
      'Resolves the slug like a deep link: hero image, sections, AI-guide and AR buttons all render.',
  },
  {
    id: 'detect-ar-lens',
    title: 'Lens / Detect AR (dev picker)',
    group: 'Site & AR',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.DETECT_AR,
      params: { devPicker: true },
    },
    requires: 'device-at-site',
    howToTest:
      'devPicker bypasses the venue gate for home testing. At a real site, also test the full gate → safety notice → scan flow.',
  },
  {
    id: 'station-authoring',
    title: 'Author viewing station (admin)',
    group: 'Site & AR',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.STATION_AUTHORING,
    },
    requires: 'arcore',
    howToTest:
      'On-site: load a model, place it, capture the geospatial pose + host a cloud anchor, then save a viewing station so prod visitors can be guided to it and see it world-locked.',
  },
  {
    id: 'site-reconstruction',
    title: 'Site reconstruction (prod experience)',
    group: 'Site & AR',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.SITE_RECONSTRUCTION,
    },
    requires: 'arcore',
    howToTest:
      'The visitor experience: guides you to the nearest authored viewing station and world-locks the reconstruction. Needs a saved station at your current site.',
  },
  {
    id: 'ar-safety-notice',
    title: 'AR safety notice (preview)',
    group: 'Site & AR',
    launch: { kind: 'preview', previewId: 'ar-safety-notice' },
    howToTest:
      'The Play-Families safety card: “I understand” proceeds, the top-right X closes it. Normally only shown at a venue.',
  },
  {
    id: 'ar-composer',
    title: 'AR composer (world-anchored model)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Launch with sample GLB',
      run: () =>
        launchWithMarqueeGlb(ROUTES.MAIN.AR_COMPOSER, {
          cached: false,
          provider: 'dev-health',
        }),
    },
    requires: 'arcore',
    howToTest:
      'Sample Konark model loads over the camera; anchors to a plane; back exits without closing the app.',
  },
  {
    id: 'ar-3d-viewer',
    title: '3D viewer (no-ARCore fallback)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Launch with sample GLB',
      run: () =>
        launchWithMarqueeGlb(ROUTES.MAIN.AR_3D_VIEWER, {
          siteName: SAMPLE_SITE_NAME,
        }),
    },
    howToTest: 'Model renders in orbit/zoom viewer; X closes it.',
  },
  {
    id: 'ar-direct-glb',
    title: 'Direct GLB render test (no scan)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Render sample GLB in AR',
      run: () => {
        if (!DIRECT_GLB_TEST_URL) {
          Alert.alert(
            'No GLB URL',
            'GLB_BASE_URL is empty — set it in .env to run the direct render test.',
          );
          return;
        }
        // Straight to the NATIVE AR view with a hardcoded model + no recognition:
        // DetectArScreen sees devDirectGlb, skips the scan/venue gate, and
        // auto-places the model in front of the camera via placeInFront().
        navigateSafe(ROUTES.MAIN.DETECT_AR, { devDirectGlb: DIRECT_GLB_TEST_URL });
      },
    },
    requires: 'arcore',
    howToTest:
      'Bypasses recognition entirely: acknowledge the AR safety notice, let ARCore start tracking (move the phone slightly), and the sample statue should appear ~1.2 m in front of the camera in live AR. Proves the native SceneView/Filament renderer shows a GLB on this device. No animation (static model by design).',
  },
  {
    id: 'ar-cloud-anchor-host',
    title: 'AR — Host Cloud Anchor',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Place + host',
      run: () => {
        if (!DIRECT_GLB_TEST_URL) {
          Alert.alert(
            'No GLB URL',
            'GLB_BASE_URL is empty — set it in .env to run the Cloud Anchor test.',
          );
          return;
        }
        navigateSafe(ROUTES.MAIN.DETECT_AR, {
          devDirectGlb: DIRECT_GLB_TEST_URL,
          devCloudAnchor: 'host',
        });
      },
    },
    requires: 'arcore',
    howToTest:
      'Needs the one-time GCP keyless setup (ARCore API enabled + Android OAuth client for the debug SHA-1). The sample statue auto-places ~1.2 m ahead once tracking; walk a slow arc around the spot for ~20 s, then tap "Host anchor (365d)". The overlay shows live quality/state — INSUFFICIENT_QUALITY means keep scanning and retry; ERROR_NOT_AUTHORIZED means the GCP setup is missing. On SUCCESS the Cloud Anchor ID shows on screen, is logged to Metro/adb, and is saved for the resolve test.',
  },
  {
    id: 'ar-cloud-anchor-resolve',
    title: 'AR — Resolve Cloud Anchor',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Resolve saved anchor',
      run: () => {
        if (!DIRECT_GLB_TEST_URL) {
          Alert.alert(
            'No GLB URL',
            'GLB_BASE_URL is empty — set it in .env to run the Cloud Anchor test.',
          );
          return;
        }
        navigateSafe(ROUTES.MAIN.DETECT_AR, {
          devDirectGlb: DIRECT_GLB_TEST_URL,
          devCloudAnchor: 'resolve',
        });
      },
    },
    requires: 'arcore',
    howToTest:
      'Round-trip proof — works after a FULL app kill. The last hosted anchor ID is prefilled (or paste one). Point the camera at the physical spot that was hosted, tap Resolve; on SUCCESS the sample statue appears at the ORIGINAL hosted pose (world-locked, not camera-relative). ERROR_CLOUD_ID_NOT_FOUND = wrong/expired ID.',
  },
  {
    id: 'ai-guide',
    title: 'AI guide chat',
    group: 'Site & AR',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.AI_GUIDE,
      params: { slug: DEFAULT_MONUMENT_SLUG, siteName: SAMPLE_SITE_NAME },
    },
    howToTest:
      'Welcome narration renders; ask a question → streamed answer; typing bar stays above the keyboard; back closes only the guide.',
  },
  {
    id: 'go-to-venue',
    title: 'Go-to-venue gate',
    group: 'Site & AR',
    launch: { kind: 'route', route: ROUTES.MAIN.GO_TO_VENUE },
    howToTest:
      'Nearest-venue card + directions CTA; X and hardware back close the screen (never the app).',
  },
  // ── Commerce ─────────────────────────────────────────────────────────────
  {
    id: 'purchase-payments',
    title: 'Purchase / paywall (Razorpay)',
    group: 'Commerce',
    launch: { kind: 'route', route: ROUTES.MAIN.PURCHASE },
    requires: 'razorpay-test',
    howToTest:
      'Plans + regional pricing load; coupon field stays visible with keyboard up; open checkout but do NOT complete a live charge.',
  },
  {
    id: 'suggest-site',
    title: 'Suggest-a-place form',
    group: 'Commerce',
    launch: { kind: 'route', route: ROUTES.MAIN.SUGGEST_SITE },
    howToTest:
      'Form opens and stays (this used to crash the app via the Home map freeze); submit with a test name; X closes.',
  },
  {
    id: 'history',
    title: 'Visit history',
    group: 'Commerce',
    launch: { kind: 'route', route: ROUTES.MAIN.HISTORY },
    howToTest: 'Past visits list loads; empty state is calm.',
  },
  // ── System ───────────────────────────────────────────────────────────────
  {
    id: 'notifications',
    title: 'Notifications (bell + push)',
    group: 'System',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.TABS,
      params: { screen: ROUTES.TABS.HOME },
    },
    requires: 'push-config',
    howToTest:
      'Tap the bell on Home → list loads, mark-read works. For push: send a broadcast from the website admin → logo silhouette shows in the status bar.',
  },
  {
    id: 'share-deep-link',
    title: 'Share deep-link round-trip',
    group: 'System',
    launch: {
      kind: 'action',
      label: 'Open epocheye://site/…',
      run: () =>
        Linking.openURL(`epocheye://site/${DEFAULT_MONUMENT_SLUG}`).catch(
          () => Alert.alert('Deep link failed to open'),
        ),
    },
    howToTest:
      'The scheme URL must land on SiteDetail for the sample site. Also test the share sheet from SiteDetail.',
  },
  {
    id: 'offline-screen',
    title: 'Offline screen',
    group: 'System',
    launch: { kind: 'manual' },
    requires: 'airplane-mode',
    howToTest:
      'Enable airplane mode → the NoInternet screen replaces the app; disable → app recovers where it was.',
  },
  {
    id: 'crash-journal',
    title: 'Crash journal self-test',
    group: 'System',
    launch: {
      kind: 'action',
      label: 'Throw test error',
      run: () => {
        setTimeout(() => {
          throw new Error('[dev-health] crash journal self-test');
        }, 0);
      },
    },
    howToTest:
      'Throws an uncaught JS error: dev shows RedBox; the crash log section below must gain a js-… entry with this screen’s route.',
  },
];
