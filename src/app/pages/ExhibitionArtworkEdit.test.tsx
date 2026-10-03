import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoScene } from '@/app/features/public-demo/demoScene';
import { GalleryConflictError, getGalleryById, updateGalleryById } from '@/app/api/gallery';
import { bindMediaAssets, uploadMediaAsset } from '@/app/api/media';
import ExhibitionArtworkEdit from './ExhibitionArtworkEdit';
import { UnsavedChangesProvider } from '@/app/components/UnsavedChangesProvider';

vi.mock('@/app/api/auth', () => ({ loadAuth: () => ({ token: 'owner-token', user: { id: 'owner' } }) }));
vi.mock('@/app/components/I18nProvider', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/app/hooks/useMobileDevice', () => ({ useMobileDevice: () => true }));
vi.mock('@/app/api/gallery', async importOriginal => ({ ...await importOriginal<typeof import('@/app/api/gallery')>(), getGalleryById: vi.fn(), updateGalleryById: vi.fn() }));
vi.mock('@/app/api/media', () => ({ uploadMediaAsset: vi.fn(), bindMediaAssets: vi.fn() }));

const baseScene = { ...createDemoScene(key => key), customSetting: { retained: true } };
const originalScene = () => structuredClone(baseScene);
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const originalGallery = () => ({ id: 'existing-gallery', ownerId: 'owner', title: 'Existing show', description: 'Keep description', isPublished: true, revision: 7, sceneJson: JSON.stringify(originalScene()) });
function mount() {
  const router = createMemoryRouter([{
    element: <UnsavedChangesProvider><Link to="/away">Global navigation</Link><Outlet /></UnsavedChangesProvider>,
    children: [
      { path: '/virtual-gallery/edit-artworks', element: <ExhibitionArtworkEdit /> },
      { path: '/away', element: <h1>Away</h1> },
      { path: '/virtual-gallery/my-exhibitions', element: <h1>My exhibitions</h1> },
    ],
  }], { initialEntries: ['/virtual-gallery/edit-artworks?exhibitionId=existing-gallery'] });
  return render(<RouterProvider router={router} />);
}
async function loaded() { await screen.findByDisplayValue('demoArtwork1Title'); }

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGalleryById).mockResolvedValue({ gallery: originalGallery() } as never);
  vi.mocked(updateGalleryById).mockResolvedValue({ gallery: { ...originalGallery(), revision: 8 } } as never);
  vi.mocked(uploadMediaAsset).mockResolvedValue({ id: 'new-media', url: '/api/media/new-media', fileName: 'new.png', originalFileName: 'new.png', mimeType: 'image/png', width: 800, height: 600, size: 100, metadataSanitized: true });
  vi.mocked(bindMediaAssets).mockResolvedValue([{ id: 'new-media', url: '/api/media/new-media' }]);
});

