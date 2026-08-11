/**
 * TourScrollView — a ScrollView that the guided tour can drive.
 *
 * The tour spotlights elements by their window rect. That breaks down for any
 * target sitting below the fold: there is nothing to measure on screen, so the
 * step used to degrade into a mis-placed centered card (see the header comment
 * in src/constants/appTour.ts, which restricted the tour to above-the-fold
 * targets purely to work around this).
 *
 * Wrapping a screen's ScrollView in this component publishes two things to any
 * <TourTarget> beneath it:
 *   - `ensureVisible(rect)` — scroll a window-space rect into view, so an
 *     off-fold target can be measured at all.
 *   - `subscribe(fn)` — fire while the user scrolls, so a spotlight already on
 *     screen tracks its target instead of drifting.
 *
 * Screens that have no ScrollView (Home) simply render targets outside any
 * provider; useTourTarget treats the missing context as "nothing to scroll".
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  ScrollView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';

/** Gap kept between a scrolled-to target and the viewport edge. */
const SCROLL_PADDING = 24;

export interface TourScrollApi {
  /**
   * Scroll the minimum amount needed to bring a window-space rect fully into
   * view. No-op when it already is, so it never fights the user.
   */
  ensureVisible: (rect: {y: number; height: number}) => void;
  /** Subscribe to scroll activity. Returns an unsubscribe function. */
  subscribe: (fn: () => void) => () => void;
}

const TourScrollContext = createContext<TourScrollApi | null>(null);

export const useTourScroll = () => useContext(TourScrollContext);

/**
 * Any ScrollView-compatible component that forwards its ref to the host scroll
 * view. Deliberately untyped in its props: implementations differ in both their
 * extra props and their ref shape (KeyboardAwareScrollView's ref adds methods
 * ScrollView's does not), so a structural type here would reject valid ones.
 * We only ever call scrollTo/measureInWindow, which every ScrollView host has.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScrollLike = React.ComponentType<any>;

type TourScrollViewProps = ScrollViewProps &
  Record<string, unknown> & {
    /** Underlying scroll component. Defaults to ScrollView. */
    as?: ScrollLike;
  };

const TourScrollView: React.FC<TourScrollViewProps> = ({
  as,
  children,
  onScroll,
  onLayout,
  ...rest
}) => {
  const ScrollComponent = (as ?? ScrollView) as ScrollLike;
  const ref = useRef<ScrollView>(null);
  const offsetY = useRef(0);
  /** The ScrollView's own viewport in window coords — the frame of reference. */
  const viewport = useRef({y: 0, height: 0});
  const listeners = useRef(new Set<() => void>());

  const measureViewport = useCallback(() => {
    // @ts-expect-error — ScrollView exposes the host view's measure methods.
    ref.current?.measureInWindow?.((_x: number, y: number, _w: number, height: number) => {
      if (height > 0) viewport.current = {y, height};
    });
  }, []);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      measureViewport();
      onLayout?.(e);
    },
    [measureViewport, onLayout],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offsetY.current = e.nativeEvent.contentOffset.y;
      listeners.current.forEach(fn => fn());
      onScroll?.(e);
    },
    [onScroll],
  );

  const api = useMemo<TourScrollApi>(
    () => ({
      ensureVisible: rect => {
        const {y: vpY, height: vpH} = viewport.current;
        if (vpH <= 0) return;

        const top = vpY + SCROLL_PADDING;
        const bottom = vpY + vpH - SCROLL_PADDING;

        let delta = 0;
        if (rect.y < top) {
          // Above the fold — scroll up by the shortfall.
          delta = rect.y - top;
        } else if (rect.y + rect.height > bottom) {
          // Below the fold — scroll down just enough, but never so far that the
          // target's top edge is pushed off the top of the viewport.
          delta = Math.min(
            rect.y + rect.height - bottom,
            Math.max(0, rect.y - top),
          );
        }
        if (Math.abs(delta) < 1) return;

        ref.current?.scrollTo({
          y: Math.max(0, offsetY.current + delta),
          animated: true,
        });
      },
      subscribe: fn => {
        listeners.current.add(fn);
        return () => {
          listeners.current.delete(fn);
        };
      },
    }),
    [],
  );

  useEffect(() => {
    const pending = listeners.current;
    return () => pending.clear();
  }, []);

  return (
    <TourScrollContext.Provider value={api}>
      <ScrollComponent
        {...rest}
        ref={ref}
        onLayout={handleLayout}
        onScroll={handleScroll}
        scrollEventThrottle={16}>
        {children}
      </ScrollComponent>
    </TourScrollContext.Provider>
  );
};

export default TourScrollView;
