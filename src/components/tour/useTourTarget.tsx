/**
 * useTourTarget / <TourTarget> — register a screen element as a spotlight target
 * for the guided product tour. While the tour is running, the element's window
 * rect is measured (measureInWindow) and pushed into tourStore.targets[id]; the
 * TourHost reads it to draw the spotlight + arrow cue.
 *
 * Three things matter for the rect to be correct:
 *
 * 1. The wrapper IS the measured box. A bare <View> stretches to its parent's
 *    full width, so if the visible card carries its own margins the spotlight
 *    ends up wider and taller than the thing it is circling. Pass those margins
 *    to `style` here rather than leaving them on the child.
 * 2. Re-measure per step, not once per tour. The effect below is keyed on the
 *    active step index; tabs are frozen on blur (TabNavigation), so onLayout
 *    alone will not fire again when the tour navigates back to a mounted tab.
 * 3. Off-fold targets are scrolled into view first, via the nearest
 *    <TourScrollView>. Without that there is nothing on screen to measure.
 *
 * Android note: a plain <View> with no background can be flattened away, which
 * breaks measureInWindow — the wrapper sets `collapsable={false}`.
 */
import React, {useCallback, useEffect, useRef} from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';
import {useTourStore} from '../../stores/tourStore';
import {TOUR_STEPS} from '../../constants/appTour';
import {useTourScroll} from './TourScrollView';

export function useTourTarget(id: string, radius?: number) {
  const ref = useRef<View>(null);
  const running = useTourStore(s => s.running);
  const stepIndex = useTourStore(s => s.stepIndex);
  const scroll = useTourScroll();

  /** Only the step's own target may drive the scroll position. */
  const isActiveTarget = TOUR_STEPS[stepIndex]?.targetId === id;

  const measure = useCallback(
    (scrollIntoView = false) => {
      const node = ref.current;
      if (!node) return;
      node.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) return;
        useTourStore.getState().registerTarget(id, {x, y, width, height, radius});
        if (scrollIntoView) scroll?.ensureVisible({y, height});
      });
    },
    [id, radius, scroll],
  );

  const onLayout = useCallback(() => {
    if (useTourStore.getState().running) measure();
  }, [measure]);

  useEffect(() => {
    if (!running) {
      useTourStore.getState().unregisterTarget(id);
      return undefined;
    }
    // Short delay so navigation/mount has settled before the first measurement.
    const t = setTimeout(() => measure(isActiveTarget), 60);
    return () => clearTimeout(t);
  }, [running, stepIndex, isActiveTarget, id, measure]);

  // Keep the rect honest while the user scrolls. Re-measuring (rather than
  // offsetting by scroll delta) keeps this correct for collapsing headers and
  // any other transform between the target and the window.
  useEffect(() => {
    if (!running || !scroll) return undefined;
    return scroll.subscribe(() => measure());
  }, [running, scroll, measure]);

  useEffect(
    () => () => {
      useTourStore.getState().unregisterTarget(id);
    },
    [id],
  );

  return {ref, onLayout, collapsable: false as const};
}

interface TourTargetProps {
  id: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Corner radius of the visible element, so the cutout hugs it instead of
   * using a fixed guess. Defaults to the host's own fallback.
   */
  radius?: number;
}

/** Convenience wrapper — spotlight `children` for the tour step with this `id`. */
export const TourTarget: React.FC<TourTargetProps> = ({
  id,
  children,
  style,
  radius,
}) => {
  const {ref, onLayout, collapsable} = useTourTarget(id, radius);
  return (
    <View ref={ref} onLayout={onLayout} collapsable={collapsable} style={style}>
      {children}
    </View>
  );
};
