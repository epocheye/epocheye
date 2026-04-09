# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
# Start Metro bundler
npm start

# Run on device/emulator
npm run android
npm run ios

# Lint
npm run lint

# Run all tests
npm test

# Run a single test file
npx jest path/to/__tests__/MyComponent.test.tsx

# iOS native dependencies (first clone or after native dep changes)
bundle install
bundle exec pod install
```

---

## Architecture Overview

### Entry Point & Provider Tree

`App.tsx` is the root. It wraps the app in a fixed provider hierarchy:

```
SafeAreaProvider
  └─ NetworkProvider       (offline detection → shows NoInternetScreen)
       └─ UserProvider     (profile + stats, auto-fetches on auth)
            └─ PlacesProvider  (geo-tracking, nearby/saved places)
                 └─ AppContent → AppNavigator
```

`AppContent` shows `NoInternetScreen` when offline; otherwise renders `AppNavigator`.

### Three-State Root Navigator (`src/navigation/index.tsx`)

`AppNavigator` resolves to one of three states on startup:

| State        | Condition                          | Renders                                                         |
| ------------ | ---------------------------------- | --------------------------------------------------------------- |
| `onboarding` | `onboarding_complete` not set      | `OnboardingNavigator` (wrapped in `OnboardingCallbackProvider`) |
| `login`      | Onboarding done but tokens expired | `LoginScreen` (outside `NavigationContainer`)                   |
| `main`       | Authenticated                      | `MainNavigation` inside `NavigationContainer`                   |

Auth/onboarding transitions are driven by callbacks (`onLoginSuccess`, `handleOnboardingComplete`, `handleLogout`), not by polling. `PlacesContext.setAuthenticated()` must be called to start/stop geo-tracking.

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

**Zustand onboarding store** (`src/stores/onboardingStore.ts`): persists user choices to AsyncStorage key `'epocheye-onboarding'`. Tracks `firstName`, `motivation`, `visitFrequency`, `goal`, `regions`, `demoStory`, `demoMonument`, `reactionEmoji`, `onboardingComplete`, `guestMode`. The `completeOnboarding()` action also writes `STORAGE_KEYS.ONBOARDING.COMPLETED = 'true'` to AsyncStorage for the root navigator's `checkAppState()`.

### Main Navigation (`src/navigation/MainNavigation.tsx`)

A native stack containing `TabNavigation` (5 tabs) plus full-screen-modal and push screens:

| Screen | Route key | Presentation |
| --- | --- | --- |
| `TabNavigation` | `ROUTES.MAIN.TABS` | default |
| `LensScreen` | `ROUTES.MAIN.LENS` | fullScreenModal, fade |
| `SiteDetailScreen` | `ROUTES.MAIN.SITE_DETAIL` | slide_from_right |
| `ARExperienceScreen` | `ROUTES.MAIN.AR_EXPERIENCE` | fullScreenModal, fade |
| `PermissionsScreen` | `ROUTES.MAIN.PERMISSIONS` | fullScreenModal |

**Tabs** (Home, Explore, Challenges, Saved, Settings). Explore and Challenges are currently disabled with a "Coming Soon" overlay (`ComingSoonTabButton`) — their `tabPress` events are prevented and navigation is blocked.

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

---

## SSE Streaming Architecture

Both AI story endpoints (onboarding ancestor story and Lens) use XMLHttpRequest-based SSE (not `fetch`) via `src/services/sseStreamService.ts` (`createSSEStream`). The backend at `BACKEND_URL` (from `src/constants/onboarding.ts`) sends newline-delimited JSON events:

- `{ type: 'chunk', text: string }` → calls `onChunk`
- `{ type: 'done', monument: string, object?: LensIdentifiedObject }` → calls `onDone`
- `{ type: 'error' }` → triggers fallback via `getFallbackStory()`

`createSSEStream` returns an abort function. Always call it on component unmount.

---

## Context Layer (`src/context/`)

| Context                     | Hook                      | Purpose                                                                                          |
| --------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| `PlacesContext`             | `usePlaces()`             | Nearby places (cascading radius 1→5→10→20km), saved places, geo-tracking with 1-min API cooldown |
| `UserContext`               | `useUser()`               | User profile + stats, fetched in parallel on auth                                                |
| `NetworkContext`            | `useNetwork()`            | `isConnected` / `isInternetReachable` from NetInfo                                               |
| `OnboardingCallbackContext` | `useOnboardingCallback()` | Bridge from `WelcomeScreen` to root navigator                                                    |

---

## API Layer (`src/utils/api/`)

Each subdirectory (auth, places, user, challenges) exports typed functions. All API calls return a discriminated union result: `{ success: true, data: T }` or `{ success: false, error: { message: string } }`.

**Auth utilities** (`src/utils/api/auth/`):

- `isAuthenticated()` — checks token validity
- `getValidAccessToken()` — refreshes if expired
- `createAuthenticatedClient()` — axios instance with auto-refresh interceptor
- `storeTokens()` / `clearTokens()` — manage `@epocheye/access_token` etc.

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

## Code Review

After implementation, Codex by OpenAI will review the code. Write as if shipping to production.
