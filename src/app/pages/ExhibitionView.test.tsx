import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryRouter,
  RouterProvider,
  type InitialEntry,
} from 'react-router';
import {
  getPublishedGalleryById,
  type ExhibitionDetail,
} from '../api/exhibitions';
import { I18nProvider, type Locale } from '../components/I18nProvider';
import { useMetaverseStudioStore as useStore } from '../modules/metaverse3d/store/useMetaverseStudioStore';
import ExhibitionView, {
  resetExhibitionViewCacheForTests,
} from './ExhibitionView';

const initialStoreState = useStore.getState();

vi.mock('../api/exhibitions', () => ({
  getPublishedGalleryById: vi.fn(),
}));

const { studioModuleLoad, studioRender } = vi.hoisted(() => ({
  studioModuleLoad: vi.fn(),
  studioRender: vi.fn(),
}));

vi.mock('../features/metaverse-studio', () => {
  studioModuleLoad();
  return {
    default: (props: unknown) => {
      studioRender(props);
      return <div>Studio loaded</div>;
    },
  };
});

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({}) as WebGLRenderingContext);
  localStorage.clear();
  sessionStorage.clear();
  useStore.setState(initialStoreState, true);
  resetExhibitionViewCacheForTests();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  useStore.setState(initialStoreState, true);
  localStorage.clear();
  sessionStorage.clear();
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function createGallery(
  id: string,
  scene: object,
  overrides: Partial<ExhibitionDetail> = {},
): ExhibitionDetail {
  return {
    id,
    ownerId: 'owner-1',
    ownerName: 'Owner',
    title: `Public exhibition ${id}`,
    description: 'A published gallery',
    templateTitle: 'Blank',
    templateImage: '',
    category: 'art',
    isPublished: true,
    publishedAt: '2026-06-01T00:00:00.000Z',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    sceneJson: JSON.stringify(scene),
    ...overrides,
  };
}

function renderExhibition(initialEntry: InitialEntry, locale: Locale | null = 'zh-TW') {
  if (locale) localStorage.setItem('metaexpo-locale', locale);
  else localStorage.removeItem('metaexpo-locale');
  const router = createMemoryRouter(
    [
      {
        path: '/exhibitions/:exhibitionId',
        element: <ExhibitionView />,
      },
    ],
    { initialEntries: [initialEntry] },
  );

  const view = render(
    <StrictMode>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </StrictMode>,
  );

  return { ...view, router };
}

it('opens explicit 2D links without probing WebGL or preparing the studio', async () => {
  vi.mocked(getPublishedGalleryById).mockResolvedValue({ gallery: createGallery('accessible', { version: 1, items: [] }) });
  const context = vi.mocked(HTMLCanvasElement.prototype.getContext);
  context.mockClear();
  renderExhibition('/exhibitions/accessible?mode=2d');
  expect(await screen.findByText('2D 圖文展覽')).toBeVisible();
  expect(context).not.toHaveBeenCalled();
  expect(studioRender).not.toHaveBeenCalled();
});

it('uses English when no language preference has been saved', async () => {
  vi.mocked(getPublishedGalleryById).mockResolvedValue({
    gallery: createGallery('english-default', { version: 1, items: [] }),
  });

  renderExhibition('/exhibitions/english-default', null);

  const displayMode = await screen.findByRole('group', { name: 'Exhibition display mode' });
  expect(within(displayMode).getByRole('button', { name: '2D artworks' })).toBeInTheDocument();
  expect(within(displayMode).getByRole('button', { name: '3D gallery' })).toBeInTheDocument();
  expect(localStorage.getItem('metaexpo-locale')).toBe('en');
});

