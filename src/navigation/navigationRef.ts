/**
 * Shared NavigationContainer ref.
 *
 * Lets non-screen modules drive navigation imperatively — specifically the
 * guided product tour's `TourHost`, which is mounted ABOVE the
 * NavigationContainer (next to DialogHost) and needs to switch tabs / open
 * screens as the user taps "Next". Attached to <NavigationContainer> in
 * src/navigation/index.tsx.
 */
import {createNavigationContainerRef} from '@react-navigation/native';
import type {MainStackParamList} from '../core/types/navigation.types';

export const navigationRef = createNavigationContainerRef<MainStackParamList>();

/** Imperative navigate that no-ops until the container is mounted. */
export function navigateSafe(name: string, params?: Record<string, unknown>): void {
  if (navigationRef.isReady()) {
    (navigationRef.navigate as (n: string, p?: Record<string, unknown>) => void)(
      name,
      params,
    );
  }
}
