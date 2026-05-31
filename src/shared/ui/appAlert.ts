/**
 * AppAlert — drop-in replacement for React Native's `Alert.alert`.
 *
 * The signature intentionally mirrors `Alert.alert(title, message?, buttons?)`
 * so migrating call sites is near-mechanical:
 *
 *   Alert.alert('Title', 'Message', [{ text: 'OK' }])
 *   AppAlert.alert('Title', 'Message', [{ text: 'OK' }])
 *
 * Everything renders through the global `DialogHost` (mounted in App.tsx) using
 * the heritage-dark `ConfirmDialog`. Use `showToast` for transient, non-blocking
 * confirmations (e.g. "Profile updated").
 */

import { useDialogStore } from '../../stores/dialogStore';
import type {
  DialogButton,
  ToastType,
} from '../../stores/dialogStore';

interface AlertOptions {
  /** Allow scrim-tap / hardware-back dismissal. Defaults to true. */
  dismissable?: boolean;
}

export const AppAlert = {
  /**
   * Show a modal dialog. With no buttons it renders a single "OK".
   */
  alert(
    title: string,
    message?: string,
    buttons?: DialogButton[],
    options?: AlertOptions,
  ): void {
    const finalButtons: DialogButton[] =
      buttons && buttons.length > 0
        ? buttons
        : [{ text: 'OK', style: 'default' }];
    useDialogStore.getState().showDialog({
      title,
      message,
      buttons: finalButtons,
      dismissable: options?.dismissable ?? true,
    });
  },

  /**
   * Convenience confirm with Cancel + a primary action.
   */
  confirm(args: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }): void {
    useDialogStore.getState().showDialog({
      title: args.title,
      message: args.message,
      dismissable: true,
      buttons: [
        { text: args.cancelText ?? 'Cancel', style: 'cancel', onPress: args.onCancel },
        {
          text: args.confirmText ?? 'Confirm',
          style: args.destructive ? 'destructive' : 'default',
          onPress: args.onConfirm,
        },
      ],
    });
  },
};

export function showToast(
  message: string,
  options?: { type?: ToastType; duration?: number },
): void {
  useDialogStore.getState().showToast(message, options);
}
