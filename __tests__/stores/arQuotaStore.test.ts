/**
 * Tests for the AR quota Zustand store — verifies state transitions for
 * reconstruction results, server snapshots, and the new scan/quality fields.
 */

jest.mock('../../src/utils/api/ar', () => ({
  getArConfig: jest.fn(),
}));

import { useArQuotaStore } from '../../src/stores/arQuotaStore';
import { getArConfig } from '../../src/utils/api/ar';

const mockedGetArConfig = getArConfig as jest.MockedFunction<typeof getArConfig>;

beforeEach(() => {
  useArQuotaStore.getState().reset();
  mockedGetArConfig.mockReset();
});

describe('initial state', () => {
  it('starts with sensible defaults', () => {
    const s = useArQuotaStore.getState();
    expect(s.enabled).toBe(true);
    expect(s.todayRemaining).toBe(3);
    expect(s.todayUsed).toBe(0);
    expect(s.scanCount).toBe(0);
    expect(s.quality).toBe('none');
    expect(s.isImproving).toBe(false);
    expect(s.provider).toBe('mock');
  });
});

describe('applyReconstructionResult', () => {
  it('updates remaining and used from quota args', () => {
    useArQuotaStore.getState().applyReconstructionResult(2, 3);
    const s = useArQuotaStore.getState();
    expect(s.todayRemaining).toBe(2);
    expect(s.todayUsed).toBe(1);
  });

  it('clamps todayUsed to zero when remaining > limit', () => {
    useArQuotaStore.getState().applyReconstructionResult(5, 3);
    expect(useArQuotaStore.getState().todayUsed).toBe(0);
  });

  it('accepts optional scanCount, quality, and isImproving', () => {
    useArQuotaStore
      .getState()
      .applyReconstructionResult(1, 3, 12, 'multi_view', true);
    const s = useArQuotaStore.getState();
    expect(s.scanCount).toBe(12);
    expect(s.quality).toBe('multi_view');
    expect(s.isImproving).toBe(true);
  });

  it('does not overwrite scan fields when they are omitted', () => {
    useArQuotaStore
      .getState()
      .applyReconstructionResult(1, 3, 5, 'single_view', false);
    // Second call without optional fields:
    useArQuotaStore.getState().applyReconstructionResult(0, 3);
    const s = useArQuotaStore.getState();
    // scanCount/quality/isImproving should be unchanged
    expect(s.scanCount).toBe(5);
    expect(s.quality).toBe('single_view');
    expect(s.isImproving).toBe(false);
  });
});

describe('applyServerSnapshot', () => {
  it('maps snake_case server response to camelCase state', () => {
    useArQuotaStore.getState().applyServerSnapshot({
      enabled: false,
      maintenance_mode: true,
      provider: 'sagemaker',
      free_daily_quota: 5,
      premium_daily_quota: 50,
      user_tier: 'premium',
      today_used: 3,
      today_remaining: 47,
      next_reset: '2026-04-17T00:00:00Z',
    });
    const s = useArQuotaStore.getState();
    expect(s.enabled).toBe(false);
    expect(s.maintenanceMode).toBe(true);
    expect(s.provider).toBe('sagemaker');
    expect(s.freeDailyQuota).toBe(5);
    expect(s.premiumDailyQuota).toBe(50);
    expect(s.userTier).toBe('premium');
    expect(s.todayUsed).toBe(3);
    expect(s.todayRemaining).toBe(47);
    expect(s.nextReset).toBe('2026-04-17T00:00:00Z');
  });
});

describe('reset', () => {
  it('restores all fields to initial values', () => {
    useArQuotaStore
      .getState()
      .applyReconstructionResult(0, 3, 15, 'multi_view', true);
    useArQuotaStore.getState().reset();
    const s = useArQuotaStore.getState();
    expect(s.todayRemaining).toBe(3);
    expect(s.scanCount).toBe(0);
    expect(s.quality).toBe('none');
    expect(s.isImproving).toBe(false);
  });
});

describe('refresh', () => {
  it('calls getArConfig and applies snapshot on success', async () => {
    mockedGetArConfig.mockResolvedValueOnce({
      success: true,
      data: {
        enabled: true,
        maintenance_mode: false,
        provider: 'mock',
        free_daily_quota: 3,
        premium_daily_quota: 20,
        user_tier: 'free',
        today_used: 1,
        today_remaining: 2,
        next_reset: '2026-04-17T00:00:00Z',
      },
    });

    await useArQuotaStore.getState().refresh();
    const s = useArQuotaStore.getState();
    expect(s.todayUsed).toBe(1);
    expect(s.todayRemaining).toBe(2);
    expect(s.syncing).toBe(false);
    expect(s.lastSyncedAt).not.toBeNull();
  });

  it('sets error on failure', async () => {
    mockedGetArConfig.mockResolvedValueOnce({
      success: false,
      error: { message: 'network down', statusCode: 0 },
    });

    await useArQuotaStore.getState().refresh();
    const s = useArQuotaStore.getState();
    expect(s.error).toBe('network down');
    expect(s.syncing).toBe(false);
  });

  it('does not double-refresh while syncing', async () => {
    let resolveFirst: (v: any) => void;
    const firstCall = new Promise(r => { resolveFirst = r; });
    mockedGetArConfig.mockReturnValueOnce(firstCall as any);

    // Fire two refreshes concurrently
    const p1 = useArQuotaStore.getState().refresh();
    const p2 = useArQuotaStore.getState().refresh();

    resolveFirst!({
      success: true,
      data: {
        enabled: true, maintenance_mode: false, provider: 'mock',
        free_daily_quota: 3, premium_daily_quota: 20, user_tier: 'free',
        today_used: 0, today_remaining: 3, next_reset: '',
      },
    });

    await Promise.all([p1, p2]);
    // getArConfig should only have been called once
    expect(mockedGetArConfig).toHaveBeenCalledTimes(1);
  });
});
