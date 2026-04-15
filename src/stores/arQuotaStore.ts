import { create } from 'zustand';
import { getArConfig } from '../utils/api/ar';
import type { UserArConfig } from '../utils/api/ar';

interface ArQuotaState {
  enabled: boolean;
  maintenanceMode: boolean;
  provider: string;
  freeDailyQuota: number;
  premiumDailyQuota: number;
  userTier: 'free' | 'premium' | string;
  todayUsed: number;
  todayRemaining: number;
  nextReset: string | null;
  lastSyncedAt: number | null;
  syncing: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  applyServerSnapshot: (cfg: UserArConfig) => void;
  applyReconstructionResult: (quotaRemaining: number, quotaLimit: number) => void;
  reset: () => void;
}

const initialState = {
  enabled: true,
  maintenanceMode: false,
  provider: 'mock',
  freeDailyQuota: 3,
  premiumDailyQuota: 20,
  userTier: 'free' as const,
  todayUsed: 0,
  todayRemaining: 3,
  nextReset: null as string | null,
  lastSyncedAt: null as number | null,
  syncing: false,
  error: null as string | null,
};

export const useArQuotaStore = create<ArQuotaState>((set, get) => ({
  ...initialState,

  refresh: async () => {
    if (get().syncing) return;
    set({ syncing: true, error: null });
    const result = await getArConfig();
    if (result.success) {
      get().applyServerSnapshot(result.data);
      set({ syncing: false, lastSyncedAt: Date.now() });
    } else if ('quotaExceeded' in result) {
      set({ syncing: false });
    } else {
      set({ syncing: false, error: result.error.message });
    }
  },

  applyServerSnapshot: (cfg) => {
    set({
      enabled: cfg.enabled,
      maintenanceMode: cfg.maintenance_mode,
      provider: cfg.provider,
      freeDailyQuota: cfg.free_daily_quota,
      premiumDailyQuota: cfg.premium_daily_quota,
      userTier: cfg.user_tier,
      todayUsed: cfg.today_used,
      todayRemaining: cfg.today_remaining,
      nextReset: cfg.next_reset,
    });
  },

  // After a successful reconstruction, backend returns the new remaining count;
  // apply it optimistically so the quota pill updates before the next 60s refresh.
  applyReconstructionResult: (quotaRemaining, quotaLimit) => {
    set({
      todayRemaining: quotaRemaining,
      todayUsed: Math.max(0, quotaLimit - quotaRemaining),
    });
  },

  reset: () => set({ ...initialState }),
}));
