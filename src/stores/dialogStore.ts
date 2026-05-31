/**
 * dialogStore — global, imperative dialog + toast state.
 *
 * Replaces React Native's `Alert.alert` (which renders the OS-default, off-brand
 * dialog) with a single heritage-styled host mounted once at the app root
 * (see `src/components/ui/DialogHost.tsx`). Any module — hooks, services,
 * screens — can trigger UI by calling the actions on this store via the
 * `AppAlert` / `showToast` facade in `src/shared/ui/appAlert.ts`.
 *
 * Mirrors the four existing Zustand stores (sessionStore/userStore/…): no React
 * context, no providers.
 */

import { create } from 'zustand';

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export interface DialogButton {
  text: string;
  style?: DialogButtonStyle;
  onPress?: () => void;
}

export interface DialogDescriptor {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  /** When true the scrim tap / hardware back resolves the cancel button. */
  dismissable?: boolean;
}

export type ToastType = 'success' | 'error' | 'info';

export interface ToastDescriptor {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

interface DialogStoreState {
  dialog: DialogDescriptor | null;
  toasts: ToastDescriptor[];
  showDialog: (descriptor: Omit<DialogDescriptor, 'id'>) => number;
  hideDialog: () => void;
  showToast: (
    message: string,
    options?: { type?: ToastType; duration?: number },
  ) => number;
  dismissToast: (id: number) => void;
}

let nextId = 1;

export const useDialogStore = create<DialogStoreState>(set => ({
  dialog: null,
  toasts: [],

  showDialog: descriptor => {
    const id = nextId++;
    set({ dialog: { ...descriptor, id } });
    return id;
  },

  hideDialog: () => set({ dialog: null }),

  showToast: (message, options) => {
    const id = nextId++;
    const toast: ToastDescriptor = {
      id,
      message,
      type: options?.type ?? 'info',
      duration: options?.duration ?? 2800,
    };
    set(state => ({ toasts: [...state.toasts, toast] }));
    return id;
  },

  dismissToast: id =>
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));
