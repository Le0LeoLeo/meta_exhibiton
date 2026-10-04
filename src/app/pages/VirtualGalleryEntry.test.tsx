const translateKey = vi.hoisted(() => (key: string) => key);
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VirtualGallery from './VirtualGallery';
import { getTemplateSceneJson } from '../constants/gallerySceneTemplates';

const { loadAuth, createGallery, getGalleryById, toastError } = vi.hoisted(() => ({
  loadAuth: vi.fn(), createGallery: vi.fn(), getGalleryById: vi.fn(), toastError: vi.fn(),
}));
vi.mock('../api/auth', () => ({ loadAuth }));
vi.mock('../api/gallery', () => ({ createGallery, getGalleryById }));
vi.mock('../hooks/useMobileDevice', () => ({ useMobileDevice: () => false }));
vi.mock('../components/I18nProvider', () => ({ useI18n: () => ({ t: translateKey }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: toastError } }));

function Destination() {
  const location = useLocation();
  return <p data-testid="destination">{location.pathname + location.search}</p>;
}
function renderGallery(search = '') {
  render(<MemoryRouter initialEntries={[`/virtual-gallery${search}`]}>
    <Routes>
      <Route path="/virtual-gallery" element={<VirtualGallery />} />
      <Route path="*" element={<Destination />} />
    </Routes>
  </MemoryRouter>);
}
const id = 'c96a39b9-85d1-4207-a71e-636338c7ba1a';

