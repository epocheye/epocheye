/**
 * useExitConfirm — confirm before the Android hardware back closes the app.
 *
 * Mounted on a *root* screen (e.g. the Home tab) where a hardware-back press
 * would otherwise finish the activity and exit the app. While the screen is
 * focused, back is intercepted and the heritage-styled `ConfirmDialog` is shown;
 * the app only exits (`BackHandler.exitApp()`) if the user confirms.
 *
 * Android-only in effect: iOS has no hardware back, so the listener never fires.
 * The confirm dialog is an RN `<Modal>`, so a second back press dismisses the
 * dialog rather than exiting — no double-exit path.
 */

import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppAlert } from '../ui/appAlert';

export interface UseExitConfirmOptions {
  /** When false, back proceeds with default behaviour (no prompt). */
  enabled?: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

export function useExitConfirm({
  enabled = true,
  title,
  message,
  confirmText,
  cancelText,
}: UseExitConfirmOptions): void {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      const onBack = () => {
        AppAlert.confirm({
          title,
          message,
          confirmText,
          cancelText,
          onConfirm: () => BackHandler.exitApp(),
        });
        return true; // consume the event; exit only via the dialog's confirm.
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [enabled, title, message, confirmText, cancelText]),
  );
}
