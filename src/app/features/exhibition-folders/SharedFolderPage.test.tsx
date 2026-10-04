import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import SharedFolderPage from './SharedFolderPage';
import { sharedFolderRequest } from '@/app/api/galleryFolders';
vi.mock('@/app/api/galleryFolders', () => ({ sharedFolderRequest: vi.fn() }));
vi.mock('./SharedGalleryScene', () => ({ SharedGalleryScene: () => <div>Read-only 3D preview</div> }));
const folders = [{id:'root',name:'Portfolio',parentId:null,createdAt:'now'},{id:'child',name:'Photos',parentId:'root',createdAt:'now'}];
afterEach(() => { cleanup(); localStorage.removeItem('metaexpo-locale'); });
beforeEach(() => {
  localStorage.setItem('metaexpo-locale', 'zh-TW');
  vi.clearAllMocks();
  vi.mocked(sharedFolderRequest).mockImplementation(async (_token,path) => {
    if (path.startsWith('/galleries')) return {id:'gallery',title:'Ocean',description:'A story',sceneJson:JSON.stringify({items:[{id:'image',type:'painting',title:'Sea',content:'/api/media/image'}]})};
    const folder = path.includes('child') ? folders[1] : folders[0];
    return {rootId:'root',folder,folders,galleries:folder.id==='child'?[{id:'gallery',title:'Ocean',description:'A story'}]:[]};
  });
});
const mount = () => render(<I18nProvider><MemoryRouter initialEntries={['/folders/share/token']}><Routes><Route path="/folders/share/:token" element={<SharedFolderPage />} /></Routes></MemoryRouter></I18nProvider>);

it('browses descendants and exhibitions with scoped media and no edit controls', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button',{name:'Photos'}));
  fireEvent.click(await screen.findByRole('button',{name:'觀看展覽: Ocean'}));
  expect(await screen.findByRole('heading',{name:'Ocean',level:1})).toBeInTheDocument();
  expect(screen.getByRole('img',{name:'Sea'})).toHaveAttribute('src','/api/shared-folders/galleries/gallery/media/image?token=token');
  expect(screen.queryByRole('button',{name:'儲存變更'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'3D 預覽'}));
  expect(screen.getByText('Read-only 3D preview')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'返回分享資料夾'}));
  expect(await screen.findByRole('heading',{name:'Photos',level:1})).toBeInTheDocument();
});

it('clears previously loaded folder data when a revoked link is rechecked on focus', async () => {
  mount(); await screen.findByRole('heading',{name:'Portfolio'});
  vi.mocked(sharedFolderRequest).mockRejectedValue(new Error('revoked'));
  fireEvent(window,new Event('focus'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('無法開啟分享內容'));
  expect(screen.queryByRole('button',{name:'Photos'})).not.toBeInTheDocument();
});
