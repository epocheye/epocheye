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

| State | Condition | Renders |
|---|---|---|
| `onboarding` | `onboarding_complete` not set | `OnboardingNavigator` (wrapped in `OnboardingCallbackProvider`) |
| `login` | Onboarding done but tokens expired | `LoginScreen` (outside `NavigationContainer`) |
| `main` | Authenticated | `MainNavigation` inside `NavigationContainer` |

Auth/onboarding transitions are driven by callbacks (`onLoginSuccess`, `handleOnboardingComplete`, `handleLogout`), not by polling. `PlacesContext.setAuthenticated()` must be called to start/stop geo-tracking.

### Onboarding Flow (`src/navigation/OnboardingNavigator.tsx`)

Six screens, all fade-transition, no headers:

```
SplashVideo → Hook → AncestryInput → FirstTaste → Signup → Welcome
```

`WelcomeScreen` calls `onOnboardingComplete` from `OnboardingCallbackContext` to transition to `main`. The deprecated screen files (`EmotionalQuestionScreen`, `MirrorMomentScreen`, `PermissionsScreen`, `WorldOpensScreen`) still exist but are not registered in the navigator.

### Main Navigation (`src/navigation/MainNavigation.tsx`)

A native stack containing `TabNavigation` (5 tabs: Home, Explore, Challenges, Saved, Settings) plus modal/push screens: `SiteDetail`, `ARExperience`, `NavigationScreen`, `Permissions`.

---

## Design Tokens

**Single source of truth:** `src/core/constants/theme.ts`

```ts
COLORS   // brand amber (#D4860A), dark backgrounds, text hierarchy
FONTS    // MontserratAlternates-{Light|Regular|Medium|SemiBold|Bold|ExtraBold|Italic|MediumItalic}
SPACING  // xs(4) → screen(48)
RADIUS   // sm(8) → pill(40)
FONT_SIZES  // caption(12) → display(40)
CDN_BASE // 'https://cdn.jsdelivr.net/gh/epocheye/epocheye/src/assets/'
```

An extended token set lives in `src/design-system/tokens/` (`typography.ts`, `colors.ts`, `spacing.ts`) — same values, more granular variants. Use `src/core/constants/theme.ts` imports for most screens.

**Font rule:** `MontserratAlternates-*` exclusively. No other font families.

**Image rule:** All monument/region images via CDN using `CDN_BASE`. No local `require()` for monument images.

**Styling approach:** NativeWind (`className` props, configured via `global.css` + `tailwind.config.js`) is the primary styling method. For dynamic or complex styles, use `StyleSheet` with theme token values.

---

## Context Layer (`src/context/`)

| Context | Hook | Purpose |
|---|---|---|
| `PlacesContext` | `usePlaces()` | Nearby places (cascading radius 1→5→10→20km), saved places, geo-tracking with 1-min API cooldown |
| `UserContext` | `useUser()` | User profile + stats, fetched in parallel on auth |
| `NetworkContext` | `useNetwork()` | `isConnected` / `isInternetReachable` from NetInfo |
| `OnboardingCallbackContext` | `useOnboardingCallback()` | Bridge from `WelcomeScreen` to root navigator |

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
type Props = OnboardingScreenProps<'AncestryInput'>

// Main screens
type Props = MainScreenProps<'SiteDetail'>

// Tab screens (composite prop — can also push to main stack)
type Props = TabScreenProps<'Home'>
```

---

## Code Review

After implementation, Codex by OpenAI will review the code. Write as if shipping to production.
