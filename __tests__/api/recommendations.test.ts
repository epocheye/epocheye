/**
 * Verifies the recommendations API client forwards the expected params
 * to the backend endpoint.
 */

const mockGet = jest.fn();

jest.mock('../../src/utils/api/auth', () => ({
  createAuthenticatedClient: () => ({ get: mockGet }),
}));

import { getRecommendations } from '../../src/utils/api/recommendations/Recommendations';

describe('getRecommendations', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('calls /api/v1/recommendations/ with empty params by default', async () => {
    mockGet.mockResolvedValueOnce({ data: { items: [], count: 0, personalized: false } });

    const res = await getRecommendations();

    expect(mockGet).toHaveBeenCalledWith('/api/v1/recommendations/', { params: {} });
    expect(res.success).toBe(true);
  });

  it('forwards limit/lat/lon when provided', async () => {
    mockGet.mockResolvedValueOnce({ data: { items: [], count: 0, personalized: true } });

    await getRecommendations({ limit: 15, lat: 19.8876, lon: 86.0945 });

    expect(mockGet).toHaveBeenCalledWith('/api/v1/recommendations/', {
      params: { limit: 15, lat: 19.8876, lon: 86.0945 },
    });
  });

  it('returns failure result when the request throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('network down'));
    const res = await getRecommendations();
    expect(res.success).toBe(false);
  });
});
