/**
 * ConfirmDialog — heritage-styled replacement for the OS alert.
 *
 * Presentational only: it renders a single dialog descriptor and reports which
 * button was pressed. The global `DialogHost` wires it to `dialogStore`.
 *
 * Layout rules (match common native behaviour):
 *   - 2 buttons  → side-by-side row
 *   - 1 or 3+    → stacked, full width
 */

import React, { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
} from 'react-native-reanimated';
import type {
  DialogButton,
  DialogDescriptor,
} from '../../stores/dialogStore';

interface Props {
  dialog: DialogDescriptor;
  onResolve: (button: DialogButton) => void;
  onDismiss: () => void;
}

const ConfirmDialog: React.FC<Props> = ({ dialog, onResolve, onDismiss }) => {
  const { title, message, buttons, dismissable } = dialog;
  const isRow = buttons.length === 2;

  const handleScrimPress = useCallback(() => {
    if (dismissable === false) return;
    const cancel = buttons.find(b => b.style === 'cancel');
    if (cancel) {
      onResolve(cancel);
    } else {
      onDismiss();
    }
  }, [buttons, dismissable, onResolve, onDismiss]);

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleScrimPress}>
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(140)}
        style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleScrimPress} />

        <Animated.View
          entering={ZoomIn.duration(180).withInitialValues({
            transform: [{ scale: 0.9 }],
          })}
          style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={[styles.buttonRow, isRow ? styles.row : styles.column]}>
            {buttons.map((button, index) => (
              <DialogButtonView
                key={`${button.text}-${index}`}
                button={button}
                isRow={isRow}
                onPress={() => onResolve(button)}
              />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const DialogButtonView: React.FC<{
  button: DialogButton;
  isRow: boolean;
  onPress: () => void;
}> = ({ button, isRow, onPress }) => {
  const style = button.style ?? 'default';
  const fill =
    style === 'default'
      ? styles.btnDefault
      : style === 'destructive'
      ? styles.btnDestructive
      : styles.btnCancel;
  const text =
    style === 'default'
      ? styles.btnDefaultText
      : style === 'destructive'
      ? styles.btnDestructiveText
      : styles.btnCancelText;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={button.text}
      style={({ pressed }) => [
        styles.btn,
        fill,
        isRow && styles.btnFlex,
        pressed && styles.btnPressed,
      ]}>
      <Text style={[styles.btnText, text]} numberOfLines={1}>
        {button.text}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    // Gold glow instead of drop shadow on dark backgrounds.
    shadowColor: '#C9A84C',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  title: {
    fontFamily: 'InstrumentSerif-Regular',
    fontSize: 24,
    lineHeight: 28,
    color: '#F5F0E8',
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.66)',
    textAlign: 'center',
  },
  buttonRow: {
    marginTop: 22,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    flexDirection: 'column',
  },
  btn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnFlex: {
    flex: 1,
  },
  btnPressed: {
    opacity: 0.82,
  },
  btnText: {
    fontFamily: 'InstrumentSans-SemiBold',
    fontSize: 15,
  },
  btnDefault: {
    backgroundColor: '#C9A84C',
  },
  btnDefaultText: {
    color: '#0A0A0A',
  },
  btnCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  btnCancelText: {
    color: 'rgba(255,255,255,0.78)',
  },
  btnDestructive: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  btnDestructiveText: {
    color: '#FCA5A5',
  },
});

export default ConfirmDialog;