describe('gallery entry', () => {
  beforeEach(() => {
    class Observer { observe() {} unobserve() {} disconnect() {} }
    vi.stubGlobal('IntersectionObserver', Observer);
    vi.clearAllMocks();
    loadAuth.mockReturnValue({ token: null });
    createGallery.mockResolvedValue({ gallery: { id } });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('takes signed-in visitors to creation instead of asking them to register again', () => {
    loadAuth.mockReturnValue({ token: 'session' });
    renderGallery();
    expect(screen.queryByRole('link', { name: 'registerNow' })).not.toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'quickExhibitionCreateAction' });
    expect(links.length).toBeGreaterThan(1);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/virtual-gallery/quick-create'));
  });

  it('switches templates, wraps navigation and resets the selection when filtering', () => {
    renderGallery();
    expect(screen.getByRole('button', { name: 'vgTemplateModernArtTitle' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'demoPrevious' }));
    expect(screen.getByRole('button', { name: 'vgTemplateCarTitle' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'vgUseTemplate' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'entryPreviewTemplate' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'vgCatCulture' }));
    expect(screen.getByRole('button', { name: 'vgTemplateMuseumTitle' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'demoNext' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'entryPreviewTemplate' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'entryCategoryAll' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'vgTemplateModernArtTitle' }), { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'vgTemplateTechTitle' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows actual template objects and keeps selection when requiring login', () => {
    renderGallery();
    fireEvent.click(screen.getAllByRole('button', { name: 'entryPreviewTemplate' })[0]);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'vgAtmosphereSpotlight' }));
    expect(within(dialog).getByRole('img', { name: 'vgPreviewPlan' })).toBeInTheDocument();
    expect(within(dialog).getAllByText('色域流動').length).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'vgUseTemplate' }));
    const destination = screen.getByTestId('destination').textContent!;
    const returnTo = new URL(destination, 'https://metaexb.com').searchParams.get('returnTo')!;
    expect(new URL(returnTo, 'https://metaexb.com').searchParams.get('template')).toBe('現代藝術畫廊');
    expect(new URL(returnTo, 'https://metaexb.com').searchParams.get('atmosphere')).toBe('spotlight');
    expect(createGallery).not.toHaveBeenCalled();
  });

  it.each(['現代藝術畫廊', '科技展示廳', '歷史博物館', '時尚展示間', '攝影作品展', '汽車展示廳'])('resumes %s and creates the matching scene after login', async (title) => {
    loadAuth.mockReturnValue({ token: 'session' });
    renderGallery(`?template=${encodeURIComponent(title)}`);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'vgUseTemplate' }));
    await waitFor(() => expect(createGallery).toHaveBeenCalled());
    const payload = createGallery.mock.calls[0][1];
    expect(payload.templateTitle).toBe(title);
    expect(JSON.parse(payload.sceneJson).roomSize).toEqual(JSON.parse(getTemplateSceneJson(title)!).roomSize);
    expect(JSON.parse(payload.sceneJson).items.some((item: { content: string }) => item.content === title)).toBe(true);
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent(`/virtual-gallery/create?exhibitionId=${id}`));
  });

  it.each(['bright', 'spotlight', 'warm'] as const)('resumes the %s atmosphere after login and creates it', async (atmosphere) => {
    loadAuth.mockReturnValue({ token: 'session' });
    renderGallery(`?template=${encodeURIComponent('科技展示廳')}&atmosphere=${atmosphere}`);
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('button', { name: atmosphere === 'warm' ? 'vgAtmosphereWarm' : atmosphere === 'bright' ? 'vgAtmosphereBright' : 'vgAtmosphereSpotlight' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(dialog.getByRole('button', { name: 'vgUseTemplate' }));
    await waitFor(() => expect(createGallery).toHaveBeenCalledOnce());
    expect(JSON.parse(createGallery.mock.calls[0][1].sceneJson).roomSize).toEqual(JSON.parse(getTemplateSceneJson('科技展示廳', atmosphere)!).roomSize);
  });

  it('keeps a choice after closing preview and resets it when selecting a different template', () => {
    renderGallery();
    fireEvent.click(screen.getByRole('button', { name: 'entryPreviewTemplate' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'vgAtmosphereWarm' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'entryPreviewTemplate' }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'vgAtmosphereWarm' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'vgTemplateTechTitle' }));
    fireEvent.click(screen.getByRole('button', { name: 'entryPreviewTemplate' }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'vgAtmosphereSpotlight' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([`/exhibitions/${id}`, `/virtual-gallery/share/${id}`])('opens supported visitor route %s without the private-gallery API', (path) => {
    renderGallery();
    fireEvent.click(screen.getByRole('button', { name: 'vgJoinBtn' }));
    fireEvent.change(screen.getByLabelText('entryJoinLabel'), { target: { value: `https://metaexb.com${path}` } });
    fireEvent.click(screen.getByRole('button', { name: 'vgJoinConfirm' }));
    expect(screen.getByTestId('destination')).toHaveTextContent(path);
    expect(getGalleryById).not.toHaveBeenCalled();
  });

  it('rejects an external link without navigation or a request', () => {
    renderGallery();
    fireEvent.click(screen.getByRole('button', { name: 'vgJoinBtn' }));
    fireEvent.change(screen.getByLabelText('entryJoinLabel'), { target: { value: `https://evil.example/exhibitions/${id}` } });
    fireEvent.click(screen.getByRole('button', { name: 'vgJoinConfirm' }));
    expect(toastError).toHaveBeenCalledWith('entryJoinInvalid');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(getGalleryById).not.toHaveBeenCalled();
  });

  it('requires login and preserves room identity for an ID join', () => {
    renderGallery();
    fireEvent.click(screen.getByRole('button', { name: 'vgJoinBtn' }));
    fireEvent.change(screen.getByLabelText('entryJoinLabel'), { target: { value: id } });
    fireEvent.click(screen.getByRole('button', { name: 'vgJoinConfirm' }));
    const url = new URL(screen.getByTestId('destination').textContent!, 'https://metaexb.com');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('returnTo')).toContain(`roomId=gallery%3A${id}`);
    expect(getGalleryById).not.toHaveBeenCalled();
  });

  it('checks authenticated access for a legacy view link and retains view mode', async () => {
    loadAuth.mockReturnValue({ token: 'session' });
    getGalleryById.mockResolvedValue({ gallery: { id } });
    renderGallery();
    fireEvent.click(screen.getByRole('button', { name: 'vgJoinBtn' }));
    fireEvent.change(screen.getByLabelText('entryJoinLabel'), { target: { value: `https://metaexb.com/virtual-gallery/create?exhibitionId=${id}&share=view` } });
    fireEvent.click(screen.getByRole('button', { name: 'vgJoinConfirm' }));
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('&share=view'));
    expect(getGalleryById).toHaveBeenCalledWith('session', id);
  });

  it('keeps denied gallery access in the join dialog with a generic next step', async () => {
    loadAuth.mockReturnValue({ token: 'session' });
    getGalleryById.mockRejectedValue(new Error('Private gallery owner details'));
    renderGallery();
    fireEvent.click(screen.getByRole('button', { name: 'vgJoinBtn' }));
    fireEvent.change(screen.getByLabelText('entryJoinLabel'), { target: { value: id } });
    fireEvent.click(screen.getByRole('button', { name: 'vgJoinConfirm' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('vgJoinFail', { description: 'entryJoinUnavailable' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
  });
});
