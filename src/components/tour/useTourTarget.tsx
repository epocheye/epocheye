/**
 * useTourTarget / <TourTarget> — register a screen element as a spotlight target
 * for the guided product tour. While the tour is running, the element's window
 * rect is measured (measureInWindow) and pushed into tourStore.targets[id]; the
 * TourHost reads it to draw the spotlight + arrow cue.
 *
 * Android note: a plain <View> with no background can be flattened away, which
 * breaks measureInWindow — the wrapper sets `collapsable={false}`.
 */
import React, {useCallback, useEffect, useRef} from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';
import {useTourStore} from '../../stores/tourStore';

export function useTourTarget(id: string) {
  const ref = useRef<View>(null);
  const running = useTourStore(s => s.running);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        useTourStore.getState().registerTarget(id, {x, y, width, height});
      }
    });
  }, [id]);

  const onLayout = useCallback(() => {
    if (useTourStore.getState().running) measure();
  }, [measure]);

  useEffect(() => {
    if (running) {
      // Re-measure shortly after the tour starts / advances (covers nav + scroll).
      const t = setTimeout(measure, 60);
      return () => clearTimeout(t);
    }
    useTourStore.getState().unregisterTarget(id);
    return undefined;
  }, [running, id, measure]);

  return {ref, onLayout, collapsable: false as const};
}

interface TourTargetProps {
  id: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Convenience wrapper — spotlight `children` for the tour step with this `id`. */
export const TourTarget: React.FC<TourTargetProps> = ({id, children, style}) => {
  const {ref, onLayout, collapsable} = useTourTarget(id);
  return (
    <View ref={ref} onLayout={onLayout} collapsable={collapsable} style={style}>
      {children}
    </View>
  );
};
