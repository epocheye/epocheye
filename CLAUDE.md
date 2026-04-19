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

13-screen Duolingo-style flow, no headers:

```
OB00_Splash → OB01_Welcome → OB02_Motivation → OB03_Frequency → OB04_Goal
→ OB05_Region → OB06_Name → OB07_Promise → OB08_DemoStory → OB09_Reaction
→ OB10_SignUp (or OB10_Login branch) → OB11_Notifications → OB12_Arrival
```

- OB08 uses `animation: 'fade'`; OB12 has `gestureEnabled: false`
- OB07 fires the SSE ancestor-story stream; OB08 displays it with a typewriter effect
- OB10 has two variants: `SignupScreen` (default, `fromOnboarding: true`) and `OB10_Login`
- `OB12_Arrival` calls `completeOnboarding()` on the Zustand store and `onOnboardingComplete()` from `OnboardingCallbackContext` to transition to `main`

**Onboarding store** tracks: `firstName`, `motivation`, `visitFrequency`, `goal`, `regions`, `demoStory`, `demoMonument`, `reactionEmoji`, `onboardingComplete`, `guestMode`. `completeOnboarding()` also writes `STORAGE_KEYS.ONBOARDING.COMPLETED = 'true'` to AsyncStorage.

### Main Navigation (`src/navigation/MainNavigation.tsx`)

A native stack containing `TabNavigation` (5 tabs) plus full-screen-modal and push screens:

| Screen               | Route key                   | Presentation          |
| -------------------- | --------------------------- | --------------------- |
| `TabNavigation`      | `ROUTES.MAIN.TABS`          | default               |
| `LensScreen`         | `ROUTES.MAIN.LENS`          | fullScreenModal, fade |
| `SiteDetailScreen`   | `ROUTES.MAIN.SITE_DETAIL`   | slide_from_right      |
| `ARExperienceScreen` | `ROUTES.MAIN.AR_EXPERIENCE` | fullScreenModal, fade |
| `PermissionsScreen`  | `ROUTES.MAIN.PERMISSIONS`   | fullScreenModal       |

**Tabs** (Home, Explore, Challenges, Saved, Settings). **Explore is live.** Only Challenges is disabled with a "Coming Soon" overlay (`ComingSoonTabButton`) — its `tabPress` event is prevented and navigation is blocked.

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

**Font rule:** `MontserratAlternates-*` exclusively. No other font families.

**Image rule:** All monument/region images via CDN using `CDN_BASE`. No local `require()` for monument images.

**Styling approach:** NativeWind (`className` props, configured via `global.css` + `tailwind.config.js`) is the primary styling method. For dynamic or complex styles, use `StyleSheet` with theme token values.

---

## Lens Screen (`src/screens/Lens/LensScreen.tsx`)

The Lens screen is a live camera view that:

1. On open, runs GPS monument detection — queries the places API at cascading radii (500 → 1000 → 2000 m) with an 8-second timeout
2. On match, shows `BottomCard` with two actions: **Story** and **Scan Object**
3. **Story mode**: takes a photo with `react-native-vision-camera`, sends it + monument name to `POST /api/lens/identify` (SSE stream), renders streamed text in `AncestorStorySheet`
4. **Object scan mode**: same photo capture path but sends `mode: 'object_scan'` and `motivation`; the `done` event includes an `object` payload (`LensIdentifiedObject`)
5. Both modes fall back to `getFallbackStory()` on any error

Service: `src/services/lensStoryService.ts` (`streamLensStory`). User context (firstName, regions, motivation) is read from `useOnboardingStore` with a fallback to `useUser().profile`.

**Lens components** (`src/screens/Lens/components/`):

- `BottomCard`, `IdentificationCard`, `MonumentInfoSheet` — surface identification results and actions
- `AncestorStorySheet` — renders the streaming story with typewriter effect
- `HDScanOverlay`, `SegmentationOverlay`, `PulsingRing` — scan-state UI over the camera feed
- `GLBViewer` — renders reconstructed 3D models (AR pipeline output)
- `EpochChips`, `SearchSheet` — era filtering and manual monument search

---

## Vision & AR Pipeline Services (`src/services/`)

Beyond SSE, a set of services back the Lens/AR experience:

- `geminiVisionService.ts` / `geminiImageService.ts` / `geminiCacheService.ts` — Gemini-backed vision calls for identification and image generation, with a local response cache
- `hdScanService.ts` — orchestrates the HD scan flow shown by `HDScanOverlay`
- `segmentationService.ts` — subject segmentation used by `SegmentationOverlay`
- `arReconstructionService.ts` — 3D reconstruction driving `GLBViewer`
- `geofenceService.ts` / `zoneService.ts` — geofencing and heritage-zone detection
- `usageTracker.ts` / `usageTelemetryService.ts` — client-side usage counters and telemetry emission
- `fcmService.ts` — Firebase Cloud Messaging (push notifications)

When adding a new service, prefer this directory for anything stateful or stream-oriented; keep pure request/response helpers in `src/utils/api/`.

---

## Firebase

Android Firebase is wired up via `android/app/google-services.json` (committed) and the `com.google.gms.google-services` Gradle plugin. FCM push is handled by `src/services/fcmService.ts`. iOS Firebase config is not yet set up — add a `GoogleService-Info.plist` and the iOS pod wiring before enabling push on iOS.

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

`useResolvedSubjectImage(subject, context?)` (`src/shared/hooks/useResolvedSubjectImage.ts`) is the shared entry point for all contextual monument imagery across Home, SiteDetailScreen, ARExperienceScreen, OB08_DemoStory, and ResolvedSubjectImage components.

**Resolution flow:**

1. Check in-memory session cache in `src/shared/services/image-resolve.service.ts`
2. On miss, call `GET /api/v1/images/resolve?subject=&context=` via `src/utils/api/images/Images.ts` (authenticated)
3. Backend responds either:
   - `200` with a resolved URL — done immediately
   - `202 Accepted` with `{ job_id }` — backend is resolving asynchronously
4. On `202`, the service polls `GET /api/v1/images/resolve/status?job_id=` until `completed`, `failed`, or a client-side timeout
5. Resolved URL is stored in the in-memory session cache and returned

**Important:** `ARExperienceScreen` uses this hook for its backdrop imagery — it does **not** call `/api/lens/identify` or any live AI scan. The scan UI on that screen simulates progress locally.

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
- **Disabled tabs**: Only the Challenges tab is blocked with `ComingSoonTabButton` — don't remove that guard. Explore is live.
- **SSE cleanup**: Lens and onboarding story streams use XHR-based SSE. Always call the abort function on component unmount.
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
