# Epocheye Project Guidelines

## Code Style

- Write production-ready TypeScript and React Native code.
- Follow the standing engineering rules in [CLAUDE.md](../CLAUDE.md) for correctness, error handling, and safe changes.
- Follow repository TypeScript instruction defaults in [.github/instructions/Instructions.instructions.md](./instructions/Instructions.instructions.md).
- Match existing patterns before introducing new ones; avoid broad refactors during bug fixes unless explicitly requested.

## Architecture

- App flow is state-driven: loading -> onboarding or login or main app.
- Keep module boundaries clear:
  - `src/screens` and `src/components` for UI composition.
  - `src/navigation` for route and flow orchestration.
  - `src/context` for app-wide state providers.
  - `src/shared` for reusable API clients, hooks, services, and utils.
  - `src/core` for config, constants, and shared types.
  - `src/utils/api` for domain API calls.
- Preserve existing API/result contracts and navigation typing patterns.

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
- Keep comments brief and intent-focused.

## Known Pitfalls

- Jest currently fails on CSS import from `App.tsx` -> `global.css` unless CSS is mocked/transformed in tests.
- Android build expects the pinned NDK version in [android/build.gradle](../android/build.gradle).

## References

- Setup and local run guidance: [README.md](../README.md)
- Engineering guardrails and code quality policy: [CLAUDE.md](../CLAUDE.md)
- Specialized UI-only subagent defaults: [.github/agents/frontend.agent.md](./agents/frontend.agent.md)
