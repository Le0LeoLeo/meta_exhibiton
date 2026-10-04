import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../components/I18nProvider';
import ExhibitionSouvenir from './ExhibitionSouvenir';

const getSouvenir = vi.fn();
vi.mock('../api/exhibitionPassport', () => ({ getExhibitionSouvenir: (...args: unknown[]) => getSouvenir(...args) }));

function renderPage() {
  return render(<MemoryRouter initialEntries={['/souvenirs/public-token']}><I18nProvider><Routes><Route path="souvenirs/:token" element={<ExhibitionSouvenir />} /></Routes></I18nProvider></MemoryRouter>);
}

describe('ExhibitionSouvenir', () => {
  beforeEach(() => { getSouvenir.mockReset(); localStorage.setItem('metaexpo-locale', 'zh-TW'); });
  afterEach(cleanup);

  it('shows loading and then renders the public snapshot without visitor identity', async () => {
    let resolve!: (value: unknown) => void;
    getSouvenir.mockReturnValue(new Promise((done) => { resolve = done; }));
    renderPage();
    expect(screen.getByLabelText('正在載入紀念卡')).toBeInTheDocument();
    resolve({
      schemaVersion: 1, galleryId: 'gallery-1', galleryTitle: 'Light and Water', galleryOwnerName: 'Museum Team',
      completedAt: '2026-07-22T00:00:00.000Z', visitedCount: 3, engagedCount: 1, totalDwellSeconds: 120,
      favoriteExhibit: { id: 'work-1', title: 'Blue Current', thumbnailUrl: null }, reflection: '<img src=x onerror=alert(1)>',
    });

    expect(await screen.findByRole('heading', { name: 'Light and Water' })).toBeInTheDocument();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('blockquote img')).toBeNull();
    expect(screen.getByRole('link', { name: '參觀原展覽' })).toHaveAttribute('href', '/exhibitions/gallery-1');
    expect(screen.queryByText(/visitor|userId|email/i)).not.toBeInTheDocument();
  });

  it('shows a useful not-found state', async () => {
    getSouvenir.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole('heading', { name: '找不到此紀念卡' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /探索更多展覽/ })).toHaveAttribute('href', '/exhibitions');
  });
});
