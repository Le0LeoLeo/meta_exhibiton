const translateKey = vi.hoisted(() => (key: string, values?: Record<string, string | number>) => {
        if (!values) return key;
        return key.replace(/\{(\w+)\}/g, (_match: string, token: string) => {
          const value = values[token];
          return value === undefined || value === null ? _match : String(value);
        });
      });
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { useMultiplayerStore } from "../modules/metaverse3d/network/multiplayerStore";
import { useStore } from "../features/metaverse-studio";
import VirtualGalleryCreate, { doesRoomErrorBlockPersistence } from "./VirtualGalleryCreate";
import { clearAuth, saveAuth } from "../api/auth";
import { GalleryConflictError } from "../api/gallery";
import { getTemplateSceneJson } from '../constants/gallerySceneTemplates';
import { clearReconnectDraft, useReconnectDraftStore } from '../modules/metaverse3d/network/reconnectDraftStore';
import { webcrypto } from 'node:crypto';
import { editorDraftScope, readEditorTabDraft, resetEditorTabDraftState, writeEditorTabDraft } from '../utils/editorTabDraft';
import { I18nProvider, useI18n } from '../components/I18nProvider';
import { createExhibitionWizardDraft } from '../features/exhibition-wizard/wizardStore';
import type { SceneSnapshot } from '../modules/metaverse3d/network/protocol';

const i18nMode = vi.hoisted(() => ({ real: false }));

vi.mock("../components/I18nProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../components/I18nProvider")>();
  return {
    ...actual,
    useI18n: () => {
      const real = actual.useI18n();
      return i18nMode.real ? real : {
        locale: 'zh-TW' as const,
        setLocale: () => {},
        toggleLocale: () => {},
        t: translateKey,
      };
    },
  };
});

const api = vi.hoisted(() => ({
  createGallery: vi.fn(),
  getGalleryById: vi.fn(),
  updateGalleryById: vi.fn(),
  publishGalleryById: vi.fn(),
  requestExhibitionScene: vi.fn(),
  bindMediaAssets: vi.fn(),
  getSharedGallery: vi.fn(),
  updateSharedGallery: vi.fn(),
}));

const network = vi.hoisted(() => ({
  emitSceneSync: vi.fn(),
}));

vi.mock("../modules/metaverse3d/network/socketClient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../modules/metaverse3d/network/socketClient")>();
  return { ...actual, emitSceneSync: network.emitSceneSync };
});

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    createGallery: api.createGallery,
    getGalleryById: api.getGalleryById,
    updateGalleryById: api.updateGalleryById,
    publishGalleryById: api.publishGalleryById,
    requestExhibitionScene: api.requestExhibitionScene,
    getSharedGallery: api.getSharedGallery,
    updateSharedGallery: api.updateSharedGallery,
  };
});

vi.mock('../api/media', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/media')>();
  return { ...actual, bindMediaAssets: api.bindMediaAssets };
});

vi.mock("../features/metaverse-studio", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../features/metaverse-studio")>();
  return {
    ...actual,
    default: ({ sessionStatus, collaborationEnabled, reviewOnly, initialCollaborationScene }: { sessionStatus?: React.ReactNode; collaborationEnabled?: boolean; reviewOnly?: boolean; initialCollaborationScene?: SceneSnapshot }) => (
      <div data-testid="studio" data-collaboration={collaborationEnabled} data-review-only={reviewOnly} data-baseline-items={initialCollaborationScene?.items.length}>{sessionStatus}<div>Studio loaded</div></div>
    ),
  };
});

const initialMultiplayerState = useMultiplayerStore.getState();
const initialStudioState = useStore.getState();

