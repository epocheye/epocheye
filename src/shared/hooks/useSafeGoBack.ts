/**
 * useSafeGoBack — a `goBack()` that can never fall through to closing the app.
 *
 * On a full-screen-modal camera/AR screen, an Android hardware-back press (or an
 * over-eager navigation action) can occasionally pop past the screen's parent and
 * finish the activity — closing the whole app instead of just dismissing the
 * camera session. This helper guarantees a back press only ever exits the current
 * screen: it pops when there is somewhere to pop to, and otherwise lands the user
 * on the main tabs rather than exiting.
 */

import { useCallback, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ROUTES } from '../../core/constants';
import type { MainNavigationProp } from '../../core/types';

export function useSafeGoBack(): () => void {
  const navigation = useNavigation<MainNavigationProp>();

  return useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // No parent to return to — go to the tab shell instead of finishing the
      // activity (which would close the app).
      navigation.navigate(ROUTES.MAIN.TABS);
    }
  }, [navigation]);
}

/**
 * useSafeBackHandler — like {@link useSafeGoBack}, but also intercepts the
 * Android hardware back button while the screen is focused and routes it
 * through the safe-back path.
 *
 * A native-stack full-screen-modal screen (the AR camera / object-scan views)
 * can otherwise let a hardware-back press pop past the modal and finish the
 * activity — closing the whole app instead of just exiting the camera session.
 * Returning `true` from the handler consumes the event so the default back
 * never runs. Returns the same safe-back callback for in-screen close buttons.
 *
 * Pass `onIntercept` to let the screen handle back FIRST (e.g. close an open
 * overlay that isn't a native `<Modal>`). Return `true` from it when it handled
 * the press; return `false` to fall through to the safe-back. Keep it memoised
 * (e.g. `useCallback`) so the listener isn't re-registered every render.
 */
export function useSafeBackHandler(onIntercept?: () => boolean): () => void {
  const safeGoBack = useSafeGoBack();

  // Keep the latest intercept in a ref so the focus effect registers the
  // hardware-back listener ONCE per focus, instead of re-subscribing every time
  // the caller's intercept identity changes (e.g. on each overlay-state update).
  const interceptRef = useRef(onIntercept);
  interceptRef.current = onIntercept;

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (interceptRef.current?.()) {
          return true;
        }
        safeGoBack();
        return true;
      });
      return () => sub.remove();
    }, [safeGoBack]),
  );

  return safeGoBack;
}
