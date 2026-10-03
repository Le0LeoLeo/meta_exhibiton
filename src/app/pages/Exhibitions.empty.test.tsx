import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../components/I18nProvider';
import Exhibitions from './Exhibitions';
const { getPublished } = vi.hoisted(() => ({ getPublished: vi.fn() }));
vi.mock('../api/exhibitions', () => ({ getPublishedGalleries: getPublished }));
vi.mock('../api/auth', () => ({ loadAuth: () => ({ token: null }) }));
function renderPage() { render(<MemoryRouter><I18nProvider><Exhibitions /></I18nProvider></MemoryRouter>); }
describe('public exhibition list states', () => {
  beforeEach(() => { getPublished.mockReset(); localStorage.clear(); localStorage.setItem('metaexpo-locale', 'zh-TW'); });
  afterEach(cleanup);
  it('keeps loaded cards after a next-page failure and retries the same cursor without duplicates', async () => {
    const card = (id: string) => ({ id, title: id, isPublished: true, updatedAt: '2026-09-10' });
    getPublished.mockResolvedValueOnce({ galleries: [card('First')], nextCursor: 'next' })
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValueOnce({ galleries: [card('First'), card('Second')], nextCursor: null });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '載入更多展覽' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed');
    expect(screen.getByRole('heading', { name: 'First' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '重新整理' }));
    expect(await screen.findByRole('heading', { name: 'Second' })).toBeVisible();
    expect(screen.getAllByRole('heading', { name: 'First' })).toHaveLength(1);
    expect(getPublished).toHaveBeenLastCalledWith({ limit: 12, after: 'next' });
    expect(screen.queryByRole('button', { name: '載入更多展覽' })).not.toBeInTheDocument();
  });
  it('offers a labelled official demo only when the list is empty', async () => {
    getPublished.mockResolvedValue({ galleries: [] });
    renderPage();
    expect(await screen.findByRole('link', { name: '立即參觀示範展' })).toHaveAttribute('href', '/demo');
    expect(screen.getByText('官方示範 · 免登入參觀')).toBeInTheDocument();
  });
  it('distinguishes errors from empty results and retries without reloading', async () => {
    getPublished.mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValueOnce({ galleries: [] });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed');
    expect(screen.queryByText('目前沒有進行中的展覽')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新整理' }));
    expect(await screen.findByRole('link', { name: '立即參觀示範展' })).toBeInTheDocument();
    expect(getPublished).toHaveBeenCalledTimes(2);
  });
  it('keeps real published content separate from demo content', async () => {
    getPublished.mockResolvedValue({ galleries: [{ id: 'published-1', title: 'Published class show', isPublished: true, updatedAt: '2026-09-05' }] });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Published class show' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '立即參觀示範展' })).not.toBeInTheDocument();
  });
  it('uses the exhibition cover, preserves entry and falls back if the image fails', async () => {
    getPublished.mockResolvedValue({ galleries: [{ id: 'published-cover', title: 'My artwork show', templateImage: '/my-cover.jpg', isPublished: true, updatedAt: '2026-09-05' }] });
    renderPage();
    const cover = await screen.findByRole('img', { name: 'My artwork show' });
    expect(cover).toHaveAttribute('src', '/my-cover.jpg');
    fireEvent.error(cover);
    expect(screen.getByText('展覽封面待提供')).toBeInTheDocument();
    const entry = screen.getByRole('link', { name: /My artwork show/ });
    expect(entry).toHaveAttribute('href', '/exhibitions/published-cover');
    fireEvent.click(entry);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