describe("VirtualGalleryCreate multiplayer share flow", () => {
  beforeEach(() => {
    i18nMode.real = false;
    vi.stubGlobal('crypto', webcrypto);
    resetEditorTabDraftState();
    clearReconnectDraft();
    api.createGallery.mockReset();
    api.getGalleryById.mockReset();
    api.updateGalleryById.mockReset();
    api.publishGalleryById.mockReset();
    api.requestExhibitionScene.mockReset();
    api.bindMediaAssets.mockReset();
    api.getSharedGallery.mockReset();
    api.updateSharedGallery.mockReset();
    network.emitSceneSync.mockReset();
    useMultiplayerStore.setState(initialMultiplayerState, true);
    useStore.setState(initialStudioState, true);
    localStorage.clear();
    sessionStorage.clear();
  });

  function sharedGallery(id: string) {
    return {
      gallery: {
        id,
        ownerId: "owner-1",
        title: `Shared ${id}`,
        description: "",
        templateTitle: "",
        templateImage: "",
        category: "art",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        revision: 0,
        sceneJson: JSON.stringify({ items: [] }),
      },
      access: { viaShare: true as const, role: "editor" as const },
    };
  }

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
      resolve = resolvePromise;
    });
    return { promise, resolve };
  }

  afterEach(() => {
    cleanup();
    clearReconnectDraft();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearAuth();
    useMultiplayerStore.setState(initialMultiplayerState, true);
    useStore.setState(initialStudioState, true);
  });

  function WizardLocaleControls() {
    const { setLocale } = useI18n();
    return <>{(['en', 'zh-TW', 'zh-CN'] as const).map((locale) => <button key={locale} onClick={() => setLocale(locale)}>{locale}</button>)}</>;
  }

  it('keeps a new exhibition in the wizard until the user enters the editor, then resumes autosaving', async () => {
    i18nMode.real = true;
    localStorage.setItem('metaexpo-locale', 'en');
    saveAuth({ token: 'jwt-owner', user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' } });
    const created = sharedGallery('new-gallery');
    api.createGallery.mockImplementation(async (_token, payload) => {
      created.gallery.sceneJson = payload.sceneJson;
      return created;
    });
    api.getGalleryById.mockResolvedValue(created);
    api.updateGalleryById.mockResolvedValue(created);
    const router = createMemoryRouter([{ path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> }], {
      initialEntries: ['/virtual-gallery/create'],
    });
    await import('../features/exhibition-wizard/ExhibitionWizard');
    render(<I18nProvider><RouterProvider router={router} /></I18nProvider>);
    expect(await screen.findByRole('heading', { name: 'Set the exhibition theme' })).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText('Exhibition theme'), { target: { value: 'Student projects' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.getByRole('heading', { name: 'Set the exhibition theme' })).toBeInTheDocument();
    expect(screen.getByLabelText('Exhibition theme')).toHaveValue('Student projects');
    expect(api.createGallery).not.toHaveBeenCalled();
    expect(api.updateGalleryById).not.toHaveBeenCalled();
    expect(router.state.location.search).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Switch to the advanced editor' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(api.createGallery).toHaveBeenCalledExactlyOnceWith('jwt-owner', expect.objectContaining({ sceneJson: expect.any(String) }));
    expect(router.state.location.search).toBe('?exhibitionId=new-gallery');
    expect(screen.queryByRole('heading', { name: 'Set the exhibition theme' })).not.toBeInTheDocument();
    router.dispose();
  });

  it('preserves the wizard through gallery creation, AI layout, preview, reopening and publishing', async () => {
    i18nMode.real = true;
    localStorage.setItem('metaexpo-locale', 'en');
    saveAuth({ token: 'jwt-owner', user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' } });
    sessionStorage.setItem('exhibition-wizard-draft-v1', JSON.stringify({
      ...createExhibitionWizardDraft(), currentStep: 'layout', furthestStep: 'layout', theme: 'Student projects', style: 'white-box',
      assets: [{ id: 'asset-1', fileName: 'art.png', status: 'succeeded', url: '/api/media/asset-1/file', previewUrl: '/api/media/asset-1/old-preview' }],
    }));
    const pendingCreate = deferred<ReturnType<typeof sharedGallery>>();
    const pendingLayout = deferred<{ scene: ReturnType<typeof initialStudioState.exportScene> }>();
    api.createGallery.mockReturnValue(pendingCreate.promise);
    api.requestExhibitionScene.mockReturnValue(pendingLayout.promise);
    api.bindMediaAssets.mockResolvedValue([{ id: 'asset-1', url: '/api/media/asset-1/file', previewUrl: '/api/media/asset-1/preview' }]);
    api.publishGalleryById.mockResolvedValue({ ok: true });
    const created = sharedGallery('wizard-gallery');
    api.updateGalleryById.mockImplementation(async (_token, _id, payload) => ({
      ...created, gallery: { ...created.gallery, sceneJson: payload.sceneJson, revision: payload.expectedRevision + 1 },
    }));
    const router = createMemoryRouter([
      { path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> },
      { path: '/exhibitions/:id', element: <h1>Published exhibition</h1> },
    ], { initialEntries: ['/virtual-gallery/create'] });
    await import('../features/exhibition-wizard/ExhibitionWizard');
    render(<I18nProvider><RouterProvider router={router} /></I18nProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start AI layout' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Start AI layout' }));
    expect(screen.getByRole('heading', { name: 'Arrange the exhibition with AI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arranging with AI…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Switch to the advanced editor' })).toBeDisabled();
    expect(api.requestExhibitionScene).not.toHaveBeenCalled();
    created.gallery.sceneJson = JSON.stringify(useStore.getState().exportScene());
    await act(async () => { pendingCreate.resolve(created); await pendingCreate.promise; });
    await waitFor(() => expect(api.requestExhibitionScene).toHaveBeenCalledOnce());
    expect(router.state.location.search).toBe('?exhibitionId=wizard-gallery');
    expect(screen.getByRole('heading', { name: 'Arrange the exhibition with AI' })).toBeInTheDocument();
    expect(api.getGalleryById).not.toHaveBeenCalled();
    expect(screen.getByTestId('studio')).toHaveAttribute('data-baseline-items', '0');
    expect(JSON.parse(sessionStorage.getItem('exhibition-wizard-draft-v1')!)).toMatchObject({
      galleryId: 'wizard-gallery', layoutStatus: 'running',
      assets: [expect.objectContaining({ id: 'asset-1', previewUrl: '/api/media/asset-1/preview' })],
    });

    const arrangedScene = useStore.getState().exportScene();
    arrangedScene.items = [{
      id: 'wizard-artwork', type: 'painting', content: '/api/media/asset-1/preview',
      position: [0, 2, -4], rotation: [0, 0, 0], scale: [1, 1, 1],
    }];
    await act(async () => { pendingLayout.resolve({ scene: arrangedScene }); await pendingLayout.promise; });
    await screen.findByRole('button', { name: 'Run AI layout again' });
    expect(JSON.parse(sessionStorage.getItem('exhibition-wizard-draft-v1')!)).toMatchObject({
      galleryId: 'wizard-gallery', layoutStatus: 'complete',
      assets: [expect.objectContaining({ id: 'asset-1', previewUrl: '/api/media/asset-1/preview' })],
    });
    expect(useStore.getState().items).toEqual(arrangedScene.items);
    expect(screen.getByTestId('studio')).toHaveAttribute('data-baseline-items', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Open 3D preview' }));
    expect(screen.queryByRole('heading', { name: 'Preview the exhibition' })).not.toBeInTheDocument();
    expect(useStore.getState().mode).toBe('view');
    fireEvent.click(screen.getByRole('button', { name: 'Return to exhibition wizard' }));
    expect(useStore.getState().mode).toBe('edit');
    expect(await screen.findByRole('heading', { name: 'Preview the exhibition' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish exhibition', exact: true }));
    expect(await screen.findByRole('heading', { name: 'Published exhibition' })).toBeInTheDocument();
    expect(api.createGallery).toHaveBeenCalledOnce();
    expect(api.publishGalleryById).toHaveBeenCalledExactlyOnceWith('jwt-owner', 'wizard-gallery');
    const savedScene = JSON.parse(api.updateGalleryById.mock.lastCall![2].sceneJson);
    expect(savedScene.items).toEqual([expect.objectContaining({ id: 'wizard-artwork', content: '/api/media/asset-1/file' })]);
    expect(sessionStorage.getItem('exhibition-wizard-draft-v1')).toBeNull();
    router.dispose();
  });

  it.each([
    { style: '明亮、現代、適合校園作品', prompt: 'Student projects\n\nExhibition style: 明亮、現代、適合校園作品', preset: 'white-box' },
    { style: 'warm-museum', prompt: 'Student projects', preset: 'warm-museum' },
  ])('uses the requested style from a restored draft: $style', async ({ style, prompt, preset }) => {
    i18nMode.real = true;
    localStorage.setItem('metaexpo-locale', 'en');
    saveAuth({ token: 'jwt-owner', user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' } });
    sessionStorage.setItem('exhibition-wizard-draft-v1', JSON.stringify({
      ...createExhibitionWizardDraft(), galleryId: 'wizard-gallery', currentStep: 'layout', furthestStep: 'layout',
      theme: 'Student projects', style,
    }));
    api.getGalleryById.mockResolvedValue(sharedGallery('wizard-gallery'));
    api.requestExhibitionScene.mockImplementation(async (_token, input) => ({
      scene: input.currentScene, source: 'qwen', warnings: ['Check the entrance clearance.'],
    }));
    const router = createMemoryRouter([{ path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> }], {
      initialEntries: ['/virtual-gallery/create?exhibitionId=wizard-gallery'],
    });
    render(<I18nProvider><RouterProvider router={router} /></I18nProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start AI layout' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Start AI layout' }));
    await screen.findByRole('button', { name: 'Run AI layout again' });
    expect(api.requestExhibitionScene).toHaveBeenCalledWith('jwt-owner', expect.objectContaining({ prompt, style: preset, language: 'en' }));
    expect(screen.getByText('Check the entrance clearance.')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('exhibition-wizard-draft-v1')!)).toMatchObject({ style, layoutSource: 'qwen' });
    router.dispose();
  });

  it('explains an unchanged fallback and requires explicit acceptance before continuing', async () => {
    i18nMode.real = true;
    localStorage.setItem('metaexpo-locale', 'en');
    saveAuth({ token: 'jwt-owner', user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' } });
    sessionStorage.setItem('exhibition-wizard-draft-v1', JSON.stringify({
      ...createExhibitionWizardDraft(), galleryId: 'wizard-gallery', currentStep: 'layout', furthestStep: 'layout',
      theme: 'Student projects', style: 'Bright',
    }));
    api.getGalleryById.mockResolvedValue(sharedGallery('wizard-gallery'));
    api.requestExhibitionScene.mockImplementation(async (_token, input) => ({
      scene: input.currentScene, source: 'fallback', warnings: ['The existing scene was kept.'],
    }));
    const router = createMemoryRouter([{ path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> }], {
      initialEntries: ['/virtual-gallery/create?exhibitionId=wizard-gallery'],
    });
    render(<I18nProvider><RouterProvider router={router} /></I18nProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start AI layout' })).toBeEnabled());
    const before = useStore.getState().exportScene();
    fireEvent.click(screen.getByRole('button', { name: 'Start AI layout' }));
    await screen.findByRole('button', { name: 'Use the current scene' });
    expect(screen.getByText(/AI layout was unavailable/)).toBeInTheDocument();
    expect(screen.getByText('The existing scene was kept.')).toBeInTheDocument();
    expect(useStore.getState().exportScene()).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('Complete the AI layout first.');
    expect(screen.getByRole('heading', { name: 'Arrange the exhibition with AI' })).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('exhibition-wizard-draft-v1')!)).toMatchObject({
      layoutStatus: 'failed', layoutSource: 'fallback', layoutWarnings: ['The existing scene was kept.'], aiJobId: null,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use the current scene' }));
    expect(screen.getByText(/You chose to continue with the current scene/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
    expect(screen.getByRole('heading', { name: 'Preview the exhibition' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
    api.requestExhibitionScene.mockImplementation(async (_token, input) => ({ scene: input.currentScene, source: 'qwen', warnings: [] }));
    fireEvent.click(screen.getByRole('button', { name: 'Run AI layout again' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run AI layout again' })).toBeEnabled());
    expect(screen.queryByText('The existing scene was kept.')).not.toBeInTheDocument();
    expect(screen.queryByText(/You chose to continue/)).not.toBeInTheDocument();
    router.dispose();
  });

  it('opens advanced creation directly and preserves that mode when its gallery is created', async () => {
    i18nMode.real = true;
    localStorage.setItem('metaexpo-locale', 'en');
    saveAuth({ token: 'jwt-owner', user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' } });
    const created = sharedGallery('advanced-gallery');
    api.createGallery.mockImplementation(async (_token, payload) => {
      created.gallery.sceneJson = payload.sceneJson;
      return created;
    });
    api.getGalleryById.mockResolvedValue(created);
    api.updateGalleryById.mockResolvedValue(created);
    const router = createMemoryRouter([{ path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> }], {
      initialEntries: ['/virtual-gallery/create?mode=advanced'],
    });
    render(<I18nProvider><RouterProvider router={router} /></I18nProvider>);
    await screen.findByText('Studio loaded');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useStore.getState().mode).toBe('edit');
    await waitFor(() => expect(router.state.location.search).toBe('?exhibitionId=advanced-gallery&mode=advanced'));
    expect(api.createGallery).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    router.dispose();
  });

  it('keeps keyboard focus in the wizard and restores an explicit editor return control on exit', async () => {
    i18nMode.real = true;
    localStorage.setItem('metaexpo-locale', 'en');
    saveAuth({ token: 'jwt-owner', user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' } });
    api.getGalleryById.mockResolvedValue(sharedGallery('wizard-gallery'));
    sessionStorage.setItem('exhibition-wizard-draft-v1', JSON.stringify({ ...createExhibitionWizardDraft(), galleryId: 'wizard-gallery' }));
    const router = createMemoryRouter([{ path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> }], {
      initialEntries: ['/virtual-gallery/create?exhibitionId=wizard-gallery'],
    });
    render(<I18nProvider><button>Background control</button><RouterProvider router={router} /></I18nProvider>);
    const dialog = await screen.findByRole('dialog', { name: 'Create a 3D exhibition' });
    await screen.findByText('Studio loaded');
    const theme = await within(dialog).findByLabelText('Exhibition theme');
    act(() => { theme.focus(); });
    expect(theme).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Background control' })).not.toBeInTheDocument();
    const background = screen.getByText('Background control');
    act(() => { background.focus(); });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exhibition wizard' })).toHaveFocus());
    router.dispose();
  });

  it('keeps a restored wizard mounted but disables its actions until the saved scene loads', async () => {
    i18nMode.real = true;
    localStorage.setItem('metaexpo-locale', 'en');
    saveAuth({ token: 'jwt-owner', user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' } });
    sessionStorage.setItem('exhibition-wizard-draft-v1', JSON.stringify({
      ...createExhibitionWizardDraft(), galleryId: 'wizard-gallery', currentStep: 'layout', furthestStep: 'layout',
    }));
    const pendingGallery = deferred<ReturnType<typeof sharedGallery>>();
    api.getGalleryById.mockReturnValue(pendingGallery.promise);
    const router = createMemoryRouter([{ path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> }], {
      initialEntries: ['/virtual-gallery/create?exhibitionId=wizard-gallery'],
    });
    render(<I18nProvider><RouterProvider router={router} /></I18nProvider>);
    const layout = await screen.findByRole('button', { name: 'Start AI layout' });
    expect(screen.getByRole('heading', { name: 'Arrange the exhibition with AI' })).toBeInTheDocument();
    expect(layout).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Switch to the advanced editor' })).toBeDisabled();
    act(() => { layout.click(); });
    expect(api.createGallery).not.toHaveBeenCalled();
    expect(api.requestExhibitionScene).not.toHaveBeenCalled();
    await act(async () => { pendingGallery.resolve(sharedGallery('wizard-gallery')); await pendingGallery.promise; });
    await waitFor(() => expect(layout).toBeEnabled());
    expect(api.createGallery).not.toHaveBeenCalled();
    router.dispose();
  });

  it.each(['/virtual-gallery/create?exhibitionId=other-gallery', '/virtual-gallery/share/editor-token'])(
    'does not offer an unrelated saved wizard at %s', async (path) => {
      saveAuth({ token: 'jwt-owner', user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' } });
      sessionStorage.setItem('exhibition-wizard-draft-v1', JSON.stringify({
        ...createExhibitionWizardDraft(), galleryId: 'wizard-gallery', currentStep: 'preview', furthestStep: 'preview',
      }));
      api.getGalleryById.mockResolvedValue(sharedGallery('other-gallery'));
      api.getSharedGallery.mockResolvedValue(sharedGallery('other-gallery'));
      const router = createMemoryRouter([
        { path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> },
        { path: '/virtual-gallery/share/:token', element: <VirtualGalleryCreate /> },
      ], { initialEntries: [path] });
      render(<RouterProvider router={router} />);
      await screen.findByText('Studio loaded');
      expect(document.querySelector('[data-slot="exhibition-wizard"]')).toBeNull();
      expect(screen.queryByRole('button', { name: 'wizard.openWizard' })).not.toBeInTheDocument();
      router.dispose();
    },
  );

  it.each([
    { locale: 'en', heading: 'Arrange the exhibition with AI', action: 'Start AI layout', editor: 'Switch to the advanced editor', help: 'AI uses the theme, style and uploaded artwork' },
    { locale: 'zh-TW', heading: 'AI 自動排展', action: '開始 AI 排展', editor: '切換至專業編輯器', help: 'AI 會根據主題、風格及已上傳作品' },
    { locale: 'zh-CN', heading: 'AI 自动排展', action: '开始 AI 排展', editor: '切换至专业编辑器', help: 'AI 会根据主题、风格及已上传作品' },
  ])('uses the real $locale catalog for the wizard layout slot', async (copy) => {
    i18nMode.real = true;
    localStorage.setItem('metaexpo-locale', copy.locale);
    sessionStorage.setItem('exhibition-wizard-draft-v1', JSON.stringify({
      ...createExhibitionWizardDraft(), currentStep: 'layout', furthestStep: 'layout', theme: 'Student projects', style: 'Bright',
    }));
    const router = createMemoryRouter([{ path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> }], { initialEntries: ['/virtual-gallery/create'] });
    render(<I18nProvider><RouterProvider router={router} /></I18nProvider>);
    expect(await screen.findByRole('heading', { name: copy.heading })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.action })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.editor })).toBeInTheDocument();
    expect(screen.getByText((text) => text.startsWith(copy.help))).toBeInTheDocument();
  });

  it('updates preview, budget suggestions and publishing copy when the locale changes', async () => {
    i18nMode.real = true;
    localStorage.setItem('metaexpo-locale', 'en');
    sessionStorage.setItem('exhibition-wizard-draft-v1', JSON.stringify({
      ...createExhibitionWizardDraft(), currentStep: 'preview', furthestStep: 'publish', theme: 'Keep my theme',
      style: 'Bright', layoutStatus: 'complete', previewReady: true,
    }));
    const router = createMemoryRouter([{ path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> }], { initialEntries: ['/virtual-gallery/create'] });
    render(<I18nProvider><WizardLocaleControls /><RouterProvider router={router} /></I18nProvider>);
    expect(await screen.findByRole('button', { name: 'Open 3D preview' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Scene performance budget' })).toBeInTheDocument();
    act(() => {
      const item = { id: 'text-0', type: 'text' as const, position: [0, 1, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number], content: 'Artwork' };
      useStore.setState({ items: Array.from({ length: 80 }, (_, index) => ({ ...item, id: `text-${index}` })) });
    });
    // These controls belong to the test provider outside the modal, simulating a locale update.
    fireEvent.click(screen.getByText('zh-CN', { selector: 'button' }));
    expect(screen.getByRole('button', { name: '打开 3D 预览' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '场景性能预算' })).toHaveTextContent('场景负载偏高');
    expect(screen.getByText('把展品及装饰减至 79 件以下，重复装饰可合并或移除。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByRole('button', { name: '发布展览' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('zh-TW', { selector: 'button' }));
    expect(screen.getByRole('button', { name: '發布展覽' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('en', { selector: 'button' }));
    expect(screen.getByRole('button', { name: 'Publish exhibition' })).toBeInTheDocument();
    expect(screen.getByText('Reduce exhibits and decorations to 79 or fewer; combine or remove repeated decorations.')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('exhibition-wizard-draft-v1')!)).toMatchObject({ theme: 'Keep my theme', currentStep: 'publish' });
  });

  it.each(['/virtual-gallery/create', '/virtual-gallery/create?exhibitionId=gallery-1'])('blocks mobile editing at %s before loading or saving a scene', async (path) => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const before = useStore.getState().items;
    const router = createMemoryRouter([{ path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> }], { initialEntries: [path] });
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('heading', { name: 'mobileEditorDesktopRequired' })).toBeInTheDocument();
    expect(screen.queryByText('Studio loaded')).not.toBeInTheDocument();
    expect(api.getGalleryById).not.toHaveBeenCalled();
    expect(api.getSharedGallery).not.toHaveBeenCalled();
    expect(api.updateSharedGallery).not.toHaveBeenCalled();
    expect(useStore.getState().items).toBe(before);
    if (path.includes('exhibitionId')) {
      expect(screen.getByRole('link', { name: 'mobileEditorViewOnly' })).toHaveAttribute('href', '/virtual-gallery/create?exhibitionId=gallery-1&share=view');
    }
  });

  it('opens a mobile editor share as view-only and never autosaves it', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    api.getSharedGallery.mockResolvedValue(sharedGallery('mobile-gallery'));
    const router = createMemoryRouter([{ path: '/virtual-gallery/share/:token', element: <VirtualGalleryCreate /> }], { initialEntries: ['/virtual-gallery/share/editor-token'] });
    await import('../features/metaverse-studio');
    vi.useFakeTimers();
    await act(async () => { render(<RouterProvider router={router} />); });
    expect(useStore.getState().mode).toBe('view');
    expect(screen.getByRole('button', { name: 'vgcBtnViewOnly' })).toBeDisabled();
    act(() => useStore.getState().setRoomSize({ width: useStore.getState().roomSize.width + 1 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(api.updateSharedGallery).not.toHaveBeenCalled();
  });

  it("loads the existing gallery share route and configures its multiplayer token", async () => {
    api.getSharedGallery.mockResolvedValue(sharedGallery("gallery-1"));
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/share/:token",
        element: <VirtualGalleryCreate />,
      }],
      { initialEntries: ["/virtual-gallery/share/editor-token"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(api.getSharedGallery).toHaveBeenCalledWith("editor-token");
      expect(useMultiplayerStore.getState().shareToken).toBe("editor-token");
      expect(useMultiplayerStore.getState().roomId).toBe("gallery-1");
      expect(useMultiplayerStore.getState().enabled).toBe(true);
    });
  });

  it('keeps a shared scene out of the editor until its saved content has loaded', async () => {
    const pending = deferred<ReturnType<typeof sharedGallery>>();
    api.getSharedGallery.mockReturnValue(pending.promise);
    const router = createMemoryRouter([{ path: '/virtual-gallery/share/:token', element: <VirtualGalleryCreate /> }], {
      initialEntries: ['/virtual-gallery/share/editor-token'],
    });
    await import('../features/metaverse-studio');
    vi.useFakeTimers();
    await act(async () => { render(<RouterProvider router={router} />); });

    expect(screen.getByText('vgcLoadingEditor')).toBeInTheDocument();
    expect(screen.queryByText('Studio loaded')).not.toBeInTheDocument();
    act(() => useStore.getState().addItem('text', { position: [1, 1, 1] }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(api.updateSharedGallery).not.toHaveBeenCalled();

    vi.useRealTimers();
    await act(async () => { pending.resolve(sharedGallery('gallery-1')); await pending.promise; });
    expect(await screen.findByText('Studio loaded')).toBeInTheDocument();
  });

  it('does not expose or autosave a shared editor when the saved scene is invalid', async () => {
    const invalidScene = sharedGallery('broken-gallery');
    invalidScene.gallery.sceneJson = '{ invalid scene json';
    api.getSharedGallery.mockResolvedValue(invalidScene);
    const router = createMemoryRouter([{ path: '/virtual-gallery/share/:token', element: <VirtualGalleryCreate /> }], {
      initialEntries: ['/virtual-gallery/share/editor-token'],
    });
    await import('../features/metaverse-studio');
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('button', { name: 'vgcLoadRefresh' })).toBeInTheDocument();

    expect(screen.queryByText('Studio loaded')).not.toBeInTheDocument();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    expect(api.updateSharedGallery).not.toHaveBeenCalled();
  });

  it.each(['', '&share=view'])('keeps teacher review access read-only even when the view query is %s', async (query) => {
    saveAuth({ token: 'jwt-teacher', user: { id: 'teacher-1', email: 'teacher@example.com', name: 'Teacher' } });
    const result = sharedGallery('student-gallery');
    api.getGalleryById.mockResolvedValue({ gallery: { ...result.gallery, reviewAccess: true } });
    sessionStorage.setItem('exhibition-wizard-draft-v1', JSON.stringify({
      ...createExhibitionWizardDraft(), galleryId: 'student-gallery', currentStep: 'publish', furthestStep: 'publish',
    }));
    const router = createMemoryRouter([{ path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> }], {
      initialEntries: [`/virtual-gallery/create?exhibitionId=student-gallery${query}`],
    });
    render(<RouterProvider router={router} />);
    await screen.findByText('Studio loaded');
    expect(useStore.getState().mode).toBe('view');
    expect(useMultiplayerStore.getState().enabled).toBe(false);
    expect(screen.getByTestId('studio')).toHaveAttribute('data-collaboration', 'false');
    expect(screen.getByTestId('studio')).toHaveAttribute('data-review-only', 'true');
    expect(useStore.getState().agent).toMatchObject({ participationMode: 'solo', enabled: false, isChatOpen: false });
    expect(screen.getByRole('button', { name: 'vgcBtnViewOnly' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'backToEditor' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'wizard.openWizard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    vi.useFakeTimers();
    act(() => { useStore.setState({ wallColor: '#eeeeee' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(api.updateGalleryById).not.toHaveBeenCalled();
    expect(api.createGallery).not.toHaveBeenCalled();
    expect(api.publishGalleryById).not.toHaveBeenCalled();
    router.dispose();
  });

  it.each([401, 403, 404])('clears revoked teacher review and stops polling after status %i, while preserving transient failures', async (status) => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    i18nMode.real = true;
    localStorage.setItem('metaexpo-locale', 'en');
    saveAuth({ token: 'jwt-teacher', user: { id: 'teacher-1', email: 'teacher@example.com', name: 'Teacher' } });
    const result = sharedGallery('student-gallery');
    result.gallery.sceneJson = JSON.stringify({ items: [{ id: 'student-work', type: 'painting', content: '/api/media/student-art', position: [0, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }] });
    api.getGalleryById.mockResolvedValue({ gallery: { ...result.gallery, reviewAccess: true } });
    const router = createMemoryRouter([
      { path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> },
      { path: '/graduation/classes/:id', element: <h1>Teacher class</h1> },
    ], { initialEntries: ['/virtual-gallery/create?exhibitionId=student-gallery&share=view&returnTo=%2Fgraduation%2Fclasses%2Fabc-123'] });
    render(<I18nProvider><RouterProvider router={router} /></I18nProvider>);
    await screen.findByText('Studio loaded');
    await act(async () => {});
    api.getGalleryById.mockRejectedValue(Object.assign(new Error('Temporarily unavailable'), { status: 503 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.getByText('Studio loaded')).toBeInTheDocument();
    expect(useStore.getState().items).toEqual([expect.objectContaining({ id: 'student-work' })]);
    api.getGalleryById.mockRejectedValue(Object.assign(new Error('Access revoked'), { status }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.queryByText('Studio loaded')).not.toBeInTheDocument();
    expect(screen.getByText('This exhibition is no longer available for review. Return to the class to check its current status.')).toBeInTheDocument();
    expect(useStore.getState().items).toEqual([]);
    const calls = api.getGalleryById.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(api.getGalleryById).toHaveBeenCalledTimes(calls);
    fireEvent.click(screen.getByRole('button', { name: 'Return to class' }));
    expect(router.state.location.pathname).toBe('/graduation/classes/abc-123');
    router.dispose();
  });

  it('opens a template in edit mode after a visit and returns from preview without losing changes', async () => {
    saveAuth({ token: 'jwt-owner', user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' } });
    const result = sharedGallery('template-gallery');
    result.gallery.templateTitle = '科技展示廳';
    result.gallery.sceneJson = getTemplateSceneJson(result.gallery.templateTitle)!;
    api.getGalleryById.mockResolvedValue(result);
    useStore.getState().setMode('view');
    const router = createMemoryRouter([{ path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> }], {
      initialEntries: ['/virtual-gallery/create?exhibitionId=template-gallery'],
    });
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(useStore.getState().mode).toBe('edit'));
    expect(useStore.getState().roomSize.width).toBe(JSON.parse(result.gallery.sceneJson).roomSize.width);
    act(() => {
      useStore.getState().setRoomSize({ width: 30 });
      useStore.getState().setMode('view');
    });
    const scene = useStore.getState().exportScene();
    fireEvent.click(screen.getByRole('button', { name: 'backToEditor' }));
    expect(useStore.getState().mode).toBe('edit');
    expect(useStore.getState().exportScene()).toEqual(scene);
    expect(screen.queryByRole('button', { name: 'backToEditor' })).not.toBeInTheDocument();
    expect(api.getGalleryById).toHaveBeenCalledTimes(1);
  });

  it.each(['viewer', 'editor'] as const)('only offers return to editing for an %s share when previewing', async (role) => {
    const result = sharedGallery('shared-preview');
    api.getSharedGallery.mockResolvedValue({ ...result, access: { viaShare: true, role } });
    useStore.getState().setMode('view');
    const router = createMemoryRouter([{ path: '/virtual-gallery/share/:token', element: <VirtualGalleryCreate /> }], {
      initialEntries: ['/virtual-gallery/share/preview-token'],
    });
    render(<RouterProvider router={router} />);
    await screen.findByText('vgcStatusEditingShared shared-preview');
    expect(useStore.getState().mode).toBe(role === 'editor' ? 'edit' : 'view');
    act(() => useStore.getState().setMode('view'));
    if (role === 'editor') {
      fireEvent.click(screen.getByRole('button', { name: 'backToEditor' }));
      expect(useStore.getState().mode).toBe('edit');
    } else {
      expect(screen.queryByRole('button', { name: 'backToEditor' })).not.toBeInTheDocument();
    }
  });

  it('keeps an owner opening a view-only link in view mode without a return-to-edit button', async () => {
    saveAuth({ token: 'jwt-owner', user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' } });
    api.getGalleryById.mockResolvedValue(sharedGallery('view-gallery'));
    const router = createMemoryRouter([{ path: '/virtual-gallery/create', element: <VirtualGalleryCreate /> }], {
      initialEntries: ['/virtual-gallery/create?exhibitionId=view-gallery&share=view'],
    });
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(useStore.getState().mode).toBe('view'));
    expect(screen.queryByRole('button', { name: 'backToEditor' })).not.toBeInTheDocument();
  });

  it("ignores a query roomId for an existing gallery session", async () => {
    saveAuth({
      token: "jwt-owner",
      user: { id: "owner-1", email: "owner@example.com", name: "Owner" },
    });
    api.getGalleryById.mockResolvedValue(sharedGallery("gallery-1"));
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/create",
        element: <VirtualGalleryCreate />,
      }],
      {
        initialEntries: [
          "/virtual-gallery/create?exhibitionId=gallery-1&roomId=attacker-room",
        ],
      },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(useMultiplayerStore.getState().roomId).toBe("gallery-1");
    });
  });

  it("immediately clears prior multiplayer authorization before loading another share", async () => {
    const pending = deferred<ReturnType<typeof sharedGallery>>();
    api.getSharedGallery.mockReturnValue(pending.promise);
    useMultiplayerStore.getState().setConnected(true);
    useMultiplayerStore.getState().setRole("owner");
    useMultiplayerStore.getState().setShareToken("old-token");
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/share/:token",
        element: <VirtualGalleryCreate />,
      }],
      { initialEntries: ["/virtual-gallery/share/new-token"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(api.getSharedGallery).toHaveBeenCalledWith("new-token");
      expect(useMultiplayerStore.getState().connected).toBe(false);
      expect(useMultiplayerStore.getState().role).toBeNull();
      expect(useMultiplayerStore.getState().shareToken).toBe("");
    });
  });

  it("ignores a stale share response after navigating to a newer token", async () => {
    const first = deferred<ReturnType<typeof sharedGallery>>();
    const second = deferred<ReturnType<typeof sharedGallery>>();
    api.getSharedGallery.mockImplementation((token: string) => (
      token === "token-a" ? first.promise : second.promise
    ));
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/share/:token",
        element: <VirtualGalleryCreate />,
      }],
      { initialEntries: ["/virtual-gallery/share/token-a"] },
    );

    render(<RouterProvider router={router} />);
    await waitFor(() => expect(api.getSharedGallery).toHaveBeenCalledWith("token-a"));
    await router.navigate("/virtual-gallery/share/token-b");
    await waitFor(() => expect(api.getSharedGallery).toHaveBeenCalledWith("token-b"));

    await act(async () => {
      second.resolve(sharedGallery("gallery-b"));
      await second.promise;
    });
    await waitFor(() => {
      expect(useMultiplayerStore.getState().roomId).toBe("gallery-b");
      expect(useMultiplayerStore.getState().shareToken).toBe("token-b");
    });

    await act(async () => {
      first.resolve(sharedGallery("gallery-a"));
      await first.promise;
    });

    await waitFor(() => {
      expect(useMultiplayerStore.getState().roomId).toBe("gallery-b");
      expect(useMultiplayerStore.getState().shareToken).toBe("token-b");
    });
  });

  it('preserves local edits and pauses saving when the server rejects a stale revision', async () => {
    api.getSharedGallery.mockResolvedValue(sharedGallery('gallery-1'));
    api.updateSharedGallery.mockRejectedValue(new GalleryConflictError());
    const router = createMemoryRouter([{ path: '/virtual-gallery/share/:token', element: <VirtualGalleryCreate /> }], { initialEntries: ['/virtual-gallery/share/editor-token'] });
    render(<RouterProvider router={router} />);
    await screen.findByText('vgcStatusEditingShared gallery-1');
    act(() => useStore.getState().addItem('text', { position: [1, 1, 1] }));
    const local = useStore.getState().exportScene();
    fireEvent.click(screen.getByRole('button', { name: 'vgcBtnSave' }));
    await screen.findByText('vgcSaveConflict');
    expect(useStore.getState().exportScene()).toEqual(local);
    expect(api.updateSharedGallery).toHaveBeenCalledWith('editor-token', expect.objectContaining({ expectedRevision: 0 }));
    fireEvent.click(screen.getByRole('button', { name: 'vgcBtnSave' }));
    await act(async () => { await Promise.resolve(); });
    expect(api.updateSharedGallery).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();
    act(() => useStore.getState().addItem('text', { position: [2, 1, 1] }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(api.updateSharedGallery).toHaveBeenCalledTimes(1);
  });

  it('leaves idle scenes alone and autosaves scene edits after 350ms, including edits during a save', async () => {
    const initial = sharedGallery('gallery-1');
    api.getSharedGallery.mockResolvedValue(initial);
    const exportScene = vi.fn(initialStudioState.exportScene);
    useStore.setState({ exportScene });
    const router = createMemoryRouter([{ path: '/virtual-gallery/share/:token', element: <VirtualGalleryCreate /> }], { initialEntries: ['/virtual-gallery/share/editor-token'] });
    await import('../features/metaverse-studio');
    await act(async () => { render(<RouterProvider router={router} />); });
    expect(screen.getByText('vgcStatusEditingShared gallery-1')).toBeInTheDocument();
    // Let the initial load settle before faking the autosave clock. The loading gate
    // intentionally keeps the studio unmounted until the saved scene is imported.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    vi.useFakeTimers();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    exportScene.mockClear();
    act(() => useStore.setState({ selectedItemId: 'ui-only', isPointerLocked: true }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(exportScene).not.toHaveBeenCalled();
    expect(api.updateSharedGallery).not.toHaveBeenCalled();

    const firstSave = deferred<ReturnType<typeof sharedGallery>>();
    api.updateSharedGallery.mockReturnValueOnce(firstSave.promise);
    act(() => useStore.getState().addItem('text', { position: [1, 1, 1] }));
    await act(async () => { await vi.advanceTimersByTimeAsync(349); });
    expect(api.updateSharedGallery).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(api.updateSharedGallery).toHaveBeenCalledTimes(1);
    act(() => useStore.getState().addItem('text', { position: [2, 1, 1] }));
    const saved = { ...initial, gallery: { ...initial.gallery, revision: 1 } };
    expect(screen.getByText('uxServerSaving')).toBeInTheDocument();
    api.getSharedGallery.mockResolvedValue(saved);
    api.updateSharedGallery.mockResolvedValue({ ...saved, gallery: { ...saved.gallery, revision: 2 } });
    // The server can expose our committed revision before the save response arrives.
    await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.queryByText('uxSaveConflict')).not.toBeInTheDocument();
    await act(async () => { firstSave.resolve(saved); await firstSave.promise; });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(api.updateSharedGallery).toHaveBeenCalledTimes(2);
    expect(api.updateSharedGallery.mock.calls[1][1].expectedRevision).toBe(1);
    expect(JSON.parse(api.updateSharedGallery.mock.calls[1][1].sceneJson).items).toHaveLength(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(api.updateSharedGallery).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed automatic save visible until a successful retry', async () => {
    const initial = sharedGallery('gallery-1');
    api.getSharedGallery.mockResolvedValue(initial);
    api.updateSharedGallery.mockRejectedValue(new Error('Network unavailable'));
    const router = createMemoryRouter([{ path: '/virtual-gallery/share/:token', element: <VirtualGalleryCreate /> }], { initialEntries: ['/virtual-gallery/share/editor-token'] });
    await import('../features/metaverse-studio');
    render(<RouterProvider router={router} />);
    expect(await screen.findByText('vgcStatusEditingShared gallery-1')).toBeInTheDocument();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    vi.useFakeTimers();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    act(() => useStore.getState().addItem('text', { position: [1, 1, 1] }));
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(screen.getByText('uxServerFailed')).toBeInTheDocument();
    expect(screen.queryByText(/uxLastServerSave/)).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByText('uxServerFailed')).toBeInTheDocument();
    api.updateSharedGallery.mockResolvedValue({ ...initial, gallery: { ...initial.gallery, revision: 1 } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(screen.queryByText('uxServerFailed')).not.toBeInTheDocument();
    expect(screen.getByText(/uxLastServerSave/)).toBeInTheDocument();
  });

  it('pauses manual and scheduled saves and ignores remote refresh until reconnect review ends', async () => {
    const initial = sharedGallery('gallery-1');
    api.getSharedGallery.mockResolvedValue(initial);
    api.updateSharedGallery.mockResolvedValue({ ...initial, gallery: { ...initial.gallery, revision: 1 } });
    const router = createMemoryRouter([{ path: '/virtual-gallery/share/:token', element: <VirtualGalleryCreate /> }], { initialEntries: ['/virtual-gallery/share/editor-token'] });
    await import('../features/metaverse-studio');
    vi.useFakeTimers();
    await act(async () => { render(<RouterProvider router={router} />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const base = useStore.getState().exportScene();
    act(() => useStore.getState().addItem('text', { position: [1, 1, 1] }));
    act(() => useReconnectDraftStore.setState({ draft: { roomId: 'gallery-1', base, remote: null, uncertain: true } }));
    expect(screen.getByRole('button', { name: 'vgcBtnSave' })).toBeDisabled();
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'metaverse-gallery-sync', newValue: JSON.stringify({ galleryId: 'gallery-1' }) }));
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(useStore.getState().items).toHaveLength(1);
    expect(api.updateSharedGallery).not.toHaveBeenCalled();
    act(() => clearReconnectDraft());
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(api.updateSharedGallery).toHaveBeenCalledTimes(1);
    expect(JSON.parse(api.updateSharedGallery.mock.calls[0][1].sceneJson).items).toHaveLength(1);
  });

  it.each(['restore', 'discard'])('requires an explicit %s decision for a draft after authenticated gallery loading', async decision => {
    const initial = sharedGallery('gallery-1');
    const base = initialStudioState.exportScene();
    const local = structuredClone(base); local.roomSize.floorColor = '#112233';
    const remote = structuredClone(base); remote.roomSize.width += 2;
    initial.gallery.sceneJson = JSON.stringify(remote);
    const scope = await editorDraftScope('guest', 'gallery-1', 'editor-token');
    writeEditorTabDraft(scope, base, local);
    api.getSharedGallery.mockResolvedValue(initial);
    api.updateSharedGallery.mockResolvedValue({ ...initial, gallery: { ...initial.gallery, revision: 1 } });
    const router = createMemoryRouter([{ path: '/virtual-gallery/share/:token', element: <VirtualGalleryCreate /> }], { initialEntries: ['/virtual-gallery/share/editor-token'] });
    render(<RouterProvider router={router} />);
    await screen.findByRole('alertdialog', { name: 'tabDraftTitle' });
    expect(screen.getByRole('button', { name: 'tabDraftRestore' })).toBeDisabled();
    act(() => useMultiplayerStore.setState({ connected: true, role: 'editor', lastSceneVersion: 1 }));
    expect(useStore.getState().roomSize.floorColor).toBe(remote.roomSize.floorColor);
    expect(api.updateSharedGallery).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: decision === 'restore' ? 'tabDraftRestore' : 'tabDraftDiscard' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(useStore.getState().roomSize.width).toBe(remote.roomSize.width);
    expect(useStore.getState().roomSize.floorColor).toBe(decision === 'restore' ? '#112233' : remote.roomSize.floorColor);
    if (decision === 'discard') expect(readEditorTabDraft(scope)).toBeNull();
  });

  it('adopts a clean remote scene without autosaving it back to the server', async () => {
    const initial = sharedGallery('gallery-1');
    api.getSharedGallery.mockResolvedValue(initial);
    const router = createMemoryRouter([{ path: '/virtual-gallery/share/:token', element: <VirtualGalleryCreate /> }], { initialEntries: ['/virtual-gallery/share/editor-token'] });
    await import('../features/metaverse-studio');
    vi.useFakeTimers();
    await act(async () => { render(<RouterProvider router={router} />); });
    expect(screen.getByText('vgcStatusEditingShared gallery-1')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const remote = { ...initial, gallery: { ...initial.gallery, revision: 1, updatedAt: '2026-06-01T00:00:01.000Z', sceneJson: JSON.stringify({ items: [], roomSize: { ...useStore.getState().roomSize, width: 42 } }) } };
    api.getSharedGallery.mockResolvedValue(remote);
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'metaverse-gallery-sync', newValue: JSON.stringify({ galleryId: 'gallery-1' }) }));
      await Promise.resolve();
    });
    expect(useStore.getState().roomSize.width).toBe(42);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(api.updateSharedGallery).not.toHaveBeenCalled();
    expect(screen.queryByText('vgcSaveConflict')).not.toBeInTheDocument();
  });

  it('keeps unsaved edits during cross-tab sync and adopts a new revision only after explicit reload', async () => {
    api.getSharedGallery.mockResolvedValue(sharedGallery('gallery-1'));
    const router = createMemoryRouter([{ path: '/virtual-gallery/share/:token', element: <VirtualGalleryCreate /> }], { initialEntries: ['/virtual-gallery/share/editor-token'] });
    render(<RouterProvider router={router} />);
    await screen.findByText('vgcStatusEditingShared gallery-1');
    const remote = sharedGallery('gallery-1');
    remote.gallery.revision = 1;
    remote.gallery.updatedAt = '2026-06-01T00:00:01.000Z';
    api.getSharedGallery.mockResolvedValue(remote);
    act(() => {
      useStore.getState().addItem('text', { position: [1, 1, 1] });
      window.dispatchEvent(new StorageEvent('storage', { key: 'metaverse-gallery-sync', newValue: JSON.stringify({ galleryId: 'gallery-1' }) }));
    });
    const local = useStore.getState().exportScene();
    await screen.findByText('vgcSaveConflict');
    expect(useStore.getState().exportScene()).toEqual(local);
    expect(api.updateSharedGallery).not.toHaveBeenCalled();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'vgcReloadLatest' }));
    await waitFor(() => expect(screen.queryByText('vgcSaveConflict')).not.toBeInTheDocument());
    expect(useStore.getState().items).toEqual([]);
    api.updateSharedGallery.mockResolvedValue({ ...remote, gallery: { ...remote.gallery, revision: 2 } });
    fireEvent.click(screen.getByRole('button', { name: 'vgcBtnSave' }));
    await waitFor(() => expect(api.updateSharedGallery).toHaveBeenCalledWith('editor-token', expect.objectContaining({ expectedRevision: 1 })));
  });

  it("ignores an old save response after navigating to another share", async () => {
    const oldSave = deferred<ReturnType<typeof sharedGallery>>();
    api.getSharedGallery.mockImplementation((token: string) => (
      Promise.resolve(sharedGallery(token === "token-a" ? "gallery-a" : "gallery-b"))
    ));
    api.updateSharedGallery.mockReturnValue(oldSave.promise);
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/share/:token",
        element: <VirtualGalleryCreate />,
      }],
      { initialEntries: ["/virtual-gallery/share/token-a"] },
    );

    render(<RouterProvider router={router} />);
    await screen.findByText("vgcStatusEditingShared gallery-a");
    fireEvent.click(screen.getByRole("button", { name: "vgcBtnSave" }));
    await waitFor(() => {
      expect(api.updateSharedGallery).toHaveBeenCalledWith(
        "token-a",
        expect.objectContaining({ sceneJson: expect.any(String) }),
      );
    });

    await router.navigate("/virtual-gallery/share/token-b");
    await screen.findByText("vgcStatusEditingShared gallery-b");

    await act(async () => {
      oldSave.resolve(sharedGallery("gallery-a"));
      await oldSave.promise;
    });

    expect(localStorage.getItem("metaverse-gallery-sync")).toBeNull();
    expect(screen.getByText("vgcStatusEditingShared gallery-b")).toBeInTheDocument();
    expect(screen.queryByText('uxServerSaving')).not.toBeInTheDocument();
    expect(screen.queryByText(/uxLastServerSave/)).not.toBeInTheDocument();
  });

  it("shows room authorization errors and disables saving", async () => {
    api.getSharedGallery.mockResolvedValue(sharedGallery("gallery-1"));
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/share/:token",
        element: <VirtualGalleryCreate />,
      }],
      { initialEntries: ["/virtual-gallery/share/editor-token"] },
    );

    render(<RouterProvider router={router} />);
    await screen.findByText("vgcStatusEditingShared gallery-1");

    act(() => {
      useMultiplayerStore.getState().setRoomError({
        code: "FORBIDDEN",
        message: "Editing access was revoked",
      });
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Editing access was revoked");
    expect(screen.getByRole("button", { name: "vgcBtnSave" })).toBeDisabled();
  });

  it("persists a live gallery without issuing a competing full-scene sync", async () => {
    api.getSharedGallery.mockResolvedValue(sharedGallery("gallery-1"));
    api.updateSharedGallery.mockResolvedValue(sharedGallery("gallery-1"));
    useMultiplayerStore.setState({ role: "editor", lastSceneVersion: 7 });
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/share/:token",
        element: <VirtualGalleryCreate />,
      }],
      { initialEntries: ["/virtual-gallery/share/editor-token"] },
    );

    render(<RouterProvider router={router} />);
    await screen.findByText("vgcStatusEditingShared gallery-1");
    fireEvent.click(screen.getByRole("button", { name: "vgcBtnSave" }));

    await waitFor(() => expect(api.updateSharedGallery).toHaveBeenCalled());
    expect(network.emitSceneSync).not.toHaveBeenCalled();
  });

  it.each(["RATE_LIMITED", "COLLABORATION_UNAVAILABLE"] as const)(
    "keeps manual and automatic persistence available for transient %s errors",
    async (code) => {
      api.getSharedGallery.mockResolvedValue(sharedGallery("gallery-1"));
      api.updateSharedGallery.mockResolvedValue(sharedGallery("gallery-1"));
      const router = createMemoryRouter(
        [{
          path: "/virtual-gallery/share/:token",
          element: <VirtualGalleryCreate />,
        }],
        { initialEntries: ["/virtual-gallery/share/editor-token"] },
      );

      render(<RouterProvider router={router} />);
      await screen.findByText("vgcStatusEditingShared gallery-1");
      api.updateSharedGallery.mockClear();
      act(() => {
        useMultiplayerStore.getState().setRoomError({
          code,
          message: "temporary collaboration issue",
        });
        const current = useStore.getState().exportScene();
        useStore.getState().importScene({
          ...current,
          roomSize: {
            ...current.roomSize,
            width: (current.roomSize.width ?? 10) + 1,
          },
        });
      });

      expect(screen.getByRole("button", { name: "vgcBtnSave" })).toBeEnabled();
      await waitFor(
        () => expect(api.updateSharedGallery).toHaveBeenCalled(),
        { timeout: 2_000 },
      );
    },
  );

  it.each([
    ["FORBIDDEN", true],
    ["AUTH_REQUIRED", true],
    ["RATE_LIMITED", false],
    ["COLLABORATION_UNAVAILABLE", false],
  ] as const)("persistence blocking for %s is %s", (code, expected) => {
    expect(doesRoomErrorBlockPersistence(code)).toBe(expected);
  });
});
