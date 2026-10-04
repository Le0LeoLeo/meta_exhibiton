import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import { FolderShareDialog } from './FolderShareDialog';
import { folderShareRequest } from '@/app/api/galleryFolders';
vi.mock('@/app/api/galleryFolders', () => ({ folderShareRequest: vi.fn() }));
vi.mock('@/app/api/client', () => ({ loadAuth: () => ({ token: 'owner' }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); localStorage.removeItem('metaexpo-locale'); });
beforeEach(() => { localStorage.setItem('metaexpo-locale', 'zh-TW'); vi.clearAllMocks(); vi.mocked(folderShareRequest).mockImplementation(async (_token,_id,method) => ({ token: method === 'POST' ? 'share-token' : null })); });

it('does not grant access on open, explains scope, creates a link and confirms revocation', async () => {
  render(<I18nProvider><MemoryRouter><FolderShareDialog folder={{id:'folder',name:'作品集',parentId:null,createdAt:'now'}} onClose={vi.fn()} /></MemoryRouter></I18nProvider>);
  const create = await screen.findByRole('button',{name:'建立分享連結'});
  expect(screen.getByRole('dialog')).toHaveTextContent('包含未發布展覽');
  expect(folderShareRequest).toHaveBeenCalledTimes(1);
  fireEvent.click(create);
  expect(await screen.findByRole('textbox',{name:'資料夾分享連結'})).toHaveValue(`${window.location.origin}/folders/share/share-token`);
  expect(screen.getByRole('link',{name:'開啟分享頁'})).toHaveAttribute('href','/folders/share/share-token');
  fireEvent.click(screen.getByRole('button',{name:'撤銷分享'}));
  expect(folderShareRequest).not.toHaveBeenCalledWith('owner','folder','DELETE');
  fireEvent.click(screen.getByRole('button',{name:'撤銷分享'}));
  await waitFor(() => expect(folderShareRequest).toHaveBeenCalledWith('owner','folder','DELETE'));
  expect(await screen.findByRole('button',{name:'建立分享連結'})).toBeInTheDocument();
});
