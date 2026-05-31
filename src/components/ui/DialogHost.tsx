/**
 * DialogHost — single mount point for the global dialog + toast system.
 *
 * Mounted once in App.tsx inside SafeAreaProvider so it overlays every screen.
 * Subscribes to `dialogStore` and renders:
 *   - the active `ConfirmDialog` (RN Modal, blocks interaction)
 *   - a top-anchored stack of `Toast`s (non-blocking)
 */

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDialogStore } from '../../stores/dialogStore';
import type { DialogButton } from '../../stores/dialogStore';
import ConfirmDialog from './ConfirmDialog';
import Toast from './Toast';

const DialogHost: React.FC = () => {
  const insets = useSafeAreaInsets();
  const dialog = useDialogStore(s => s.dialog);
  const toasts = useDialogStore(s => s.toasts);
  const hideDialog = useDialogStore(s => s.hideDialog);
  const dismissToast = useDialogStore(s => s.dismissToast);

  const handleResolve = useCallback(
    (button: DialogButton) => {
      // Hide first so a button handler that triggers another dialog/toast isn't
      // immediately overwritten.
      hideDialog();
      button.onPress?.();
    },
    [hideDialog],
  );

  return (
    <>
      {dialog ? (
        <ConfirmDialog
          dialog={dialog}
          onResolve={handleResolve}
          onDismiss={hideDialog}
        />
      ) : null}

      {toasts.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={[styles.toastLayer, { paddingTop: insets.top + 8 }]}>
          {toasts.map(toast => (
            <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </View>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  toastLayer: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
});

export default DialogHost;
