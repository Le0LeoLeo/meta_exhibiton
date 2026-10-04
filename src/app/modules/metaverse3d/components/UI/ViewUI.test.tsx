import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultAgentState } from "../../store/metaverseStoreUtils";
import { useStore } from "../../store/useStore";
import { ViewUI } from "./ViewUI";
import type { ExhibitItem } from '../../types';

const apiMocks = vi.hoisted(() => ({
  getPassport: vi.fn(),
  completePassport: vi.fn(),
  sharePassport: vi.fn(),
  loadMemory: vi.fn(),
  saveMemory: vi.fn(),
  summarizeFeedback: vi.fn(),
}));

vi.mock("../../../../api/auth", () => ({
  loadAuth: () => ({ token: "jwt-token", user: { id: "user-1", name: "Visitor" } }),
  subscribeAuth: () => () => undefined,
}));
vi.mock("../../../../api/exhibitionPassport", () => ({
  getExhibitionPassport: apiMocks.getPassport,
  completeExhibitionPassport: apiMocks.completePassport,
  shareExhibitionPassport: apiMocks.sharePassport,
}));
vi.mock("../../../../api/visitorMemory", () => ({
  loadVisitorMemory: apiMocks.loadMemory,
  saveVisitorMemory: apiMocks.saveMemory,
}));
vi.mock("../../../../api/aiWriting", () => ({ requestFeedbackSummary: apiMocks.summarizeFeedback }));
vi.mock("../../../../components/I18nProvider", () => ({
  useI18n: () => ({ locale: "en", toggleLocale: vi.fn(), t: (key: string) => key }),
}));

function resetStore() {
  useStore.setState({
    mode: "view",
    hasSelectedParticipationMode: true,
    viewingItem: null,
    items: [{ id: "art-1", type: "painting", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: "" }],
    agent: {
      ...defaultAgentState,
      memory: {
        ...defaultAgentState.memory,
        visitedExhibitIds: ["art-1"],
        engagedExhibitIds: ["art-1"],
        dwellSecondsByExhibit: { "art-1": 20 },
      },
    },
  });
}

function setCurrentArtwork(item: ExhibitItem | null) {
  const current = useStore.getState();
  const items = item
    ? [...current.items.filter((existing) => existing.id !== item.id), item]
    : current.items;
  useStore.setState({ items, viewingItem: item });
}

