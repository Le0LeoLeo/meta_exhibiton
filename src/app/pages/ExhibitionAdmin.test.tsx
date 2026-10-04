import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGalleryAdminAnalytics, deleteGalleryComment, type GalleryAdminAnalytics } from '../api/client';
import ExhibitionAdmin from './ExhibitionAdmin';

vi.mock('../api/client', () => ({ loadAuth: () => ({ token: 'owner-token' }), getGalleryAdminAnalytics: vi.fn(), deleteGalleryComment: vi.fn() }));
vi.mock('../components/I18nProvider', () => ({ useI18n: () => ({ locale: 'en', t: (key: string) => key }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const gallery = { id: 'gallery-a', ownerId: 'owner', title: 'Gallery A', description: '', templateTitle: '', templateImage: '', category: '', createdAt: '', updatedAt: '', revision: 1, itemCount: 1, commentCount: 1, visitorCount: 3, visitCount: 5, engagedCount: 0, totalDwellSeconds: 35, popularityScore: 999, latestActivityAt: '' };
function result(visits = 5): GalleryAdminAnalytics {
  return { summary: { totalGalleries: 1, publishedGalleries: 1, totalItems: 1, totalComments: 1, totalVisitors: 3, totalVisits: visits, averageVisitSeconds: 7, totalDwellSeconds: 35, topGallery: null }, galleries: [{ ...gallery, visitCount: visits }], items: [], comments: [], availableGalleries: [{ id: 'gallery-a', title: 'Gallery A' }, { id: 'gallery-b', title: 'Gallery B' }], daily: [{ date: '2026-09-05', visitCount: visits, visitorCount: 3, totalDwellSeconds: 35 }], period: { range: '30d', from: '2026-08-07', to: '2026-09-05', timeZone: 'Asia/Hong_Kong' }, measurementStartedAt: '2026-09-05T00:00:00Z' };
}
function mount() { render(<MemoryRouter><ExhibitionAdmin /></MemoryRouter>); }
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getGalleryAdminAnalytics).mockResolvedValue(result()); });

describe('exhibition analytics', () => {
  it('shows actual visits and measurement definitions rather than popularity scores', async () => {
    mount(); await screen.findByText('eaMeasurementTitle');
    expect(getGalleryAdminAnalytics).toHaveBeenCalledWith('owner-token', { range: '30d', galleryId: undefined });
    expect(screen.getByText('eaAverageVisit')).toBeInTheDocument();
    expect(screen.queryByText('999')).not.toBeInTheDocument();
    expect(screen.getByText('eaMeasurementDetails')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'eaDailyTrend' })).toBeInTheDocument();
  });
  it('sends both filters to the server and preserves gallery options', async () => {
    mount(); await screen.findByText('eaMeasurementTitle');
    vi.mocked(getGalleryAdminAnalytics).mockResolvedValue(result(2));
    fireEvent.change(screen.getByLabelText('eaGalleryLabel'), { target: { value: 'gallery-a' } });
    await waitFor(() => expect(getGalleryAdminAnalytics).toHaveBeenLastCalledWith('owner-token', { range: '30d', galleryId: 'gallery-a' }));
    await screen.findByText('eaMeasurementTitle');
    fireEvent.change(screen.getByLabelText('eaDateRange'), { target: { value: '7d' } });
    await waitFor(() => expect(getGalleryAdminAnalytics).toHaveBeenLastCalledWith('owner-token', { range: '7d', galleryId: 'gallery-a' }));
    await screen.findByText('eaMeasurementTitle');
    expect(screen.getByRole('option', { name: 'Gallery B' })).toBeInTheDocument();
  });
  it('ignores late responses from old filters', async () => {
    let finishOld!: (value: GalleryAdminAnalytics) => void;
    vi.mocked(getGalleryAdminAnalytics).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue(result(22));
    mount();
    fireEvent.change(screen.getByLabelText('eaDateRange'), { target: { value: '7d' } });
    await screen.findByText('eaMeasurementTitle');
    await act(async () => { finishOld(result(99)); });
    expect(screen.queryByText('99')).not.toBeInTheDocument();
    expect(screen.getAllByText('22').length).toBeGreaterThan(0);
  });
  it('shows a recoverable error instead of false zero activity', async () => {
    vi.mocked(getGalleryAdminAnalytics).mockRejectedValueOnce(new Error('offline'));
    mount(); const alert = await screen.findByRole('alert');
    expect(screen.queryByText('eaNoVisits')).not.toBeInTheDocument();
    fireEvent.click(within(alert).getByRole('button', { name: 'eaRefresh' }));
    await screen.findByText('eaMeasurementTitle');
  });
  it('refetches aggregates after comment deletion', async () => {
    const data = result(); data.comments = [{ id: 'comment', galleryId: 'gallery-a', galleryTitle: 'Gallery A', itemId: 'item', itemTitle: 'Work', userName: 'Visitor', content: 'A comment', createdAt: '2026-09-05T00:00:00Z' }];
    vi.mocked(getGalleryAdminAnalytics).mockResolvedValueOnce(data).mockResolvedValue(result());
    vi.mocked(deleteGalleryComment).mockResolvedValue({ ok: true });
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'eaDelete' }));
    await waitFor(() => expect(getGalleryAdminAnalytics).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('A comment')).not.toBeInTheDocument());
  });
});
