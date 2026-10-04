import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GallerySummary } from '../api/client';
import MyExhibitions from './MyExhibitions';

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  mobile: false,
  getMyGalleries: vi.fn(),
  createGallery: vi.fn(),
  updateGalleryById: vi.fn(),
  deleteGalleryById: vi.fn(),
  publishGalleryById: vi.fn(),
  unpublishGalleryById: vi.fn(),
}));

vi.mock('../api/client', () => ({
  loadAuth: () => ({ token: 'synthetic-session' }),
  getMyGalleries: mocks.getMyGalleries,
  createGallery: mocks.createGallery,
  updateGalleryById: mocks.updateGalleryById,
  deleteGalleryById: mocks.deleteGalleryById,
  publishGalleryById: mocks.publishGalleryById,
  unpublishGalleryById: mocks.unpublishGalleryById,
}));
vi.mock('../components/I18nProvider', () => ({ useI18n: () => ({ t: mocks.t }) }));
vi.mock('../hooks/useMobileDevice', () => ({ useMobileDevice: () => mocks.mobile }));
vi.mock('../components/ExhibitionShareDialog', () => ({ ExhibitionShareDialog: () => null }));
vi.mock('../features/exhibition-folders/ExhibitionFolders', () => ({
  ExhibitionFolders: ({ items, children }: {
    items: GallerySummary[];
    children: (items: GallerySummary[], controls: (item: GallerySummary) => ReactNode) => ReactNode;
  }) => children(items, item => <button type="button" aria-label={`Move ${item.title}`}>Move</button>),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const gallery: GallerySummary = {
  id: 'gallery / one', ownerId: 'synthetic-owner', title: 'Synthetic exhibition',
  description: 'A private synthetic exhibition', templateTitle: '空白展示間',
  templateImage: '/synthetic-cover.png', category: 'art', isPublished: false,
  createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z', revision: 4,
};

async function mount(item: GallerySummary = gallery) {
  mocks.getMyGalleries.mockResolvedValue({ galleries: [item] });
  render(<MemoryRouter><MyExhibitions /></MemoryRouter>);
  await screen.findByText(item.title);
}

async function openMenu(title = gallery.title) {
  const trigger = screen.getByRole('button', { name: `galleryMoreActions: ${title}` });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return screen.findByRole('menu');
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.mobile = false;
  mocks.publishGalleryById.mockResolvedValue({ gallery: { ...gallery, isPublished: true } });
  mocks.deleteGalleryById.mockResolvedValue(undefined);
});

describe('My Exhibitions simplified actions', () => {
  it.each([
    {
      name: 'private quick draft', item: { ...gallery, quickDraftId: 'draft / one' },
      action: 'quickExhibitionResume', href: '/virtual-gallery/quick-create?draftId=draft%20%2F%20one',
    },
    {
      name: 'published quick draft', item: { ...gallery, quickDraftId: 'draft / one', isPublished: true },
      action: 'artworkEditTitle', href: '/virtual-gallery/edit-artworks?exhibitionId=gallery%20%2F%20one',
    },
    {
      name: 'ordinary exhibition', item: gallery,
      action: 'artworkEditTitle', href: '/virtual-gallery/edit-artworks?exhibitionId=gallery%20%2F%20one',
    },
  ])('opens the next useful step for a $name', async ({ item, action, href }) => {
    await mount(item);
    expect(screen.getByRole('link', { name: action })).toHaveAttribute('href', href);
    expect(screen.getByRole('button', { name: 'share' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Move ${item.title}` })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    if (item.isPublished) expect(screen.getByRole('button', { name: 'viewPage' })).toBeInTheDocument();
    else expect(screen.queryByRole('button', { name: 'viewPage' })).not.toBeInTheDocument();
  });

  it('reveals edit information, artwork management, advanced editing and publication in one menu', async () => {
    await mount({ ...gallery, quickDraftId: 'draft / one' });
    const menu = await openMenu();
    expect(within(menu).getByRole('menuitem', { name: 'artworkEditTitle' })).toHaveAttribute('href', '/virtual-gallery/edit-artworks?exhibitionId=gallery%20%2F%20one');
    expect(within(menu).getByRole('menuitem', { name: 'galleryAdvancedEditor' })).toHaveAttribute('href', '/virtual-gallery/create?exhibitionId=gallery%20%2F%20one');
    expect(within(menu).getByRole('menuitem', { name: 'publishEvent' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'delete' })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'editInfo' }));
    expect(await screen.findByDisplayValue(gallery.title)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'exhibitionName' })).toHaveFocus());
    expect(screen.getByDisplayValue(gallery.description)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'saveInfo' })).toBeInTheDocument();
    expect(mocks.updateGalleryById).not.toHaveBeenCalled();
  });

  it('offers withdrawal instead of publishing again for an already public exhibition', async () => {
    await mount({ ...gallery, quickDraftId: 'draft / one', isPublished: true });
    const menu = await openMenu();
    expect(within(menu).getByRole('menuitem', { name: 'unpublish' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'publishEvent' })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'artworkEditTitle' })).not.toBeInTheDocument();
    expect(mocks.unpublishGalleryById).not.toHaveBeenCalled();
  });

  it('returns keyboard focus to the more button when Escape closes the menu', async () => {
    await mount();
    const menu = await openMenu();
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: `galleryMoreActions: ${gallery.title}` })).toHaveFocus());
    expect(mocks.publishGalleryById).not.toHaveBeenCalled();
    expect(mocks.deleteGalleryById).not.toHaveBeenCalled();
  });

  it('requires publication confirmation and does nothing when it is cancelled', async () => {
    await mount();
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'publishEvent' }));
    const dialog = await screen.findByRole('dialog', { name: 'publishExhibition' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(mocks.publishGalleryById).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.publishGalleryById).not.toHaveBeenCalled();
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'publishEvent' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'publishExhibition' })).getByRole('button', { name: 'confirmPublish' }));
    await waitFor(() => expect(mocks.publishGalleryById).toHaveBeenCalledExactlyOnceWith('synthetic-session', gallery.id));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('published', { exact: true })).toBeInTheDocument();
  });

  it('requires deletion confirmation and keeps the exhibition after cancellation', async () => {
    await mount();
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'deleteExhibition' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(mocks.deleteGalleryById).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText(gallery.title)).toBeInTheDocument();
    expect(mocks.deleteGalleryById).not.toHaveBeenCalled();
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'delete' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'deleteExhibition' })).getByRole('button', { name: 'confirmDelete' }));
    await waitFor(() => expect(mocks.deleteGalleryById).toHaveBeenCalledExactlyOnceWith('synthetic-session', gallery.id));
    await waitFor(() => expect(screen.queryByText(gallery.title)).not.toBeInTheDocument());
  });

  it.each([
    ['publishEvent', 'publishExhibition'],
    ['delete', 'deleteExhibition'],
  ])('focuses the %s confirmation when information is already being edited', async (action, title) => {
    await mount();
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'editInfo' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'exhibitionName' })).toHaveFocus());
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: action }));
    const dialog = await screen.findByRole('dialog', { name: title });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(mocks.publishGalleryById).not.toHaveBeenCalled();
    expect(mocks.deleteGalleryById).not.toHaveBeenCalled();
  });

  it('keeps the advanced 3D route in viewing mode on mobile', async () => {
    mocks.mobile = true;
    await mount();
    expect(within(await openMenu()).getByRole('menuitem', { name: 'mobileEditorViewOnly' })).toHaveAttribute('href', '/virtual-gallery/create?exhibitionId=gallery%20%2F%20one&share=view');
    expect(screen.queryByRole('menuitem', { name: 'galleryAdvancedEditor' })).not.toBeInTheDocument();
  });
});
