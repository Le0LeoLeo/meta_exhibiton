import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import { ExhibitionFolders, folderPath } from './ExhibitionFolders';
import { folderRequest, type GalleryFolderState } from '@/app/api/galleryFolders';
import type { GallerySummary } from '@/app/api/client';

vi.mock('@/app/api/galleryFolders', () => ({ folderRequest: vi.fn() }));
vi.mock('@/app/api/client', () => ({ loadAuth: () => ({ token: 'test' }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const items = [{ id: 'one', title: 'Ocean' }, { id: 'two', title: 'Mountain' }] as GallerySummary[];
let state: GalleryFolderState;
afterEach(() => { cleanup(); localStorage.removeItem('metaexpo-locale'); });
const mount = (route = '/') => render(<I18nProvider><MemoryRouter initialEntries={[route]}><ExhibitionFolders items={items}>{(visible, controls) => <div>{visible.map(item => <section key={item.id} aria-label={item.title}><h3>{item.title}</h3>{controls(item)}</section>)}</div>}</ExhibitionFolders></MemoryRouter></I18nProvider>);
beforeEach(() => {
  localStorage.setItem('metaexpo-locale', 'zh-TW');
  vi.clearAllMocks();
  state = { folders: [{ id: 'parent', name: 'Portfolio', parentId: null, createdAt: 'now' }, { id: 'child', name: 'Photos', parentId: 'parent', createdAt: 'now' }], memberships: [] };
  vi.mocked(folderRequest).mockImplementation(async (_token, path, method, body) => {
    if (method === 'POST' && path === '/move') {
      const input = body as { galleryIds: string[]; folderId: string | null };
      state = { ...state, memberships: input.folderId ? input.galleryIds.map(galleryId => ({ galleryId, folderId: input.folderId! })) : [] };
    }
    if (method === 'POST' && path === '') state = { ...state, folders: [...state.folders, { id: 'new', name: (body as {name: string}).name, parentId: (body as {parentId: string|null}).parentId, createdAt: 'now' }] };
    return structuredClone(state);
  });
});

it('creates a nested folder and shows breadcrumbs, then batch moves selected exhibitions', async () => {
  mount();
  await screen.findByRole('heading', { name: 'Ocean' });
  fireEvent.click(screen.getByRole('checkbox', { name: '選取此層展覽' }));
  fireEvent.click(screen.getByRole('button', { name: '移動到…', exact: true }));
  fireEvent.change(screen.getByLabelText('目的地'), { target: { value: 'parent' } });
  fireEvent.click(screen.getByRole('button', { name: '移到這裡' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Ocean' })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /Portfolio.*個項目/ }));
  await screen.findByRole('heading', { name: 'Ocean' });
  expect(screen.getByRole('navigation', { name: '資料夾路徑' })).toHaveTextContent('Portfolio');
  fireEvent.click(screen.getByRole('button', { name: '新增資料夾' }));
  fireEvent.change(screen.getByLabelText('資料夾名稱'), { target: { value: '旅行' } });
  fireEvent.submit(document.getElementById('folder-name-form')!);
  await waitFor(() => expect(folderRequest).toHaveBeenCalledWith('test', '', 'POST', { name: '旅行', parentId: 'parent' }));
  await screen.findByRole('button', { name: /旅行.*個項目/ });
});

it('supports desktop drop while retaining the accessible move dialog', async () => {
  mount(); await screen.findByRole('heading', { name: 'Ocean' });
  const data: Record<string, string> = {};
  const transfer = { types: ['application/x-metaexb-gallery-ids'], setData: (k: string, v: string) => { data[k] = v; }, getData: (k: string) => data[k] };
  fireEvent.dragStart(screen.getByRole('button', { name: '移動展覽 Ocean' }), { dataTransfer: transfer });
  fireEvent.drop(screen.getByRole('button', { name: /Portfolio.*個項目/ }).parentElement!, { dataTransfer: transfer });
  await waitFor(() => expect(folderRequest).toHaveBeenCalledWith('test', '/move', 'POST', { galleryIds: ['one'], folderId: 'parent' }));
  expect(screen.getByRole('heading', { name: 'Mountain' })).toBeInTheDocument();
});

it('does not present a misleading empty root on loading failure and retries', async () => {
  vi.mocked(folderRequest).mockRejectedValueOnce(new Error('network'));
  mount(); expect(await screen.findByRole('alert')).toHaveTextContent('無法載入資料夾');
  fireEvent.click(within(screen.getByRole('alert')).getByRole('button'));
  expect(await screen.findByRole('heading', { name: 'Ocean' })).toBeInTheDocument();
});

it('resolves nested paths safely and restores the root after a deleted-folder link', async () => {
  expect(folderPath(state.folders, 'child').map(f => f.name)).toEqual(['Portfolio', 'Photos']);
  mount('/?folder=deleted');
  expect(await screen.findByText('此資料夾已不存在，已顯示最上層展覽。')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Ocean' })).toBeInTheDocument();
});

it('opens rename, folder move and safe deletion dialogs from the folder menu', async () => {
  mount();
  const trigger = await screen.findByRole('button', { name: 'Portfolio 的資料夾操作' });
  const openMenu = async () => {
    fireEvent.keyDown(trigger, { key: 'Enter' });
    return screen.findByRole('menu');
  };
  await openMenu();
  fireEvent.click(screen.getByRole('menuitem', { name: '重新命名' }));
  expect(await screen.findByRole('dialog', { name: '重新命名' })).toBeInTheDocument();
  expect(screen.getByLabelText('資料夾名稱')).toHaveValue('Portfolio');
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  await openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: '移動到…' }));
  const moveDialog = await screen.findByRole('dialog', { name: '移動到…' });
  expect(within(moveDialog).getAllByRole('option')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  await openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: '刪除資料夾' }));
  expect(await screen.findByRole('dialog', { name: '刪除資料夾' })).toHaveTextContent('展覽內容與分享連結會保留');
  expect(folderRequest).not.toHaveBeenCalledWith('test', '/parent', 'DELETE', undefined);
  fireEvent.click(screen.getByRole('button', { name: '刪除', exact: true }));
  await waitFor(() => expect(folderRequest).toHaveBeenCalledWith('test', '/parent', 'DELETE', undefined));
});
