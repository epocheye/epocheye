/**
 * Tests for reconstructForLens — the orchestration layer between the AR API
 * client, the quota store, and the contributeScan fire-and-forget path.
 */

const mockReconstructObject = jest.fn();
const mockContributeScan = jest.fn();

jest.mock('../../src/utils/api/ar', () => ({
  reconstructObject: (...args: unknown[]) => mockReconstructObject(...args),
  contributeScan: (...args: unknown[]) => mockContributeScan(...args),
}));

jest.mock('../../src/stores/arQuotaStore', () => {
  const actual = jest.requireActual('../../src/stores/arQuotaStore');
  return actual;
});

import { reconstructForLens } from '../../src/services/arReconstructionService';
import { useArQuotaStore } from '../../src/stores/arQuotaStore';

beforeEach(() => {
  mockReconstructObject.mockReset();
  mockContributeScan.mockReset();
  useArQuotaStore.getState().reset();
});

describe('reconstructForLens — success path', () => {
  const successPayload = {
    monument_id: 'konark',
    object_label: 'charioteer',
    glb_url: 'https://cdn/konark.glb',
    thumbnail_url: 'https://cdn/konark.jpg',
    provider: 'mock',
    cached: false,
    duration_ms: 300,
    generated_at: '2026-04-16T12:00:00Z',
    quota_remaining: 2,
    quota_limit: 3,
    user_tier: 'free',
    scan_count: 1,
    reconstruction_quality: 'single_view',
    is_improving: false,
  };

  it('returns kind=success with mapped fields', async () => {
    mockReconstructObject.mockResolvedValueOnce({
      success: true,
      data: successPayload,
    });

    const res = await reconstructForLens({
      monumentId: 'konark',
      objectLabel: 'charioteer',
      imageBase64: 'abc',
    });

    expect(res.kind).toBe('success');
    if (res.kind === 'success') {
      expect(res.glbUrl).toBe('https://cdn/konark.glb');
      expect(res.provider).toBe('mock');
      expect(res.scanCount).toBe(1);
      expect(res.quality).toBe('single_view');
      expect(res.isImproving).toBe(false);
    }
  });

  it('updates the quota store on non-cached success', async () => {
    mockReconstructObject.mockResolvedValueOnce({
      success: true,
      data: successPayload,
    });

    await reconstructForLens({
      monumentId: 'konark',
      objectLabel: 'charioteer',
    });

    const s = useArQuotaStore.getState();
    expect(s.todayRemaining).toBe(2);
    expect(s.todayUsed).toBe(1);
    expect(s.scanCount).toBe(1);
  });

  it('does NOT update quota store when cached', async () => {
    mockReconstructObject.mockResolvedValueOnce({
      success: true,
      data: { ...successPayload, cached: true, quota_remaining: 0 },
    });

    await reconstructForLens({
      monumentId: 'konark',
      objectLabel: 'charioteer',
    });

    // Should still be initial values since cached responses are skipped
    const s = useArQuotaStore.getState();
    expect(s.todayRemaining).toBe(3);
  });

  it('fires contributeScan on cached hit when imageBase64 is provided', async () => {
    mockReconstructObject.mockResolvedValueOnce({
      success: true,
      data: { ...successPayload, cached: true },
    });
    mockContributeScan.mockResolvedValueOnce({ success: true, data: {} });

    await reconstructForLens({
      monumentId: 'konark',
      objectLabel: 'charioteer',
      imageBase64: 'img-data',
    });

    expect(mockContributeScan).toHaveBeenCalledWith({
      monument_id: 'konark',
      object_label: 'charioteer',
      image_base64: 'img-data',
    });
  });

  it('does NOT fire contributeScan when not cached', async () => {
    mockReconstructObject.mockResolvedValueOnce({
      success: true,
      data: successPayload,
    });

    await reconstructForLens({
      monumentId: 'konark',
      objectLabel: 'charioteer',
      imageBase64: 'img-data',
    });

    expect(mockContributeScan).not.toHaveBeenCalled();
  });
});

describe('reconstructForLens — quota exceeded', () => {
  it('returns kind=quota_exceeded with info', async () => {
    mockReconstructObject.mockResolvedValueOnce({
      success: false,
      quotaExceeded: true,
      data: {
        upgrade_required: true,
        current_plan: 'free',
        used: 3,
        limit: 3,
        reset_at: '2026-04-17T00:00:00Z',
        message: 'Daily limit reached',
      },
    });

    const res = await reconstructForLens({
      monumentId: 'konark',
      objectLabel: 'charioteer',
    });

    expect(res.kind).toBe('quota_exceeded');
    if (res.kind === 'quota_exceeded') {
      expect(res.info.upgrade_required).toBe(true);
    }
  });

  it('sets quota store to 0 remaining', async () => {
    mockReconstructObject.mockResolvedValueOnce({
      success: false,
      quotaExceeded: true,
      data: {
        upgrade_required: true,
        current_plan: 'free',
        used: 3,
        limit: 3,
        reset_at: '2026-04-17T00:00:00Z',
        message: 'limit',
      },
    });

    await reconstructForLens({ monumentId: 'x', objectLabel: 'y' });
    expect(useArQuotaStore.getState().todayRemaining).toBe(0);
  });
});

describe('reconstructForLens — error', () => {
  it('returns kind=error with message', async () => {
    mockReconstructObject.mockResolvedValueOnce({
      success: false,
      error: { message: 'Server error', statusCode: 500 },
    });

    const res = await reconstructForLens({
      monumentId: 'x',
      objectLabel: 'y',
    });

    expect(res.kind).toBe('error');
    if (res.kind === 'error') {
      expect(res.message).toBe('Server error');
    }
  });
});
