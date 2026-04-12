# Epocheye Workspace Instructions

## Code Style

- Write production-ready TypeScript and React Native code.
- Follow [CLAUDE.md](../CLAUDE.md) for correctness, defensive error handling, and safe changes.
- Follow repository TypeScript defaults in [.github/instructions/Instructions.instructions.md](./instructions/Instructions.instructions.md).
- Match existing patterns before introducing new ones; avoid broad refactors during bug fixes unless requested.
- Prefer typed patterns over ad-hoc shapes: API result unions, route constants, and typed navigation props.

## Architecture

- App entry flow is in [App.tsx](../App.tsx): SafeAreaProvider -> NetworkProvider -> AppContent -> AppNavigator.
- Root state resolution is in [src/navigation/index.tsx](../src/navigation/index.tsx): loading -> onboarding or login or main.
- Onboarding is currently disabled in code (`hasCompletedOnboarding = true`); onboarding screens remain on disk.
- Runtime app state lives in Zustand stores under [src/stores](../src/stores/); context user/places providers are compatibility no-op wrappers in [src/context/index.ts](../src/context/index.ts).
- Keep boundaries clear:
  - `src/screens` and `src/components` for UI composition.
  - `src/navigation` for route and flow orchestration.
  - `src/stores` for app state.
  - `src/shared` for reusable API clients, hooks, services, and utilities.
  - `src/core` for config, constants, and shared types.
  - `src/utils/api` for domain API calls.

## Navigation and State

- Use route constants from [src/core/constants/routes.ts](../src/core/constants/routes.ts); avoid raw route strings.
- Use typed navigation props from [src/core/types/navigation.types.ts](../src/core/types/navigation.types.ts); avoid `any`.
- Keep auth transitions callback-based (`onLoginSuccess`, onboarding completion, logout) instead of polling.
- Keep session, user, and places state transitions aligned with [src/navigation/index.tsx](../src/navigation/index.tsx) patterns.
- Keep onboarding choices in [src/stores/onboardingStore.ts](../src/stores/onboardingStore.ts) and preserve persistence behavior.

## Build and Test

- Requirements: Node.js 20 or newer.
- Install deps: `npm install`
- Start Metro: `npm start`
- Run Android: `npm run android`
- Run iOS: `npm run ios`
- Lint: `npm run lint`
- Test: `npm test`
- iOS first-time/native setup: `bundle install` then `bundle exec pod install`

## Conventions

- Reuse shared constants (routes, storage keys, theme tokens) instead of hardcoding values.
- Use design tokens from [src/core/constants/theme.ts](../src/core/constants/theme.ts) as source of truth.
- Keep font usage aligned with MontserratAlternates conventions.
- Use NativeWind `className` styling by default; use `StyleSheet` when styles are dynamic or complex.
- Keep async/network and permission flows defensive: handle denial, offline state, and API failures explicitly.

## Known Pitfalls

- Jest needs CSS mocking/transform support for `App.tsx` -> `global.css` imports.
- Android build expects pinned NDK in [android/build.gradle](../android/build.gradle).
- Explore and Challenges tabs are intentionally blocked with Coming Soon behavior.
- Lens and onboarding story streams use SSE; always clean up streams on unmount.
- If dependency install fails on `@gorhom/bottom-sheet` peer constraints, use `npm install --legacy-peer-deps`.

## Start Here

- Root app flow: [App.tsx](../App.tsx)
- Root navigator state machine: [src/navigation/index.tsx](../src/navigation/index.tsx)
- Main stack and tabs: [src/navigation/MainNavigation.tsx](../src/navigation/MainNavigation.tsx), [src/navigation/TabNavigation.tsx](../src/navigation/TabNavigation.tsx)
- State stores: [src/stores](../src/stores/)
- Lens flow and AI streaming usage: [src/screens/Lens/LensScreen.tsx](../src/screens/Lens/LensScreen.tsx), [src/services/sseStreamService.ts](../src/services/sseStreamService.ts)
- API conventions and auth handling: [src/utils/api](../src/utils/api/)

## References

- Setup and local run guidance: [README.md](../README.md)
- Engineering and architecture baseline: [CLAUDE.md](../CLAUDE.md)
- Lens and AI architecture flow: [docs/architecture/ar-ai-pipeline.md](../docs/architecture/ar-ai-pipeline.md)
- UI-only subagent defaults: [.github/agents/frontend.agent.md](./agents/frontend.agent.md)
