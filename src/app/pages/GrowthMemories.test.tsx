import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import GrowthMemories from './GrowthMemories';

const api = vi.hoisted(() => ({
  getMyGrowthRecommendations: vi.fn(),
  getMyGrowthChildren: vi.fn(),
  getMyGrowthExhibits: vi.fn(),
  getGrowthAssetsByExhibit: vi.fn(),
  getGrowthCommentsByExhibit: vi.fn(),
}));

vi.mock('../components/I18nProvider', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../api/client', () => ({
  loadAuth: () => ({ token: 'test-token' }),
  ...api,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GrowthMemories', () => {
  it('loads only the recommendation data rendered by the page', async () => {
    api.getMyGrowthRecommendations.mockResolvedValue({ route: null, routes: [] });

    render(
      <MemoryRouter>
        <GrowthMemories />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(api.getMyGrowthRecommendations).toHaveBeenCalledWith('test-token', {
        mode: 'explore',
        interest: 'story',
        depth: 'balanced',
      });
    });
    expect(api.getMyGrowthChildren).not.toHaveBeenCalled();
    expect(api.getMyGrowthExhibits).not.toHaveBeenCalled();
    expect(api.getGrowthAssetsByExhibit).not.toHaveBeenCalled();
    expect(api.getGrowthCommentsByExhibit).not.toHaveBeenCalled();
  });
});
