const translateKey = vi.hoisted(() => (key: string) => key);
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MyExhibitions from './MyExhibitions';
import { getTemplateSceneJson, type GalleryAtmosphere } from '../constants/gallerySceneTemplates';

const { createGallery } = vi.hoisted(() => ({ createGallery: vi.fn() }));
vi.mock('../api/client', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/client')>(),
  loadAuth: () => ({ token: 'test-session' }), createGallery,
  getMyGalleries: async () => ({ galleries: [] }),
}));
vi.mock('../components/I18nProvider', () => ({ useI18n: () => ({ t: translateKey }) }));
vi.mock('../hooks/useMobileDevice', () => ({ useMobileDevice: () => false }));
vi.mock('../components/ExhibitionShareDialog', () => ({ ExhibitionShareDialog: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); createGallery.mockResolvedValue({ gallery: { id: 'new-template-draft' } }); });

describe('My Exhibitions template catalogue', () => {
  it('selects each template atmosphere by default and lets visitors override it', () => {
    render(<MemoryRouter><MyExhibitions /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'selectTemplate' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: /vgTemplateFashionTitle/ }));
    expect(dialog.getByRole('button', { name: 'vgAtmosphereWarm' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(dialog.getByRole('button', { name: 'vgAtmosphereBright' }));
    expect(dialog.getByRole('button', { name: 'vgAtmosphereBright' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(dialog.getByRole('button', { name: /vgTemplatePhotoTitle/ }));
    expect(dialog.getByRole('button', { name: 'vgAtmosphereSpotlight' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(dialog.getByRole('button', { name: /vgTemplateCarTitle/ }));
    expect(dialog.getByRole('button', { name: 'vgAtmosphereBright' })).toHaveAttribute('aria-pressed', 'true');
  });
  it.each([
    ['時尚展示間', 'vgTemplateFashionTitle', 'bright', 'vgAtmosphereBright'], ['攝影作品展', 'vgTemplatePhotoTitle', 'spotlight', 'vgAtmosphereSpotlight'], ['汽車展示廳', 'vgTemplateCarTitle', 'warm', 'vgAtmosphereWarm'],
  ])('creates the complete %s template from the private dashboard', async (title, label, atmosphere, atmosphereLabel) => {
    render(<MemoryRouter><MyExhibitions /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'selectTemplate' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('button', { pressed: false })).toHaveLength(8);
    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(label) }));
    fireEvent.click(within(dialog).getByRole('button', { name: atmosphereLabel }));
    fireEvent.change(within(dialog).getByLabelText('exhibitionName'), { target: { value: 'My template draft' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'createAndEdit' }));
    await waitFor(() => expect(createGallery).toHaveBeenCalledOnce());
    const payload = createGallery.mock.calls[0][1];
    expect(payload.templateTitle).toBe(title);
    expect(payload.title).toBe('My template draft');
    expect(JSON.parse(payload.sceneJson).roomSize).toEqual(JSON.parse(getTemplateSceneJson(title, atmosphere as GalleryAtmosphere)!).roomSize);
    expect(JSON.parse(payload.sceneJson).items.filter((item: { type: string }) => item.type === 'painting')).toHaveLength(6);
  });
});
