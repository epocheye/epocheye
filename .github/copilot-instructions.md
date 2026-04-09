# Epocheye Project Guidelines

## Code Style

- Write production-ready TypeScript and React Native code.
- Follow the standing engineering rules in [CLAUDE.md](../CLAUDE.md) for correctness, error handling, and safe changes.
- Follow repository TypeScript instruction defaults in [.github/instructions/Instructions.instructions.md](./instructions/Instructions.instructions.md).
- Match existing patterns before introducing new ones; avoid broad refactors during bug fixes unless explicitly requested.
- Prefer existing typed patterns over ad-hoc shapes: API result unions, route constants, and typed navigation props.

## Architecture

- Root flow is callback-driven and state-based: loading -> onboarding or login or main app.
- Provider order in [App.tsx](../App.tsx) is intentional: SafeAreaProvider -> NetworkProvider -> UserProvider -> PlacesProvider -> AppNavigator.
- Root state resolution lives in [src/navigation/index.tsx](../src/navigation/index.tsx):
  - onboarding: onboarding not completed
  - login: onboarding done but token invalid
  - main: authenticated
- Keep module boundaries clear:
  - `src/screens` and `src/components` for UI composition.
  - `src/navigation` for route and flow orchestration.
  - `src/context` for app-wide state providers.
  - `src/shared` for reusable API clients, hooks, services, and utils.
  - `src/core` for config, constants, and shared types.
  - `src/utils/api` for domain API calls.

## Navigation and State

- Use `ROUTES` constants from [src/core/constants/routes.ts](../src/core/constants/routes.ts); avoid raw route strings.
- Use typed screen props from [src/core/types/navigation.types.ts](../src/core/types/navigation.types.ts); avoid `any` in navigation code.
- Keep auth transitions callback-based (`onLoginSuccess`, onboarding completion, logout) instead of polling.
- Call `PlacesContext.setAuthenticated()` when auth state changes so geo-tracking starts and stops correctly.
- Keep onboarding choices in Zustand store [src/stores/onboardingStore.ts](../src/stores/onboardingStore.ts) and preserve existing persistence behavior.

## Build and Test

- Requirements: Node.js 20 or newer.
- Install deps: `npm install`
- Start Metro: `npm start`
- Run Android: `npm run android`
- Run iOS: `npm run ios`
- Lint: `npm run lint`
- Test: `npm test`
- iOS first-time/native-dependency setup: `bundle install` then `bundle exec pod install`

## Conventions

- Prefer typed result unions and shared error handling patterns already used in `src/shared/api`.
- Keep async/network and permission flows defensive: handle denial, offline state, and API failures explicitly.
- Reuse constants (routes, storage keys, theme tokens) instead of hardcoding values.
- Use design tokens from [src/core/constants/theme.ts](../src/core/constants/theme.ts) as the default source of truth.
- Keep font usage aligned with existing MontserratAlternates family conventions.
- Use NativeWind `className` styling by default; use `StyleSheet` when styles are dynamic or complex.
- Keep comments brief and intent-focused.

## Known Pitfalls

- Jest currently fails on CSS import from `App.tsx` -> `global.css` unless CSS is mocked/transformed in tests.
- Android build expects the pinned NDK version in [android/build.gradle](../android/build.gradle).
- Explore and Challenges tabs are currently intentionally blocked with Coming Soon behavior.
- Lens and onboarding story streams use SSE; always clean up streams on unmount.

## References

- Setup and local run guidance: [README.md](../README.md)
- Engineering guardrails and code quality policy: [CLAUDE.md](../CLAUDE.md)
- Lens and AI architecture flow: [docs/architecture/ar-ai-pipeline.md](../docs/architecture/ar-ai-pipeline.md)
- Specialized UI-only subagent defaults: [.github/agents/frontend.agent.md](./agents/frontend.agent.md)
