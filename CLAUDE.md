# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

**Requires Node.js 20+.**

```bash
# Start Metro bundler
npm start

# Run on device/emulator
npm run android
npm run ios

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Run all tests
npm test

# Run a single test file
npx jest path/to/__tests__/MyComponent.test.tsx

# iOS native dependencies (first clone or after native dep changes)
bundle install
bundle exec pod install

# If install fails on @gorhom/bottom-sheet peer constraints
npm install --legacy-peer-deps
```

---

## Source Directory Boundaries

| Directory        | Responsibility                                            |
| ---------------- | --------------------------------------------------------- |
| `src/screens`    | UI composition — screens only, no business logic          |
| `src/components` | Reusable UI components                                    |
| `src/navigation` | Route definitions and flow orchestration                  |
| `src/stores`     | Zustand app state                                         |
| `src/shared`     | Reusable hooks, API clients, services, and utilities      |
| `src/core`       | Config, constants, and shared types                       |
| `src/utils/api`  | Domain-specific API call functions                        |
| `src/services`   | SSE streaming and other stateful services                 |
| `src/context`    | Compatibility no-op wrappers (don't add new context here) |

### Onboarding teaser pack boundary

`src/constants/onboarding/**`, `src/components/onboarding/**`, and `src/screens/Onboarding/**` form a **curated, region-keyed teaser pack** used **only** by the pre-auth onboarding flow. Region-keyed monument names, hero images, and ancestor-story text live here as static content because they must render before the user has a JWT and the DB is reachable.

**Hard rule:** post-auth code must NEVER import from `src/constants/onboarding/**` or `src/components/onboarding/**`. The following directories are post-auth and must obtain monument data from `useActiveMonument()` (`src/shared/hooks/useActiveMonument.ts`) instead:

- `src/screens/Main/**`, `src/screens/Lens/**`, `src/screens/History/**`, `src/screens/Plan/**`, `src/screens/Admin/**`
- `src/services/**`, `src/stores/**`, `src/shared/**`

The single permitted monument-slug literal in the entire post-auth codebase lives in `src/config/monuments.ts` as `DEFAULT_MONUMENT_SLUG` (last-resort fallback) and `NEAREST_SITE_FALLBACK_KM`. Adding a real monument to the live app is a pure DB operation (one `monuments` row + one `heritage_zones` row); no code change required.

---

## Architecture Overview

### Entry Point & Provider Tree

`App.tsx` is the root. Provider hierarchy:

```
SafeAreaProvider
  └─ NetworkProvider       (offline detection → shows NoInternetScreen)
       └─ AppContent → AppNavigator
```

`UserProvider` and `PlacesProvider` exported from `src/context/index.ts` are **no-op wrappers** kept for import compatibility — all real state lives in Zustand stores.

### Three-State Root Navigator (`src/navigation/index.tsx`)

`AppNavigator` resolves to one of three states on startup:

| State        | Condition                          | Renders                                                         |
| ------------ | ---------------------------------- | --------------------------------------------------------------- |
| `onboarding` | `onboarding_complete` not set      | `OnboardingNavigator` (wrapped in `OnboardingCallbackProvider`) |
| `login`      | Onboarding done but tokens expired | `LoginScreen` (outside `NavigationContainer`)                   |
| `main`       | Authenticated                      | `MainNavigation` inside `NavigationContainer`                   |

> **Note:** Onboarding was previously disabled (hardcoded `true`). It is now re-enabled — the actual AsyncStorage check (`completedFlag === 'true'`) controls routing. To test onboarding, clear AsyncStorage key `@epocheye/onboarding_complete`.

Auth transitions are driven by callbacks (`onLoginSuccess`, `handleOnboardingComplete`, `handleLogout`). On login/onboarding-complete, call `useSessionStore.setAuthenticated(true)` and `useUserStore.getState().ensureUserDataLoaded()`.

### Zustand State Layer (`src/stores/`)

All runtime state lives in four Zustand stores (no React context providers needed):

| Store                | Hook                 | Purpose                                                               |
| -------------------- | -------------------- | --------------------------------------------------------------------- |
| `sessionStore.ts`    | `useSessionStore`    | `authenticated`, `bootstrapped`; `bootstrapSession()` on startup      |
| `userStore.ts`       | `useUserStore`       | Profile + stats; `ensureUserDataLoaded()`, `refreshUserData()`        |
| `placesStore.ts`     | `usePlacesStore`     | Geo-tracking, nearby/saved places; `ensureLocationTracking()`         |
| `onboardingStore.ts` | `useOnboardingStore` | Persisted onboarding choices (AsyncStorage key `epocheye-onboarding`) |

The `useUser()` and `usePlaces()` hooks in `src/context/index.ts` delegate directly to `useUserStore` / `usePlacesStore` — use these hooks in screens for backward compatibility.

### Onboarding Flow (`src/navigation/OnboardingNavigator.tsx`)

Flow, no headers (OB02_Name removed — the first-name prompt is no longer collected):

```
OB00_Splash → OB01_Welcome → OB03_Region → OB04_Pull
→ OB10_SignUp (or OB10_Login branch) → OB11_Notifications (final)
```

- OB10 has two variants: `SignupScreen` (default, `fromOnboarding: true`) and `OB10_Login`
- `OB11_Notifications` is the final screen — it calls `completeOnboarding()` on the Zustand store and `onOnboardingComplete()` from `OnboardingCallbackContext` to transition to `main`

**Onboarding store** tracks: `firstName`, `region`, `pulls`, `onboardingComplete`. `completeOnboarding()` also writes `STORAGE_KEYS.ONBOARDING.COMPLETED = 'true'` to AsyncStorage.

### Main Navigation (`src/navigation/MainNavigation.tsx`)

A native stack containing `TabNavigation` (4 tabs) plus full-screen-modal and push screens:

| Screen                | Route key                    | Presentation             |
| --------------------- | ---------------------------- | ------------------------ |
| `TabNavigation`       | `ROUTES.MAIN.TABS`           | default                  |
| `SiteDetailScreen`    | `ROUTES.MAIN.SITE_DETAIL`    | slide_from_right         |
| `DetectArScreen`      | `ROUTES.MAIN.DETECT_AR`      | fullScreenModal, fade    |
| `ARComposer`          | `ROUTES.MAIN.AR_COMPOSER`    | fullScreenModal, fade    |
| `Ar3dViewerScreen`    | `ROUTES.MAIN.AR_3D_VIEWER`   | fullScreenModal, fade    |
| `AiGuideScreen`       | `ROUTES.MAIN.AI_GUIDE`       | modal, slide_from_bottom |
| `PurchaseScreen`      | `ROUTES.MAIN.PURCHASE`       | modal, slide_from_bottom |
| `HistoryScreen`       | `ROUTES.MAIN.HISTORY`        | slide_from_right         |
| `GoToVenueScreen`     | `ROUTES.MAIN.GO_TO_VENUE`    | fullScreenModal          |
| `SuggestSiteScreen`   | `ROUTES.MAIN.SUGGEST_SITE`   | fullScreenModal          |
| `AnchorCaptureScreen` | `ROUTES.MAIN.ANCHOR_CAPTURE` | modal (admin only)       |

**Tabs** (Home, Passport, Daily, Account). The AR/3D/guide screens above are each wrapped in `ErrorBoundary` so a render crash recovers to the previous screen instead of closing the app. There is **no** `LensScreen`/`PermissionsScreen` route — those were removed.

---

## Design Tokens

**Single source of truth:** `src/core/constants/theme.ts`

```ts
COLORS; // brand amber (#D4860A), dark backgrounds, text hierarchy
FONTS; // MontserratAlternates-{Light|Regular|Medium|SemiBold|Bold|ExtraBold|Italic|MediumItalic}
SPACING; // xs(4) → screen(48)
RADIUS; // sm(8) → pill(40)
FONT_SIZES; // caption(12) → display(40)
CDN_BASE; // 'https://cdn.jsdelivr.net/gh/epocheye/epocheye/src/assets/'
```

An extended token set lives in `src/design-system/tokens/` (`typography.ts`, `colors.ts`, `spacing.ts`) — same values, more granular variants. Use `src/core/constants/theme.ts` imports for most screens.

**Font rule:** Several bundled families are in active use — do not delete any without checking references first. `MontserratAlternates-*` drives the brand mark (`AnimatedLogo` via `FONTS` in `theme.ts`). `InstrumentSans-*`, `InstrumentSerif-*`, and `NothingYouCouldDo-*` are used across post-auth screens (SiteDetail, Settings, Purchase, PlanList, AiGuide) via `theme.ts`. `CormorantGaramond-*` (display) and `DMSans-*` (UI) drive the onboarding v2 design system via `src/core/constants/fonts.ts`. All of these ship in `src/assets/fonts/` and are linked natively through `react-native.config.js`.

**Image rule:** All monument/region images via CDN using `CDN_BASE`. No local `require()` for monument images.

**Styling approach:** NativeWind (`className` props, configured via `global.css` + `tailwind.config.js`) is the primary styling method. For dynamic or complex styles, use `StyleSheet` with theme token values.

---

## Scan / AR screens

There is **no** `src/screens/Lens/LensScreen.tsx` and no `LENS` route. The live
"point the camera at an object" experience is a single screen:

- `src/screens/Main/DetectArScreen.tsx` (`ROUTES.MAIN.DETECT_AR`) — the production
  object-scan/recognition surface. Runs the venue gate, captures a frame with
  `react-native-vision-camera`, calls `POST /api/v1/recognize` (async poll → `/recognize/result`),
  and renders the resolved card (native world-anchored AR card on ARCore devices; on-screen card
  otherwise). It has two internal render paths — `DetectARNative` (ARCore) and `DetectAR2D`
  (vision-camera fallback) — and layers a `ScanGuideOverlay` viewfinder cue over the feed.

It routes every back/exit affordance — **including the Android hardware back button** — through
`useSafeBackHandler()` (`src/shared/hooks/useSafeGoBack.ts`), which pops when it can and otherwise
lands on the tabs, so exiting the camera can never fall through to closing the app.

`src/screens/Lens/` holds shared AR/scan building blocks (e.g. `ARComposer`, `GLBViewer`,
identification/overlay components) — not a screen named `LensScreen`.

---

## Vision & AR Pipeline Services (`src/services/`)

Beyond SSE, a set of services back the Lens/AR experience:

- `geminiVisionService.ts` / `geminiImageService.ts` / `geminiCacheService.ts` — Gemini-backed vision calls for identification and image generation, with a local response cache
- `geofenceService.ts` / `zoneService.ts` — geofencing and heritage-zone detection
- `usageTracker.ts` / `usageTelemetryService.ts` — client-side usage counters and telemetry emission
- `fcmService.ts` — Firebase Cloud Messaging (push notifications)

When adding a new service, prefer this directory for anything stateful or stream-oriented; keep pure request/response helpers in `src/utils/api/`.

---

## Firebase

**Android.** Wired via `android/app/google-services.json` (committed) and the `com.google.gms.google-services` Gradle plugin. FCM push handled by `src/services/fcmService.ts`.

**iOS.** Wired via `ios/epocheye/GoogleService-Info.plist` (a placeholder ships in-repo — replace it with the real file downloaded from Firebase Console before first build), `FirebaseApp.configure()` in `ios/epocheye/AppDelegate.swift`, `$RNFirebaseAsStaticFramework = true` in the Podfile, and `FirebaseAppDelegateProxyEnabled = <false/>` in `Info.plist`. APNs is forwarded to FCM manually in AppDelegate (`didRegisterForRemoteNotificationsWithDeviceToken` → `Messaging.messaging().apnsToken`) and `UNUserNotificationCenter` / `MessagingDelegate` are set on launch. The Push Notifications capability is declared in `ios/epocheye/epocheye.entitlements` (`aps-environment = development` — flip to `production` for TestFlight/App Store). Before the first iOS push build, upload an APNs auth key in Firebase Console → Cloud Messaging.

---

## SSE Streaming Architecture

Both AI story endpoints (onboarding ancestor story and Lens) use XMLHttpRequest-based SSE (not `fetch`) via `src/services/sseStreamService.ts` (`createSSEStream`). The backend at `BACKEND_URL` (from `src/constants/onboarding.ts`) sends newline-delimited JSON events:

- `{ type: 'chunk', text: string }` → calls `onChunk`
- `{ type: 'done', monument: string, object?: LensIdentifiedObject }` → calls `onDone`
- `{ type: 'error' }` → triggers fallback via `getFallbackStory()`

`createSSEStream` returns an abort function. Always call it on component unmount.

---

## Payment / Purchase Flow

Tours and Premium subscriptions both use **Razorpay** (`react-native-razorpay`). The `RAZORPAY_KEY_ID` env var is read from `@env` (react-native-dotenv).

**Shared hooks** (`src/shared/hooks/`):

- `useTourPurchase()` — `handleBuyTour(tourId, pricePaise, title, couponCode?)` → initiates order, opens Razorpay checkout, confirms with backend, records coupon attribution fire-and-forget via `POST /api/v1/orders/record`
- `usePremiumPurchase()` — same flow for `POST /api/v1/premium/initiate` + `/confirm`
- `usePremiumPass()` — reads current pass from `GET /api/v1/premium/my-pass`

**API modules:**

- `src/utils/api/tours/` — `getTours`, `getTour`, `getMyTours`, `initiatePurchase`, `confirmPurchase`, `validateCoupon`, `calculateDiscount`
- `src/utils/api/premium/` — `getPremiumConfig`, `getMyPremiumPass`, `initiatePremiumPurchase`, `confirmPremiumPurchase`

For free tours, `initiatePurchase` returns `{ access_granted: true, expires_at }` directly — skip the Razorpay step.

---

## API Layer (`src/utils/api/`)

Each subdirectory exports typed functions. All API calls return a discriminated union: `{ success: true, data: T }` or `{ success: false, error: { message: string } }`.

**Auth utilities** (`src/utils/api/auth/`):

- `isAuthenticated()` — checks token validity
- `getValidAccessToken()` — refreshes if expired
- `createAuthenticatedClient()` — axios instance with auto-refresh interceptor
- `storeTokens()` / `clearTokens()` — manage `@epocheye/access_token` etc.

---

## Image Resolution Pipeline

`useResolvedSubjectImage(subject, context?)` (`src/shared/hooks/useResolvedSubjectImage.ts`) is the shared entry point for all contextual monument imagery across Home, SiteDetailScreen, OB08_DemoStory, and ResolvedSubjectImage components.

**Resolution flow:**

1. Check in-memory session cache in `src/shared/services/image-resolve.service.ts`
2. On miss, call `GET /api/v1/images/resolve?subject=&context=` via `src/utils/api/images/Images.ts` (authenticated)
3. Backend responds either:
   - `200` with a resolved URL — done immediately
   - `202 Accepted` with `{ job_id }` — backend is resolving asynchronously
4. On `202`, the service polls `GET /api/v1/images/resolve/status?job_id=` until `completed`, `failed`, or a client-side timeout
5. Resolved URL is stored in the in-memory session cache and returned

---

## Shared Services (`src/shared/services/`)

- `StorageService` — typed AsyncStorage wrapper (`get<T>`, `set<T>`, `getString`, `multiSet`, etc.)
- `PermissionService` — device permissions abstraction

---

## Constants (`src/core/constants/`)

- `ROUTES` — all screen name strings (use these, never raw strings)
- `STORAGE_KEYS` — all AsyncStorage keys, prefixed `@epocheye/`
- `theme.ts` — design tokens (above)

---

## Navigation Types (`src/core/types/navigation.types.ts`)

Use the typed screen props rather than `any`:

```ts
// Onboarding screens
type Props = OnboardingScreenProps<'OB05_Region'>;

// Main screens (including Lens)
type Props = MainScreenProps<'SiteDetail'>;
type Props = MainScreenProps<'Lens'>;

// Tab screens (composite prop — can also push to main stack)
type Props = TabScreenProps<'Home'>;
```

---

## Known Pitfalls

- **Jest + CSS**: `App.tsx` imports `global.css` — Jest needs CSS mocking/transform support or tests on `App.tsx` will fail.
- **Android NDK**: Build expects a pinned NDK version in `android/build.gradle`. Missing NDK causes native build failures.
- **SSE cleanup**: onboarding/guide story streams use XHR-based SSE. Always call the abort function on component unmount.
- **Peer deps**: If `npm install` fails on `@gorhom/bottom-sheet` constraints, use `--legacy-peer-deps`.

---

## Brand Voice & Design Language

- Heritage-dark aesthetic: deep black (`#0A0A0A`) backgrounds, amber/gold (`#C9A84C`, `#E8A020`) accents, warm white (`#F5F0E8`) text.
- CTAs use heritage-inspired language: "Begin Your Journey", "Explore the Era", "Uncover History".
- Error messages should be calm and human, never technical jargon.
- Empty states should be evocative, not generic.
- Loading states use skeleton screens, never spinners (except in modals).
- Animations always use `react-native-reanimated` — never the built-in `Animated` API for new code.
- Use gold glow effects instead of drop shadows on dark backgrounds.

---

## Code Review

After implementation, Codex by OpenAI will review the code. Write as if shipping to production.

# REMEMBER CODEX WILL REVIEW YOUR OUTPUT AFTER YOU FINISH EVERY TIME.

# Remember to use the Ask questions tool and ask me your doubts before proceeding to edit. THIS IS MUST