describe("ViewUI without exhibition passports", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    resetStore();
    apiMocks.loadMemory.mockResolvedValue({ memory: null });
    apiMocks.saveMemory.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ comments: [], canDelete: false }) }));
  });

  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('requests the actual image immediately without a CORS probe or unrelated placeholder', () => {
    const probe = vi.fn();
    vi.stubGlobal('Image', probe);
    act(() => setCurrentArtwork({ ...useStore.getState().items[0], title: 'IMG_0282', content: '/uploads/actual.jpg' }));
    render(<MemoryRouter><ViewUI exhibitionId={null} /></MemoryRouter>);
    const image = screen.getByRole('img', { name: 'IMG_0282' });
    expect(image).toHaveAttribute('src', '/uploads/actual.jpg');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).not.toHaveAttribute('crossorigin');
    expect(probe).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('loading');
    fireEvent.load(image);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('isolates delayed image events and failures when switching or reopening artworks', () => {
    const item = { ...useStore.getState().items[0], title: 'First', content: '/uploads/first.jpg' };
    act(() => setCurrentArtwork(item));
    render(<MemoryRouter><ViewUI exhibitionId={null} /></MemoryRouter>);
    const first = screen.getByRole('img');
    act(() => setCurrentArtwork({ ...item, title: 'Second', content: '/uploads/second.jpg' }));
    const second = screen.getByRole('img');
    expect(second).not.toBe(first);
    fireEvent.load(first);
    expect(screen.getByRole('status')).toHaveTextContent('loading');
    expect(second).toHaveAttribute('src', '/uploads/second.jpg');
    fireEvent.error(second);
    expect(screen.getByRole('status')).toHaveTextContent('viewImageLoadFailed');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    act(() => setCurrentArtwork(null));
    act(() => setCurrentArtwork(item));
    expect(screen.getByRole('img')).toHaveAttribute('src', item.content);
    fireEvent.load(screen.getByRole('img'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('displays local blob images with an explicit image type directly', () => {
    act(() => setCurrentArtwork({ ...useStore.getState().items[0], content: 'blob:local-upload', fileMimeType: 'image/png' }));
    render(<MemoryRouter><ViewUI exhibitionId={null} /></MemoryRouter>);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:local-upload');
  });

  it('shows the latest artwork work context and opens the Agent focused on that artwork', () => {
    const latest = {
      ...useStore.getState().items[0],
      title: 'Current title',
      workContext: { contribution: 'I designed the installation.', sources: [{ label: 'Museum archive', url: 'https://example.org/archive' }] },
    };
    act(() => useStore.setState({ items: [latest], viewingItem: { ...latest, title: 'Old title', workContext: undefined } }));
    render(<MemoryRouter><ViewUI exhibitionId={null} /></MemoryRouter>);

    expect(screen.getByText('I designed the installation.')).toBeVisible();
    expect(screen.getByRole('link', { name: /workContextOpenSource/ })).toHaveAttribute('href', 'https://example.org/archive');
    fireEvent.click(screen.getByRole('button', { name: 'workContextAskAgent' }));
    expect(useStore.getState().oneTimeExhibitFocus).toMatchObject({ itemId: latest.id, sessionId: useStore.getState().agent.memory.sessionId });
    expect(useStore.getState().agent.activeExhibit).toMatchObject({ id: latest.id, title: 'Current title' });
    expect(useStore.getState().agent.isChatOpen).toBe(true);
    expect(useStore.getState().viewingItem).toBeNull();
  });

  it('retries a failed image without closing the artwork or changing its URL', () => {
    act(() => setCurrentArtwork({ ...useStore.getState().items[0], title: 'Retry artwork', content: '/uploads/retry.jpg' }));
    render(<MemoryRouter><ViewUI exhibitionId={null} /></MemoryRouter>);
    fireEvent.error(screen.getByRole('img'));
    fireEvent.click(screen.getByRole('button', { name: 'uxRetryImage' }));
    expect(screen.getByRole('dialog', { name: 'Retry artwork' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('loading');
    expect(screen.getByRole('img')).toHaveAttribute('src', '/uploads/retry.jpg');
    fireEvent.load(screen.getByRole('img'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'uxRetryImage' })).not.toBeInTheDocument();
  });

  it('does not reuse a previous gallery or show comments for a local demo', async () => {
    sessionStorage.setItem('activeExhibitionId', 'previous-private-gallery');
    render(<MemoryRouter><ViewUI exhibitionId={null} /></MemoryRouter>);
    act(() => useStore.setState({ viewingItem: useStore.getState().items[0] }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('viewCommentsTitle')).not.toBeInTheDocument();
    expect(apiMocks.loadMemory).not.toHaveBeenCalled();
    expect(apiMocks.saveMemory).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    sessionStorage.removeItem('activeExhibitionId');
  });

  it('keeps teacher review artwork details without comments, visitor memory or AI actions', async () => {
    sessionStorage.setItem('activeExhibitionId', 'previous-gallery');
    act(() => setCurrentArtwork({
      ...useStore.getState().items[0], title: 'Student artwork', description: 'Student reflection',
      content: '/api/media/student-art', fileMimeType: 'image/png',
    }));
    render(<MemoryRouter><ViewUI exhibitionId="private-student-gallery" reviewOnly /></MemoryRouter>);
    expect(screen.getByRole('dialog', { name: 'Student artwork' })).toBeInTheDocument();
    expect(screen.getByText('Student reflection')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Student artwork' })).toHaveAttribute('src', '/api/media/student-art');
    expect(screen.queryByText('viewCommentsTitle')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'workContextAskAgent' })).not.toBeInTheDocument();
    await act(async () => {});
    expect(apiMocks.loadMemory).not.toHaveBeenCalled();
    expect(apiMocks.saveMemory).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps visitor memory while never loading or rendering a passport", async () => {
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);

    await waitFor(() => {
      expect(apiMocks.loadMemory).toHaveBeenCalledWith("jwt-token", "gallery-1");
    });
    expect(screen.queryByTestId("passport-state")).not.toBeInTheDocument();
    expect(apiMocks.getPassport).not.toHaveBeenCalled();
    expect(apiMocks.completePassport).not.toHaveBeenCalled();
    expect(apiMocks.sharePassport).not.toHaveBeenCalled();
  });

  it("restores preferred language and the last recommended exhibit", async () => {
    apiMocks.loadMemory.mockResolvedValue({
      memory: {
        id: "user-1__gallery-1",
        userId: "user-1",
        galleryId: "gallery-1",
        visitedExhibitIds: ["art-1"],
        engagedExhibitIds: ["art-1"],
        dwellSecondsByExhibit: { "art-1": 20 },
        preferredPersonality: "expert",
        preferredLanguage: "en",
        lastRecommendedExhibitId: "art-1",
        updatedAt: "2026-07-30T00:00:00.000Z",
      },
    });

    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);

    await waitFor(() => {
      expect(useStore.getState().agent.preferredLanguage).toBe("en");
      expect(useStore.getState().agent.memory.lastRecommendedExhibitId).toBe("art-1");
    });
    await waitFor(() => {
      expect(apiMocks.saveMemory).toHaveBeenCalledWith(
        "jwt-token",
        "gallery-1",
        expect.objectContaining({
          preferredLanguage: "en",
          lastRecommendedExhibitId: "art-1",
        }),
      );
    }, { timeout: 2000 });
  });

  it('does not save before hydration and clears previous-exhibition visits for a new visitor', async () => {
    vi.useFakeTimers();
    let resolve!: (value: { memory: null }) => void;
    apiMocks.loadMemory.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<MemoryRouter><ViewUI exhibitionId="gallery-new" /></MemoryRouter>);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(apiMocks.saveMemory).not.toHaveBeenCalled();
    expect(useStore.getState().agent.memory.visitedExhibitIds).toEqual([]);
    await act(async () => { resolve({ memory: null }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(apiMocks.saveMemory).toHaveBeenCalledWith('jwt-token', 'gallery-new', expect.objectContaining({
      visitedExhibitIds: [], engagedExhibitIds: [], dwellSecondsByExhibit: {}, lastRecommendedExhibitId: null,
    }));
  });

  it('does not overwrite stored memory after a failed read', async () => {
    vi.useFakeTimers();
    apiMocks.loadMemory.mockRejectedValue(new Error('offline'));
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(apiMocks.saveMemory).not.toHaveBeenCalled();
  });

  it('saves during continuous dwell updates and serializes slow writes', async () => {
    vi.useFakeTimers();
    let finish!: (value: { ok: boolean }) => void;
    apiMocks.saveMemory.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    act(() => useStore.getState().trackAgentDwell('art-1', 1));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(apiMocks.saveMemory).toHaveBeenCalledTimes(1);
    act(() => useStore.getState().trackAgentDwell('art-1', 1));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(apiMocks.saveMemory).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: true }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(apiMocks.saveMemory).toHaveBeenCalledTimes(2);
    expect(apiMocks.saveMemory.mock.calls[1][2].dwellSecondsByExhibit['art-1']).toBe(2);
  });

  it('preserves visits recorded during hydration without carrying prior-gallery data', async () => {
    let resolveMemory!: (value: unknown) => void;
    apiMocks.loadMemory.mockReturnValue(new Promise((resolve) => { resolveMemory = resolve; }));
    render(<MemoryRouter><ViewUI exhibitionId="gallery-new" /></MemoryRouter>);
    act(() => useStore.getState().setAgent({ memory: {
      ...useStore.getState().agent.memory, visitedExhibitIds: ['new-art'], dwellSecondsByExhibit: { 'new-art': 3 },
    } }));
    await act(async () => resolveMemory({ memory: {
      visitedExhibitIds: ['saved-art'], engagedExhibitIds: [], dwellSecondsByExhibit: { 'new-art': 4 },
      preferredPersonality: 'expert', preferredLanguage: 'en', lastRecommendedExhibitId: null,
    } }));
    expect(useStore.getState().agent.memory.visitedExhibitIds).toEqual(['saved-art', 'new-art']);
    expect(useStore.getState().agent.memory.dwellSecondsByExhibit).toEqual({ 'new-art': 7 });
  });

  it('ignores old gallery responses and cancels pending saves on unmount', async () => {
    vi.useFakeTimers();
    let resolveOld!: (value: unknown) => void;
    apiMocks.loadMemory.mockImplementation((_token, id) => id === 'gallery-old'
      ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve({ memory: null }));
    const view = render(<MemoryRouter><ViewUI exhibitionId="gallery-old" /></MemoryRouter>);
    view.rerender(<MemoryRouter><ViewUI exhibitionId="gallery-new" /></MemoryRouter>);
    await act(async () => {
      resolveOld({ memory: { visitedExhibitIds: ['old-art'], engagedExhibitIds: [], dwellSecondsByExhibit: {}, preferredPersonality: 'expert' } });
    });
    expect(useStore.getState().agent.memory.visitedExhibitIds).toEqual([]);
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(apiMocks.saveMemory).not.toHaveBeenCalled();
  });

  it('does not load or save visitor memory in edit mode', async () => {
    vi.useFakeTimers();
    useStore.setState({ mode: 'edit' });
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(apiMocks.loadMemory).not.toHaveBeenCalled();
    expect(apiMocks.saveMemory).not.toHaveBeenCalled();
  });

  it('keeps arrow keys inside comment fields instead of navigating artworks', () => {
    const first = useStore.getState().items[0];
    useStore.setState({ items: [first, { ...first, id: 'art-2' }], viewingItem: first });
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    fireEvent.keyDown(screen.getByPlaceholderText('viewCommentPlaceholder'), { key: 'ArrowRight' });
    expect(useStore.getState().viewingItem?.id).toBe('art-1');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(useStore.getState().viewingItem?.id).toBe('art-2');
  });

  it('distinguishes failed reads from empty comments and retries without losing the draft', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    useStore.setState({ viewingItem: useStore.getState().items[0] });
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    expect(screen.getByText('uxCommentsLoading')).toBeInTheDocument();
    expect(screen.queryByText('viewNoComments')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'viewCommentPlaceholder' }), { target: { value: 'Keep this draft' } });
    expect(await screen.findByText('uxCommentsFailed')).toBeInTheDocument();
    expect(screen.queryByText('viewNoComments')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'uxCommentsRetry' }));
    expect(await screen.findByText('viewNoComments')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'viewCommentPlaceholder' })).toHaveValue('Keep this draft');
  });

  it('blocks duplicate submission and isolates late results and drafts when changing artwork', async () => {
    let finish!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation((_url, init) => init?.method === 'POST'
      ? new Promise((resolve) => { finish = resolve; })
      : Promise.resolve({ ok: true, json: async () => ({ comments: [] }) } as Response));
    const first = useStore.getState().items[0];
    useStore.setState({ items: [first, { ...first, id: 'art-2' }], viewingItem: first });
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox', { name: 'viewNicknamePlaceholder' }), { target: { value: 'Visitor' } });
    const input = screen.getByRole('textbox', { name: 'viewCommentPlaceholder' });
    fireEvent.change(input, { target: { value: 'First draft' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'viewNextArtwork' }));
    expect(input).toHaveValue('');
    fireEvent.change(input, { target: { value: 'Second draft' } });
    await act(async () => finish({ ok: true, json: async () => ({ comment: { id: 'posted-first', userName: 'Visitor', content: 'First posted comment', createdAt: '2026-09-11' } }) } as Response));
    expect(screen.queryByText('First posted comment')).not.toBeInTheDocument();
    expect(input).toHaveValue('Second draft');
    fireEvent.click(screen.getByRole('button', { name: 'viewPreviousArtwork' }));
    expect(input).toHaveValue('First draft');
  });

  it('retains edited text when a pending submission completes and displays persistent failure feedback', async () => {
    let finish!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation((_url, init) => init?.method === 'POST'
      ? new Promise((resolve) => { finish = resolve; })
      : Promise.resolve({ ok: true, json: async () => ({ comments: [] }) } as Response));
    useStore.setState({ viewingItem: useStore.getState().items[0] });
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox', { name: 'viewNicknamePlaceholder' }), { target: { value: 'Visitor' } });
    const input = screen.getByRole('textbox', { name: 'viewCommentPlaceholder' });
    fireEvent.change(input, { target: { value: 'Submitted text' } });
    fireEvent.click(screen.getByRole('button', { name: 'viewSubmitComment' }));
    fireEvent.change(input, { target: { value: 'New text while waiting' } });
    await act(async () => finish({ ok: true, json: async () => ({}) } as Response));
    expect(input).toHaveValue('New text while waiting');
    fireEvent.click(screen.getByRole('button', { name: 'viewSubmitComment' }));
    await act(async () => finish({ ok: false, json: async () => ({ message: 'failed' }) } as Response));
    expect(await screen.findByText('uxCommentSendFailed')).toBeInTheDocument();
    expect(input).toHaveValue('New text while waiting');
  });

  it('restores an unsent draft after remounting and removes it after confirmed submission', async () => {
    useStore.setState({ viewingItem: useStore.getState().items[0] });
    const first = render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox', { name: 'viewNicknamePlaceholder' }), { target: { value: 'Visitor' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'viewCommentPlaceholder' }), { target: { value: 'Reload this draft' } });
    first.unmount();
    const second = render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    expect(screen.getByRole('textbox', { name: 'viewCommentPlaceholder' })).toHaveValue('Reload this draft');
    expect(screen.getByText('uxCommentDraftSaved')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'viewSubmitComment' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'viewCommentPlaceholder' })).toHaveValue(''));
    second.unmount();
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    expect(screen.getByRole('textbox', { name: 'viewCommentPlaceholder' })).toHaveValue('');
  });

  it('does not show an old AI summary after switching away and back to an artwork', async () => {
    let finish!: (value: { result: string }) => void;
    apiMocks.summarizeFeedback.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ comments: [{ id: 'c1', userName: 'Visitor', content: 'Existing feedback', createdAt: '2026-09-11' }] }) } as Response);
    const first = useStore.getState().items[0];
    useStore.setState({ items: [first, { ...first, id: 'art-2' }], viewingItem: first });
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    await screen.findByText('Existing feedback');
    fireEvent.click(screen.getByRole('button', { name: 'viewFeedbackAISummary' }));
    fireEvent.click(screen.getByRole('button', { name: 'viewNextArtwork' }));
    fireEvent.click(screen.getByRole('button', { name: 'viewPreviousArtwork' }));
    await act(async () => finish({ result: 'Outdated summary' }));
    expect(screen.queryByText('Outdated summary')).not.toBeInTheDocument();
  });

  it('focuses close, loops keyboard focus, and restores the opener after Escape without locking the mouse', async () => {
    const item = { ...useStore.getState().items[0], externalUrl: 'https://example.com/art' };
    const requestPointerLock = vi.fn();
    render(<MemoryRouter><button onClick={() => setCurrentArtwork(item)}>Open artwork</button><div id="view-canvas-container"><canvas ref={(canvas) => { if (canvas) canvas.requestPointerLock = requestPointerLock; }} /></div><ViewUI exhibitionId={null} /></MemoryRouter>);
    const opener = screen.getByRole('button', { name: 'Open artwork' });
    opener.focus();
    fireEvent.click(opener);
    const close = screen.getByRole('button', { name: 'viewCloseArtwork' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'workContextAskAgent' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Escape' });
    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(requestPointerLock).not.toHaveBeenCalled();
  });

  it('keeps composition keys in the dialog and moves from nickname to comment without submitting', async () => {
    useStore.setState({ viewingItem: useStore.getState().items[0] });
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    const nickname = screen.getByRole('textbox', { name: 'viewNicknamePlaceholder' });
    const comment = screen.getByRole('textbox', { name: 'viewCommentPlaceholder' });
    fireEvent.change(nickname, { target: { value: 'Visitor' } });
    fireEvent.change(comment, { target: { value: '中文留言' } });
    nickname.focus();
    fireEvent.keyDown(nickname, { key: 'Enter', isComposing: true });
    expect(nickname).toHaveFocus();
    fireEvent.keyDown(nickname, { key: 'Enter', keyCode: 229 });
    expect(nickname).toHaveFocus();
    fireEvent.keyDown(nickname, { key: 'Enter' });
    expect(comment).toHaveFocus();
    fireEvent.keyDown(comment, { key: 'Enter', ctrlKey: true, isComposing: true });
    fireEvent.keyDown(comment, { key: 'Escape', isComposing: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    fireEvent.keyDown(comment, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1));
  });

  it('lets touch visitors navigate artworks and close details using buttons', () => {
    const first = useStore.getState().items[0];
    useStore.setState({ items: [first, { ...first, id: 'art-2' }], viewingItem: first });
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'viewNextArtwork' }));
    expect(useStore.getState().viewingItem?.id).toBe('art-2');
    fireEvent.click(screen.getByRole('button', { name: 'viewPreviousArtwork' }));
    expect(useStore.getState().viewingItem?.id).toBe('art-1');
    fireEvent.click(screen.getByRole('button', { name: 'viewCloseArtwork' }));
    expect(useStore.getState().viewingItem).toBeNull();
  });

  it.each([false, true])('shows deletion only when the server grants owner capability (%s)', async (canDelete) => {
    const comment = { id: 'comment-1', userName: 'Another visitor', content: 'Hello', createdAt: '2026-09-02' };
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ comments: [comment], canDelete }) } as Response);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    useStore.setState({ viewingItem: useStore.getState().items[0] });
    render(<MemoryRouter><ViewUI exhibitionId="gallery-1" /></MemoryRouter>);
    await screen.findByText('Hello');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/comments'), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer jwt-token' }),
    }));
    const button = screen.queryByRole('button', { name: 'viewDeleteComment' });
    if (!canDelete) {
      expect(button).not.toBeInTheDocument();
      return;
    }
    expect(button).toBeInTheDocument();
    fireEvent.click(button!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/comments/comment-1'), expect.objectContaining({ method: 'DELETE' })));
    await waitFor(() => expect(screen.queryByText('Hello')).not.toBeInTheDocument());
  });
});