describe('ExhibitionView', () => {
  it('asks for participation again on each visit, including a cached exhibition', async () => {
    vi.mocked(getPublishedGalleryById).mockResolvedValue({
      gallery: createGallery('exhibition-1', { version: 1, items: [] }),
    });
    useStore.setState({ mode: 'view', hasSelectedParticipationMode: true, allowPointerLock: true });
    const first = renderExhibition('/exhibitions/exhibition-1');
    await screen.findByText('Studio loaded');
    expect(useStore.getState().hasSelectedParticipationMode).toBe(false);
    expect(useStore.getState().allowPointerLock).toBe(false);
    act(() => useStore.getState().setHasSelectedParticipationMode(true));
    first.unmount();

    renderExhibition('/exhibitions/exhibition-1');
    await screen.findByText('Studio loaded');
    expect(useStore.getState().hasSelectedParticipationMode).toBe(false);
  });

  it('asks again when navigating to another exhibition but preserves the current visit choice', async () => {
    vi.mocked(getPublishedGalleryById).mockImplementation(async (id) => ({
      gallery: createGallery(id, { version: 1, items: [] }),
    }));
    const { router } = renderExhibition('/exhibitions/exhibition-a');
    await screen.findByText('Studio loaded');
    act(() => useStore.getState().setHasSelectedParticipationMode(true));
    act(() => screen.getByRole('button', { name: '2D 圖文' }).click());
    act(() => screen.getByRole('button', { name: '3D 展廳' }).click());
    await screen.findByText('Studio loaded');
    expect(useStore.getState().hasSelectedParticipationMode).toBe(true);

    await act(async () => router.navigate('/exhibitions/exhibition-b'));
    await screen.findByText('Public exhibition exhibition-b');
    await waitFor(() => expect(useStore.getState().hasSelectedParticipationMode).toBe(false));
  });

  it('defaults to semantic 2D without loading or rendering the studio when WebGL is unavailable', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    vi.mocked(getPublishedGalleryById).mockResolvedValue({
      gallery: createGallery('exhibition-2d', {
        version: 1,
        items: [{
          id: 'photo',
          type: 'painting',
          title: '低效能裝置也能看的作品',
          content: '/photo.jpg',
        }],
      }),
    });

    renderExhibition('/exhibitions/exhibition-2d');

    expect(await screen.findByRole('heading', { name: '低效能裝置也能看的作品' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '展品清單' })).toBeInTheDocument();
    expect(screen.queryByText('Studio loaded')).not.toBeInTheDocument();
    expect(studioModuleLoad).not.toHaveBeenCalled();
    expect(studioRender).not.toHaveBeenCalled();
  });

  it('lets visitors switch from 2D to 3D explicitly', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    vi.mocked(getPublishedGalleryById).mockResolvedValue({
      gallery: createGallery('exhibition-switch', { version: 1, items: [] }),
    });
    renderExhibition('/exhibitions/exhibition-switch');
    await screen.findByRole('heading', { name: 'Public exhibition exhibition-switch' });

    act(() => screen.getByRole('button', { name: '3D 展廳' }).click());

    expect(await screen.findByText('Studio loaded')).toBeInTheDocument();
    expect(studioRender).toHaveBeenCalled();
  });

  it('does not reload or re-import when the same instance rerenders', async () => {
    const scene = { version: 1, items: [] };
    vi.mocked(getPublishedGalleryById).mockResolvedValue({
      gallery: createGallery('exhibition-1', scene),
    });
    const store = useStore.getState();
    const importScene = vi.spyOn(store, 'importScene');
    const setMode = vi.spyOn(store, 'setMode');
    const router = createMemoryRouter(
      [
        {
          path: '/exhibitions/:exhibitionId',
          element: <ExhibitionView />,
        },
      ],
      { initialEntries: ['/exhibitions/exhibition-1'] },
    );
    const view = render(
      <StrictMode>
        <I18nProvider>
          <RouterProvider router={router} />
        </I18nProvider>
      </StrictMode>,
    );

    expect(await screen.findByText('Studio loaded')).toBeInTheDocument();

    view.rerender(
      <StrictMode>
        <I18nProvider>
          <RouterProvider router={router} />
        </I18nProvider>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(getPublishedGalleryById).toHaveBeenCalledTimes(1);
      expect(importScene).toHaveBeenCalledTimes(1);
      expect(importScene).toHaveBeenCalledWith(scene);
      expect(setMode).toHaveBeenCalledTimes(1);
      expect(setMode).toHaveBeenCalledWith('view');
    });
  });

  it('imports a resolved scene only once across an actual remount', async () => {
    const scene = { version: 1, items: [] };
    vi.mocked(getPublishedGalleryById).mockResolvedValue({
      gallery: createGallery('exhibition-1', scene),
    });
    const store = useStore.getState();
    const importScene = vi.spyOn(store, 'importScene');
    const setMode = vi.spyOn(store, 'setMode');

    const firstView = renderExhibition('/exhibitions/exhibition-1');
    expect(await screen.findByText('Studio loaded')).toBeInTheDocument();
    firstView.unmount();

    renderExhibition('/exhibitions/exhibition-1');
    expect(await screen.findByText('Studio loaded')).toBeInTheDocument();

    await waitFor(() => {
      expect(importScene).toHaveBeenCalledTimes(1);
      expect(importScene).toHaveBeenCalledWith(scene);
      expect(setMode).toHaveBeenCalledTimes(2);
      expect(setMode).toHaveBeenCalledWith('view');
    });
  });

  it('re-imports the same exhibition after the shared store scene changes', async () => {
    const scene = { version: 1, items: [{ id: 'a' }] };
    vi.mocked(getPublishedGalleryById).mockResolvedValue({
      gallery: createGallery('exhibition-1', scene),
    });
    const importScene = vi.spyOn(useStore.getState(), 'importScene');

    const firstView = renderExhibition('/exhibitions/exhibition-1');
    await waitFor(() => expect(importScene).toHaveBeenCalledWith(scene));
    firstView.unmount();

    const currentRoomSize = useStore.getState().roomSize;
    useStore.setState({
      roomSize: {
        ...currentRoomSize,
        width: currentRoomSize.width + 1,
      },
    });

    renderExhibition('/exhibitions/exhibition-1');
    expect(await screen.findByText('Studio loaded')).toBeInTheDocument();

    await waitFor(() => {
      expect(importScene).toHaveBeenCalledTimes(2);
      expect(importScene).toHaveBeenLastCalledWith(scene);
    });
  });

  it('retries successfully after a failed request', async () => {
    const scene = { version: 1, items: [{ id: 'retry' }] };
    vi.mocked(getPublishedGalleryById)
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce({
        gallery: createGallery('exhibition-1', scene),
      });
    const importScene = vi.spyOn(useStore.getState(), 'importScene');

    renderExhibition('/exhibitions/exhibition-1');
    expect(await screen.findByRole('heading', { name: '暫時無法開啟展覽' })).toBeInTheDocument();
    expect(screen.queryByText('Temporary failure')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新嘗試' }));
    expect(await screen.findByText('Studio loaded')).toBeInTheDocument();
    expect(getPublishedGalleryById).toHaveBeenCalledTimes(2);
    expect(importScene).toHaveBeenCalledTimes(1);
    expect(importScene).toHaveBeenCalledWith(scene);
  });

  it('rejects an array scene without entering view mode', async () => {
    vi.mocked(getPublishedGalleryById).mockResolvedValue({
      gallery: createGallery('exhibition-1', {}, {
        sceneJson: JSON.stringify([]),
      }),
    });
    const store = useStore.getState();
    const importScene = vi.spyOn(store, 'importScene');
    const setMode = vi.spyOn(store, 'setMode');

    renderExhibition('/exhibitions/exhibition-1');

    expect(await screen.findByText('無法載入 3D 場景。')).toBeInTheDocument();
    expect(importScene).not.toHaveBeenCalled();
    expect(setMode).not.toHaveBeenCalled();
    expect(screen.queryByText('Studio loaded')).not.toBeInTheDocument();
  });

  it.each([403, 404])('explains unavailable public exhibitions for status %s', async (status) => {
    vi.mocked(getPublishedGalleryById).mockRejectedValueOnce(Object.assign(new Error('internal response'), { status }));
    renderExhibition('/exhibitions/unavailable');
    expect(await screen.findByRole('heading', { name: '此展覽目前無法公開參觀' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('請向策展人索取最新連結');
    expect(screen.queryByText('internal response')).not.toBeInTheDocument();
  });

  it('provides an exit while the exhibition request is pending', async () => {
    vi.mocked(getPublishedGalleryById).mockReturnValueOnce(new Promise(() => {}));
    const router = createMemoryRouter([
      { path: '/exhibitions/:exhibitionId', element: <ExhibitionView /> },
      { path: '/exhibitions', element: <p>Exhibition list</p> },
    ], { initialEntries: ['/exhibitions/pending'] });
    localStorage.setItem('metaexpo-locale', 'zh-TW');
    render(<I18nProvider><RouterProvider router={router} /></I18nProvider>);
    fireEvent.click(screen.getByRole('button', { name: '返回展覽活動' }));
    expect(await screen.findByText('Exhibition list')).toBeInTheDocument();
  });

  it('surfaces an import failure without entering view mode', async () => {
    const scene = { version: 1, items: [{ id: 'broken', type: 'painting', title: 'Readable artwork', content: '/art.jpg' }] };
    vi.mocked(getPublishedGalleryById).mockResolvedValue({
      gallery: createGallery('exhibition-1', scene),
    });
    const store = useStore.getState();
    const importScene = vi
      .spyOn(store, 'importScene')
      .mockImplementationOnce(() => {
        throw new Error('Import failed');
      });
    const setMode = vi.spyOn(store, 'setMode');

    renderExhibition('/exhibitions/exhibition-1');

    expect(await screen.findByText('無法載入 3D 場景。')).toBeInTheDocument();
    expect(importScene).toHaveBeenCalledTimes(1);
    expect(setMode).not.toHaveBeenCalled();
    expect(screen.queryByText('Studio loaded')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2D 圖文' }));
    expect(await screen.findByRole('heading', { name: 'Readable artwork' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('imports a changed exhibition during route navigation', async () => {
    const sceneA = { version: 1, items: [{ id: 'a' }] };
    const sceneB = { version: 1, items: [{ id: 'b' }] };
    vi.mocked(getPublishedGalleryById).mockImplementation(async (id) => ({
      gallery:
        id === 'exhibition-a'
          ? createGallery(id, sceneA)
          : createGallery(id, sceneB),
    }));
    const importScene = vi.spyOn(useStore.getState(), 'importScene');
    const { router } = renderExhibition('/exhibitions/exhibition-a');

    await waitFor(() => expect(importScene).toHaveBeenCalledWith(sceneA));
    await router.navigate('/exhibitions/exhibition-b');

    await waitFor(() => {
      expect(importScene).toHaveBeenCalledTimes(2);
      expect(importScene).toHaveBeenLastCalledWith(sceneB);
    });
  });

  it('ignores a stale exhibition response after navigating to a newer request', async () => {
    const sceneA = { version: 1, items: [{ id: 'a' }] };
    const sceneB = { version: 1, items: [{ id: 'b' }] };
    const deferredA =
      createDeferred<{ gallery: ExhibitionDetail }>();
    const deferredB =
      createDeferred<{ gallery: ExhibitionDetail }>();
    vi.mocked(getPublishedGalleryById).mockImplementation((id) =>
      id === 'exhibition-a' ? deferredA.promise : deferredB.promise,
    );
    const store = useStore.getState();
    const importScene = vi.spyOn(store, 'importScene');
    const setMode = vi.spyOn(store, 'setMode');
    const { router } = renderExhibition('/exhibitions/exhibition-a');

    await waitFor(() => {
      expect(getPublishedGalleryById).toHaveBeenCalledWith('exhibition-a');
    });
    await router.navigate('/exhibitions/exhibition-b');
    await waitFor(() => {
      expect(getPublishedGalleryById).toHaveBeenCalledWith('exhibition-b');
    });

    await act(async () => {
      deferredB.resolve({
        gallery: createGallery('exhibition-b', sceneB),
      });
      await deferredB.promise;
    });

    expect(await screen.findByText('Public exhibition exhibition-b')).toBeInTheDocument();
    expect(importScene).toHaveBeenCalledTimes(1);
    expect(importScene).toHaveBeenLastCalledWith(sceneB);
    expect(setMode).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferredA.resolve({
        gallery: createGallery('exhibition-a', sceneA),
      });
      await deferredA.promise;
    });

    await waitFor(() => {
      expect(screen.getByText('Public exhibition exhibition-b')).toBeInTheDocument();
      expect(importScene).toHaveBeenCalledTimes(1);
      expect(importScene).toHaveBeenLastCalledWith(sceneB);
      expect(setMode).toHaveBeenCalledTimes(1);
    });
  });

  it('imports A again after navigating A to B to A', async () => {
    const sceneA = { version: 1, items: [{ id: 'a' }] };
    const sceneB = { version: 1, items: [{ id: 'b' }] };
    vi.mocked(getPublishedGalleryById).mockImplementation(async (id) => ({
      gallery:
        id === 'exhibition-a'
          ? createGallery(id, sceneA)
          : createGallery(id, sceneB),
    }));
    const importScene = vi.spyOn(useStore.getState(), 'importScene');
    const { router } = renderExhibition('/exhibitions/exhibition-a');

    await waitFor(() => expect(importScene).toHaveBeenCalledWith(sceneA));
    await router.navigate('/exhibitions/exhibition-b');
    await waitFor(() => expect(importScene).toHaveBeenCalledWith(sceneB));
    await router.navigate('/exhibitions/exhibition-a');

    await waitFor(() => {
      expect(importScene).toHaveBeenCalledTimes(3);
      expect(importScene).toHaveBeenLastCalledWith(sceneA);
    });
  });

  it('imports a changed scene payload for the same exhibition ID', async () => {
    const firstScene = { version: 1, items: [{ id: 'first' }] };
    const changedScene = { version: 2, items: [{ id: 'changed' }] };
    vi.mocked(getPublishedGalleryById)
      .mockResolvedValueOnce({
        gallery: createGallery('exhibition-1', firstScene),
      })
      .mockResolvedValueOnce({
        gallery: createGallery('exhibition-1', changedScene),
      });
    const importScene = vi.spyOn(useStore.getState(), 'importScene');

    const firstView = renderExhibition('/exhibitions/exhibition-1');
    await waitFor(() => expect(importScene).toHaveBeenCalledWith(firstScene));
    firstView.unmount();

    renderExhibition('/exhibitions/exhibition-1');
    await waitFor(() => {
      expect(importScene).toHaveBeenCalledTimes(2);
      expect(importScene).toHaveBeenLastCalledWith(changedScene);
    });
  });
});
