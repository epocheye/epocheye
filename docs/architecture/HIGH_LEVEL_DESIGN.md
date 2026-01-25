# EpochEye - High-Level Design (HLD) Document

## Version History

| Version | Date             | Author            | Description |
| ------- | ---------------- | ----------------- | ----------- |
| 1.0     | January 26, 2026 | Architecture Team | Initial HLD |

---

## 1. System Overview

### 1.1 Executive Summary

EpochEye is a React Native mobile application that provides users with an immersive heritage site discovery experience. The app enables users to explore historical monuments, save favorite places, view AR experiences, and navigate to sites of interest using location-based services.

### 1.2 Business Goals

- Enable users to discover nearby heritage sites and historical monuments
- Provide augmented reality (AR) experiences for historical sites
- Allow users to save and manage favorite places
- Deliver personalized recommendations based on user preferences
- Support both iOS and Android platforms with a unified codebase

### 1.3 Technical Goals

- Maintainable, scalable React Native architecture
- Type-safe development with TypeScript
- Efficient state management with React Context
- Secure authentication with JWT token management
- Offline-capable with smart caching strategies
- Performance-optimized with lazy loading and memoization

---

## 2. System Architecture

### 2.1 Architecture Pattern

The application follows a **Layered Architecture** pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Screens   │  │ Components  │  │    Navigation           │  │
│  │  (Pages)    │  │   (UI)      │  │  (React Navigation)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Hooks     │  │  Context    │  │    State Management     │  │
│  │ (Business)  │  │ (Providers) │  │    (React Context)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    API      │  │   Storage   │  │     Permissions         │  │
│  │  Services   │  │  Services   │  │     Services            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Axios     │  │AsyncStorage │  │  Native Modules         │  │
│  │  (HTTP)     │  │ (Persist)   │  │  (Camera, Location)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Hierarchy

```
App
├── SafeAreaProvider
│   └── NetworkProvider (Network state)
│       └── UserProvider (User state)
│           └── PlacesProvider (Places state)
│               └── NavigationContainer
│                   ├── AuthNavigation (Unauthenticated)
│                   │   ├── Landing
│                   │   ├── Login
│                   │   ├── Signup
│                   │   ├── OnboardingFlow
│                   │   └── Permissions
│                   │
│                   └── MainNavigation (Authenticated)
│                       ├── TabNavigation
│                       │   ├── Home
│                       │   ├── Explore
│                       │   ├── Challenges
│                       │   ├── Saved
│                       │   └── Settings
│                       │
│                       ├── SiteDetail
│                       ├── ARExperience
│                       └── Permissions
```

---

## 3. Proposed Module Structure

### 3.1 Recommended Directory Architecture

```
src/
├── app/                        # App initialization and configuration
│   ├── App.tsx                 # Root component
│   └── providers/              # Provider composition
│       └── AppProviders.tsx
│
├── core/                       # Core utilities and configuration
│   ├── config/                 # App configuration
│   │   ├── api.config.ts       # API base URLs, timeouts
│   │   ├── app.config.ts       # App-wide constants
│   │   └── index.ts
│   ├── constants/              # Static constants
│   │   ├── routes.ts           # Route names
│   │   ├── storage-keys.ts     # AsyncStorage keys
│   │   └── index.ts
│   └── types/                  # Shared TypeScript types
│       ├── navigation.types.ts
│       ├── common.types.ts
│       └── index.ts
│
├── design-system/              # Design tokens and UI primitives
│   ├── tokens/                 # Design tokens
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── index.ts
│   ├── components/             # Primitive UI components
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Card/
│   │   ├── Avatar/
│   │   └── index.ts
│   └── layouts/                # Layout components
│       ├── Screen/
│       ├── Container/
│       └── index.ts
│
├── features/                   # Feature modules (domain-driven)
│   ├── auth/                   # Authentication feature
│   │   ├── api/                # Auth API calls
│   │   ├── components/         # Auth-specific components
│   │   ├── hooks/              # Auth hooks
│   │   ├── screens/            # Auth screens
│   │   ├── types/              # Auth types
│   │   └── index.ts
│   │
│   ├── places/                 # Places feature
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── screens/
│   │   ├── types/
│   │   └── index.ts
│   │
│   ├── user/                   # User profile feature
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── screens/
│   │   ├── types/
│   │   └── index.ts
│   │
│   ├── onboarding/             # Onboarding feature
│   │   ├── components/
│   │   ├── screens/
│   │   └── index.ts
│   │
│   └── ar-experience/          # AR feature
│       ├── components/
│       ├── screens/
│       └── index.ts
│
├── navigation/                 # Navigation configuration
│   ├── navigators/
│   │   ├── AuthNavigator.tsx
│   │   ├── MainNavigator.tsx
│   │   ├── TabNavigator.tsx
│   │   └── RootNavigator.tsx
│   ├── types.ts
│   └── index.ts
│
├── shared/                     # Shared utilities
│   ├── api/                    # API infrastructure
│   │   ├── client.ts           # Axios instance factory
│   │   ├── interceptors.ts     # Request/response interceptors
│   │   ├── error-handler.ts    # API error handling
│   │   └── index.ts
│   │
│   ├── hooks/                  # Shared hooks
│   │   ├── useDebounce.ts
│   │   ├── useAsync.ts
│   │   ├── useGeolocation.ts
│   │   └── index.ts
│   │
│   ├── services/               # Shared services
│   │   ├── storage.service.ts  # AsyncStorage wrapper
│   │   ├── network.service.ts  # Network detection
│   │   ├── permission.service.ts
│   │   └── index.ts
│   │
│   └── utils/                  # Pure utility functions
│       ├── formatters.ts
│       ├── validators.ts
│       ├── geo.utils.ts
│       └── index.ts
│
├── context/                    # Global context providers
│   ├── NetworkContext.tsx
│   ├── ThemeContext.tsx
│   └── index.ts
│
└── assets/                     # Static assets
    ├── fonts/
    ├── images/
    └── content/
```

