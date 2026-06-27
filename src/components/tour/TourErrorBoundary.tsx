/**
 * TourErrorBoundary — a SILENT boundary for the guided tour.
 *
 * The tour auto-runs on first launch and overlays every screen, so a render error
 * inside TourHost must never take down the app (or show the full-screen recovery
 * UI). This boundary catches such an error, renders nothing, and ends the tour —
 * the app underneath keeps working. The error is logged so it shows in adb logcat.
 */
import React from 'react';
import {useTourStore} from '../../stores/tourStore';

interface Props {
  children: React.ReactNode;
}
interface State {
  failed: boolean;
}

class TourErrorBoundary extends React.Component<Props, State> {
  state: State = {failed: false};

  static getDerivedStateFromError(): State {
    return {failed: true};
  }

  componentDidCatch(error: Error, info: {componentStack: string}) {
    console.error('[TourErrorBoundary] tour disabled after error:', error, info.componentStack);
    try {
      useTourStore.getState().finish();
    } catch {
      // ignore — we're already in a failure path
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default TourErrorBoundary;
