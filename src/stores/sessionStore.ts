import { create } from 'zustand';
import { bootstrapAuthSession } from '../utils/api/auth/tokenStorage';
import { startVisitTracking, stopVisitTracking } from '../services/visitTrackingService';

interface SessionStoreState {
  authenticated: boolean;
  bootstrapped: boolean;
  bootstrapSession: () => Promise<boolean>;
  setAuthenticated: (authenticated: boolean) => void;
}

export const useSessionStore = create<SessionStoreState>(set => ({
  authenticated: false,
  bootstrapped: false,
  bootstrapSession: async () => {
    const tokens = await bootstrapAuthSession();
    const authenticated = tokens !== null;
    set({
      authenticated,
      bootstrapped: true,
    });
    if (authenticated) startVisitTracking();
    return authenticated;
  },
  setAuthenticated: authenticated => {
    set({
      authenticated,
      bootstrapped: true,
    });
    if (authenticated) {
      startVisitTracking();
    } else {
      stopVisitTracking();
    }
  },
}));