describe('existing exhibition artwork editing', () => {
  it('guards global and local navigation without double prompts, then allows leaving after saving', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    mount(); await loaded();
    fireEvent.change(screen.getAllByLabelText('artworkEditName')[0], { target: { value: 'Keep my title' } });
    fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    expect(screen.getByDisplayValue('Keep my title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'quickExhibitionBack' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'artworkEditSave' }));
    await screen.findByText('artworkEditSaved');
    fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
    expect(await screen.findByRole('heading', { name: 'Away' })).toBeVisible();
    expect(confirm).toHaveBeenCalledTimes(2);
  });
  it('loads the selected existing gallery and saves changes to its revision, retaining room and published metadata', async () => {
    mount(); await loaded();
    expect(getGalleryById).toHaveBeenCalledWith('owner-token', 'existing-gallery');
    expect(screen.getByText('artworkEditPublished')).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText('artworkEditName')[0], { target: { value: 'Updated artwork' } });
    fireEvent.click(screen.getByRole('button', { name: 'artworkEditSave' }));
    await screen.findByText('artworkEditSaved');
    const [token,id,payload] = vi.mocked(updateGalleryById).mock.calls[0];
    expect([token,id,payload.expectedRevision]).toEqual(['owner-token','existing-gallery',7]);
    const saved=JSON.parse(payload.sceneJson!);
    expect(saved).toEqual({ ...originalScene(), items: originalScene().items.map((item,index) => index===0 ? {...item,title:'Updated artwork'} : item) });
    expect(Object.keys(payload).sort()).toEqual(['expectedRevision','sceneJson']);
  });
  it('replaces an image only after binding it to the same gallery, without moving or renaming the artwork', async () => {
    mount(); await loaded();
    fireEvent.change(screen.getAllByLabelText('artworkEditReplace')[0], { target: { files: [new File(['png'],'new.png',{type:'image/png'})] } });
    await waitFor(() => expect(bindMediaAssets).toHaveBeenCalledWith('owner-token','existing-gallery',['new-media']));
    await waitFor(() => expect(screen.getByRole('button',{name:'artworkEditSave'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button',{name:'artworkEditSave'}));
    await screen.findByText('artworkEditSaved');
    const saved=JSON.parse(vi.mocked(updateGalleryById).mock.calls[0][2].sceneJson!);
    expect(saved.items[0]).toMatchObject({id:originalScene().items[0].id,position:originalScene().items[0].position,title:'demoArtwork1Title',content:'/api/media/new-media'});
  });
  it('removes only the selected artwork on explicit save', async () => {
    mount(); await loaded();
    fireEvent.click(screen.getAllByRole('button',{name:'artworkEditRemove'})[1]);
    expect(updateGalleryById).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'artworkEditSave'}));
    await screen.findByText('artworkEditSaved');
    expect(JSON.parse(vi.mocked(updateGalleryById).mock.calls[0][2].sceneJson!).items.map((item:{id:string})=>item.id)).toEqual(originalScene().items.filter((_, index) => index !== 1).map(item => item.id));
  });
  it('adds to the same scene without changing existing artworks', async () => {
    mount(); await loaded();
    fireEvent.change(screen.getByLabelText('artworkEditAdd'),{target:{files:[new File(['png'],'new.png',{type:'image/png'})]}});
    await screen.findByDisplayValue('new');
    fireEvent.click(screen.getByRole('button',{name:'artworkEditSave'}));
    await screen.findByText('artworkEditSaved');
    const saved=JSON.parse(vi.mocked(updateGalleryById).mock.calls[0][2].sceneJson!);
    expect(saved.items.slice(0,originalScene().items.length)).toEqual(originalScene().items);
    expect(saved.items[originalScene().items.length]).toMatchObject({content:'/api/media/new-media',assetId:'new-media'});
  });
  it('keeps the original image if media binding fails', async () => {
    vi.mocked(bindMediaAssets).mockRejectedValue(new Error('Binding denied'));
    mount(); await loaded();
    fireEvent.change(screen.getAllByLabelText('artworkEditReplace')[0],{target:{files:[new File(['png'],'new.png',{type:'image/png'})]}});
    expect(await screen.findByRole('alert')).toHaveTextContent('artworkEditUploadError');
    expect(screen.getByRole('img',{name:'demoArtwork1Title'})).toHaveAttribute('src',originalScene().items[0].content);
    expect(screen.getByRole('button',{name:'artworkEditSave'})).toBeDisabled();
    expect(updateGalleryById).not.toHaveBeenCalled();
  });
  it('keeps local edits when another editor has saved a newer revision', async () => {
    vi.mocked(updateGalleryById).mockRejectedValue(new GalleryConflictError());
    mount(); await loaded();
    fireEvent.change(screen.getAllByLabelText('artworkEditText')[0],{target:{value:'Keep my edit'}});
    fireEvent.click(screen.getByRole('button',{name:'artworkEditSave'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('artworkEditConflict');
    expect(screen.getByDisplayValue('Keep my edit')).toBeInTheDocument();
    expect(getGalleryById).toHaveBeenCalledTimes(1);
  });
  it('does not allow edits to someone else’s gallery', async () => {
    vi.mocked(getGalleryById).mockResolvedValue({gallery:{...originalGallery(),ownerId:'someone-else'}} as never);
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('artworkEditLoadError');
    expect(screen.queryByRole('button',{name:'artworkEditSave'})).not.toBeInTheDocument();
    expect(updateGalleryById).not.toHaveBeenCalled();
  });
});