---

## 4. Module Breakdown

### 4.1 Core Module

**Purpose:** Centralized configuration, constants, and shared types.

| Sub-Module | Responsibility                           |
| ---------- | ---------------------------------------- |
| config     | API URLs, timeouts, feature flags        |
| constants  | Route names, storage keys, static values |
| types      | Shared TypeScript interfaces and types   |

### 4.2 Design System Module

**Purpose:** Reusable UI primitives and design tokens.

| Sub-Module | Responsibility                       |
| ---------- | ------------------------------------ |
| tokens     | Colors, typography, spacing, shadows |
| components | Button, Input, Card, Avatar, etc.    |
| layouts    | Screen, Container, SafeArea wrappers |

### 4.3 Features Module

**Purpose:** Domain-specific feature modules with co-located code.

| Feature       | Description                                |
| ------------- | ------------------------------------------ |
| auth          | Login, signup, token management, logout    |
| places        | Nearby places, saved places, place details |
| user          | User profile, stats, preferences           |
| onboarding    | First-time user flow, questionnaire        |
| ar-experience | Augmented reality monument experiences     |

### 4.4 Shared Module

**Purpose:** Cross-cutting concerns and utilities.

| Sub-Module | Responsibility                            |
| ---------- | ----------------------------------------- |
| api        | HTTP client, interceptors, error handling |
| hooks      | Reusable React hooks                      |
| services   | Storage, network, permissions             |
| utils      | Pure functions for formatting, validation |

---

## 5. Design Patterns Applied

### 5.1 Provider Pattern (Context)

Used for global state management across the application.

```
NetworkProvider → UserProvider → PlacesProvider → App
```

### 5.2 Repository Pattern (API Layer)

Abstracts data access behind clean interfaces.

```typescript
// Abstract interface
interface PlacesRepository {
  findNearby(location: Location, radius: number): Promise<Place[]>;
  save(placeId: string): Promise<void>;
  unsave(placeId: string): Promise<void>;
}

// Concrete implementation
class ApiPlacesRepository implements PlacesRepository {
  // Implementation using HTTP client
}
```

### 5.3 Factory Pattern (API Client)

Creates configured HTTP clients with interceptors.

```typescript
function createAuthenticatedClient(): AxiosInstance {
  const client = createBaseClient();
  client.interceptors.request.use(authInterceptor);
  client.interceptors.response.use(refreshTokenInterceptor);
  return client;
}
```

### 5.4 Observer Pattern (Network State)

React to network connectivity changes.

```typescript
NetInfo.addEventListener(handleConnectivityChange);
```

### 5.5 Singleton Pattern (Configuration)

Single source of truth for app configuration.

```typescript
export const AppConfig = {
  API_BASE_URL: process.env.API_BASE_URL,
  API_TIMEOUT: 30000,
  // ...
} as const;
```

---

## 6. Data Flow Architecture

### 6.1 Authentication Flow

```
┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌─────────┐
│  Login   │───▶│  Auth     │───▶│   Token      │───▶│  Store  │
│  Screen  │    │  Service  │    │   Storage    │    │ Tokens  │
└──────────┘    └───────────┘    └──────────────┘    └─────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ Navigate to  │
                                   │ Main Stack   │
                                   └──────────────┘
```

### 6.2 Places Discovery Flow

