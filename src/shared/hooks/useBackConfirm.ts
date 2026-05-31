/**
 * useBackConfirm — intercept screen exit and ask for confirmation.
 *
 * When `enabled`, any attempt to leave the screen (swipe-back gesture, Android
 * hardware back, header/back button, or an in-screen `navigation.goBack()`)
 * is paused and the heritage-styled `ConfirmDialog` is shown. The original
 * navigation action only runs if the user confirms.
 *
 * Relies on the native-stack `beforeRemove` event, which fires for all of the
 * above, so a single listener covers every back path — including custom
 * in-screen back buttons that call `goBack()`.
 */

import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useDialogStore } from '../../stores/dialogStore';

export interface UseBackConfirmOptions {
  /** When false, exits proceed immediately with no prompt. */
  enabled: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

export function useBackConfirm({
  enabled,
  title,
  message,
  confirmText = 'Leave',
  cancelText = 'Stay',
}: UseBackConfirmOptions): void {
  const navigation = useNavigation();
  // Set just before we re-dispatch a confirmed action so the listener lets it
  // through instead of re-prompting (which would loop forever).
  const allowNext = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (allowNext.current || !enabled) {
        return;
      }
      e.preventDefault();
      useDialogStore.getState().showDialog({
        title,
        message,
        dismissable: true,
        buttons: [
          { text: cancelText, style: 'cancel' },
          {
            text: confirmText,
            style: 'destructive',
            onPress: () => {
              allowNext.current = true;
              navigation.dispatch(e.data.action);
            },
          },
        ],
      });
    });

    return unsubscribe;
  }, [navigation, enabled, title, message, confirmText, cancelText]);
}
