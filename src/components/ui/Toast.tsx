/**
 * Toast — non-blocking, auto-dismissing transient message.
 *
 * Presentational; the global `DialogHost` renders a stack of these from
 * `dialogStore.toasts`. Slides down from the top, holds for `duration`, then
 * slides back out and calls `onDismiss`.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Check, Info, X } from 'lucide-react-native';
import type { ToastDescriptor } from '../../stores/dialogStore';

interface Props {
  toast: ToastDescriptor;
  onDismiss: (id: number) => void;
}

const ACCENT: Record<ToastDescriptor['type'], string> = {
  success: '#3FB950',
  error: '#EF4444',
  info: '#C9A84C',
};

const Toast: React.FC<Props> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const accent = ACCENT[toast.type];
  const Icon = toast.type === 'success' ? Check : toast.type === 'error' ? X : Info;

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      style={styles.wrap}>
      <View style={[styles.iconDot, { backgroundColor: `${accent}22` }]}>
        <Icon size={14} color={accent} />
      </View>
      <Text style={styles.text} numberOfLines={2}>
        {toast.message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
    maxWidth: 460,
    width: '100%',
    backgroundColor: 'rgba(20,20,20,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  iconDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontFamily: 'InstrumentSans-Medium',
    fontSize: 13.5,
    lineHeight: 19,
    color: '#F5F0E8',
  },
});

export default Toast;