```
┌───────────┐    ┌────────────┐    ┌────────────────┐
│ Location  │───▶│  Places    │───▶│  Places API    │
│ Service   │    │  Context   │    │  Service       │
└───────────┘    └────────────┘    └────────────────┘
                       │                    │
                       ▼                    ▼
               ┌──────────────┐    ┌────────────────┐
               │ Update State │◀───│  API Response  │
               │ (nearbyPlaces)    └────────────────┘
               └──────────────┘
                       │
                       ▼
               ┌──────────────┐
               │ Re-render    │
               │ Home Screen  │
               └──────────────┘
```

### 6.3 Token Refresh Flow

```
┌───────────┐    ┌────────────┐    ┌─────────────┐
│  API      │───▶│ 401 Error  │───▶│  Refresh    │
│  Request  │    │ Detected   │    │  Token API  │
└───────────┘    └────────────┘    └─────────────┘
                                          │
                       ┌──────────────────┴──────────────────┐
                       ▼                                      ▼
               ┌──────────────┐                       ┌──────────────┐
               │   Success    │                       │   Failure    │
               │ Update Token │                       │   Logout     │
               └──────────────┘                       └──────────────┘
                       │
                       ▼
               ┌──────────────┐
               │ Retry        │
               │ Original Req │
               └──────────────┘
```

---

## 7. State Management Strategy

### 7.1 State Categories

| Category             | Storage             | Example                  |
| -------------------- | ------------------- | ------------------------ |
| **Server State**     | React Context + API | User profile, places     |
| **UI State**         | Component State     | Modal open, form values  |
| **Navigation State** | React Navigation    | Current screen, params   |
| **Persistent State** | AsyncStorage        | Auth tokens, preferences |
| **Device State**     | Native Modules      | Location, permissions    |

### 7.2 Context Providers

| Context        | Responsibility        | Persistence  |
| -------------- | --------------------- | ------------ |
| NetworkContext | Connectivity status   | No           |
| UserContext    | User profile & stats  | No           |
| PlacesContext  | Nearby & saved places | No           |
| AuthContext    | Authentication state  | Yes (tokens) |

---

## 8. Security Architecture

### 8.1 Authentication

- JWT-based authentication
- Access token with short expiry (15 min)
- Refresh token with longer expiry (7 days)
- Automatic token refresh on 401 responses

### 8.2 Token Storage

- Tokens stored in AsyncStorage (encrypted on device)
- Tokens cleared on logout
- No tokens in URL or logs

### 8.3 API Security

- All API calls over HTTPS
- Bearer token in Authorization header
- Request/response interceptors for security handling

---

## 9. Performance Considerations

### 9.1 Optimization Strategies

| Strategy           | Implementation                                  |
| ------------------ | ----------------------------------------------- |
| Memoization        | useMemo, useCallback for expensive computations |
| Lazy Loading       | Code splitting for non-critical screens         |
| Caching            | API response caching with TTL                   |
| Debouncing         | Location updates, search inputs                 |
| Virtualization     | FlatList for long lists                         |
| Image Optimization | Lazy loading, proper sizing                     |

### 9.2 Location Tracking Optimization

- 5-second interval for location checks
- 1-minute cooldown between API calls
- Only fetch new data when user moves outside current radius

---

## 10. External Dependencies

### 10.1 Core Dependencies

| Package                     | Purpose            |
| --------------------------- | ------------------ |
| react-native                | Mobile framework   |
| react-navigation            | Navigation         |
| axios                       | HTTP client        |
| @react-native-async-storage | Persistent storage |

### 10.2 Feature Dependencies

| Package                             | Purpose             |
| ----------------------------------- | ------------------- |
| react-native-vision-camera          | Camera for AR       |
| react-native-maps                   | Map display         |
| @react-native-community/netinfo     | Network detection   |
| @react-native-community/geolocation | Location services   |
| react-native-permissions            | Permission handling |

### 10.3 UI Dependencies

| Package                      | Purpose             |
| ---------------------------- | ------------------- |
| nativewind                   | Tailwind CSS for RN |
| lucide-react-native          | Icons               |
| react-native-reanimated      | Animations          |
| react-native-gesture-handler | Gestures            |

---

## 11. Future Considerations

### 11.1 Scalability

- Consider React Query for server state management
- Evaluate Redux Toolkit for complex state
- Implement offline-first with data sync

### 11.2 Features

- Push notifications
- Deep linking
- Analytics integration
- Crash reporting

### 11.3 Testing

- Unit tests for utilities and hooks
- Integration tests for API services
- E2E tests for critical flows

---

## 12. Appendix

### 12.1 Glossary

| Term | Definition             |
| ---- | ---------------------- |
| HLD  | High-Level Design      |
| LLD  | Low-Level Design       |
| JWT  | JSON Web Token         |
| AR   | Augmented Reality      |
| SSoT | Single Source of Truth |

### 12.2 References

- [React Native Documentation](https://reactnative.dev)
- [React Navigation](https://reactnavigation.org)
- [NativeWind](https://www.nativewind.dev)
