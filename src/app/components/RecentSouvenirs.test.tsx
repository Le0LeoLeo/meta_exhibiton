import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from './I18nProvider';
import { RecentSouvenirs } from './RecentSouvenirs';

const listRecent = vi.fn();
vi.mock('../api/exhibitionPassport', () => ({ listRecentExhibitionSouvenirs: (...args: unknown[]) => listRecent(...args) }));

const souvenir = (index: number) => ({
  schemaVersion: 1, galleryId: `gallery-${index}`, galleryTitle: `Gallery ${index}`,
  galleryOwnerName: 'Curator', completedAt: '2026-07-22T00:00:00.000Z', visitedCount: 3,
  engagedCount: 1, totalDwellSeconds: 120, favoriteExhibit: null, reflection: '', token: `token-${index}`,
});

function renderSection() {
  return render(<MemoryRouter><I18nProvider><RecentSouvenirs /></I18nProvider></MemoryRouter>);
}

describe('RecentSouvenirs', () => {
  beforeEach(() => { listRecent.mockReset(); localStorage.setItem('metaexpo-locale', 'zh-TW'); });
  afterEach(cleanup);

  it('renders an empty state', async () => {
    listRecent.mockResolvedValue([]);
    renderSection();
    expect(await screen.findByRole('link', { name: '立即參觀示範展' })).toHaveAttribute('href', '/demo');
    expect(screen.queryByText('暫時未有公開的展覽紀念卡。')).not.toBeInTheDocument();
  });

  it('hides the section when the API fails', async () => {
    listRecent.mockResolvedValue(null);
    const { container } = renderSection();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('caps the public activity list at six linked cards', async () => {
    listRecent.mockResolvedValue(Array.from({ length: 8 }, (_, index) => souvenir(index)));
    renderSection();
    expect(await screen.findAllByRole('link', { name: /查看紀念卡/ })).toHaveLength(6);
    expect(screen.queryByText('Gallery 6')).not.toBeInTheDocument();
    expect(listRecent).toHaveBeenCalledWith(6);
  });
});
