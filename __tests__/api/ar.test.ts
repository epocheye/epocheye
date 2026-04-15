/**
 * Covers the AR API client: happy-path POST and the 402 quota branch
 * that surfaces as success=false + quotaExceeded=true.
 */

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('../../src/utils/api/auth', () => ({
  createAuthenticatedClient: () => ({ get: mockGet, post: mockPost }),
}));

jest.mock('../../src/utils/api/helpers', () => {
  const actual = jest.requireActual('../../src/utils/api/helpers');
  return {
    ...actual,
    isApiError: (err: unknown) =>
      Boolean(err && typeof err === 'object' && 'response' in err),
  };
});

import { getArConfig, reconstructObject } from '../../src/utils/api/ar/Ar';

describe('getArConfig', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('hits /api/v1/ar/config', async () => {
    mockGet.mockResolvedValueOnce({ data: { provider: 'mock', enabled: true } });
    const res = await getArConfig();
    expect(mockGet).toHaveBeenCalledWith('/api/v1/ar/config');
    expect(res.success).toBe(true);
  });

  it('returns failure when the call throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    const res = await getArConfig();
    expect(res.success).toBe(false);
  });
});

describe('reconstructObject', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('posts the reconstruction request to /api/lens/reconstruct', async () => {
    mockPost.mockResolvedValueOnce({
      data: { glb_url: 'x', cached: false, duration_ms: 200, provider: 'mock' },
    });

    await reconstructObject({
      monument_id: 'konark',
      object_label: 'charioteer',
      image_b64: 'abc',
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/api/lens/reconstruct',
      { monument_id: 'konark', object_label: 'charioteer', image_b64: 'abc' },
    );
  });

  it('maps a 402 response to quotaExceeded discriminant', async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        status: 402,
        data: {
          upgrade_required: true,
          current_plan: 'free',
          reset_at: '2026-04-17T00:00:00Z',
        },
      },
    });

    const res = await reconstructObject({
      monument_id: 'konark',
      object_label: 'charioteer',
      image_b64: 'abc',
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.quotaExceeded).toBe(true);
      expect(res.data.upgrade_required).toBe(true);
    }
  });

  it('returns generic error on non-402 failures', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    const res = await reconstructObject({
      monument_id: 'x',
      object_label: 'y',
      image_b64: '',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.quotaExceeded).toBeFalsy();
    }
  });
});
