import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Slot } from '@radix-ui/react-slot';
import type { ComponentPropsWithoutRef } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import { en } from '@/app/i18n/catalogs/en';
import { flowSimplificationEn } from '@/app/i18n/catalogs/flowSimplification';
import type { QuickExhibitionAsset, QuickExhibitionDraft, QuickExhibitionPatch } from '@/app/features/quick-exhibition/types';
import QuickExhibitionCreate from './QuickExhibitionCreate';

const api = vi.hoisted(() => ({
  create: vi.fn(), get: vi.fn(), patch: vi.fn(), build: vi.fn(), apply: vi.fn(), discard: vi.fn(),
  upload: vi.fn(), publish: vi.fn(),
}));

vi.mock('@/app/api/auth', () => ({
  loadAuth: () => ({ token: 'owner-token', user: { id: 'owner-1', name: 'Owner' } }),
}));
vi.mock('@/app/api/media', () => ({ uploadMediaAsset: api.upload }));
vi.mock('@/app/api/gallery', () => ({ publishGalleryById: api.publish }));
vi.mock('@/app/api/quickExhibition', () => ({
  createQuickExhibition: api.create,
  getQuickExhibition: api.get,
  patchQuickExhibition: api.patch,
  buildQuickExhibition: api.build,
  applyQuickExhibition: api.apply,
  discardQuickExhibition: api.discard,
}));

// Preserve native button/link behavior without motion animations in orchestration tests.
vi.mock('@/app/components/ui/button', () => ({
  Button: ({ asChild, ...props }: ComponentPropsWithoutRef<'button'> & {
    asChild?: boolean; variant?: string; size?: string;
  }) => {
    delete props.variant;
    delete props.size;
    return asChild ? <Slot {...props} /> : <button {...props} />;
  },
}));

// Keep the real page, upload panel, and controller; never import or render the 3D preview.
vi.mock('@/app/features/quick-exhibition/QuickExhibitionPreview', () => ({
  QuickExhibitionPreview: ({ draft }: { draft: QuickExhibitionDraft }) => (
    <section aria-label="Rendered exhibition preview">
      <h2>{draft.result?.title}</h2>
      <ul>
        {draft.result?.includedAssetIds.map((id) => (
          <li key={id}>{draft.input.assets.find((asset) => asset.assetId === id)?.fileName}</li>
        ))}
      </ul>
    </section>
  ),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function artwork(fileName: string, index = 1): QuickExhibitionAsset {
  return {
    assetId: `asset-${index}`, clientFileId: `client-${index}`, order: index - 1,
    fileName, mimeType: 'image/png', width: 1200, height: 800,
    title: fileName.replace(/\.png$/, ''), artist: '', description: '',
    url: `/api/media/asset-${index}`, previewUrl: `/api/media/asset-${index}?accessToken=preview`,
  };
}

function draftFixture(assets: QuickExhibitionAsset[] = []): QuickExhibitionDraft {
  return {
    draftId: 'saved-draft', galleryId: 'saved-gallery', revision: 0, status: 'collecting',
    input: { title: '', language: 'en', style: 'white-box', assets }, result: null,
    createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z',
    limits: { maxAssets: 30, maxFileBytes: 15 * 1024 * 1024 },
  };
}

function completedDraft(draft: QuickExhibitionDraft): QuickExhibitionDraft {
  return {
    ...draft, status: 'ready', revision: draft.revision + 1,
    result: {
      // The preview seam only needs identity and coverage; scene rendering has separate tests.
      scene: { items: [] } as NonNullable<QuickExhibitionDraft['result']>['scene'],
      title: draft.input.title || en.quickExhibitionDefaultTitle,
      includedAssetIds: draft.input.assets.map((asset) => asset.assetId),
      uploadedCount: draft.input.assets.length, placedCount: draft.input.assets.length,
      layoutVersion: 1, warnings: [],
    },
  };
}

function fakeServer(initial = draftFixture()) {
  let draft = initial;
  const uploaded = new Map(initial.input.assets.map((asset) => [asset.assetId, asset]));
  api.create.mockImplementation(async (_token: string, id: string, input: { title: string; language: 'en' }) => {
    draft = { ...draft, draftId: id, input: { ...draft.input, ...input } };
    return draft;
  });
  api.get.mockImplementation(async () => draft);
  api.upload.mockImplementation(async (_token: string, file: File) => {
    const asset = artwork(file.name, uploaded.size + 1);
    uploaded.set(asset.assetId, asset);
    return {
      id: asset.assetId, fileName: asset.assetId, originalFileName: file.name,
      mimeType: file.type, size: file.size, width: asset.width, height: asset.height,
      url: asset.url, previewUrl: asset.previewUrl, metadataSanitized: true,
    };
  });
  api.patch.mockImplementation(async (_token: string, _id: string, input: QuickExhibitionPatch) => {
    if (input.expectedRevision !== draft.revision) throw new Error('Fixture revision mismatch');
    draft = {
      ...draft, revision: draft.revision + 1, status: 'collecting',
      input: {
        ...draft.input, style: input.style ?? draft.input.style, title: input.title ?? draft.input.title,
        assets: input.assets?.map((asset) => ({ ...uploaded.get(asset.assetId)!, ...asset })) ?? draft.input.assets,
      },
    };
    return draft;
  });
  api.build.mockImplementation(async () => {
    const isCandidate = Boolean(draft.result);
    draft = { ...completedDraft(draft), status: isCandidate ? 'candidate_ready' : 'ready' };
    return draft;
  });
  api.apply.mockImplementation(async () => { draft = { ...draft, status: 'ready', revision: draft.revision + 1 }; return draft; });
  api.publish.mockResolvedValue({ gallery: { id: draft.galleryId, isPublished: true } });
  return { current: () => draft, replace: (next: QuickExhibitionDraft) => { draft = next; } };
}

function renderPage(draftId?: string) {
  const router = createMemoryRouter([
    { path: '/virtual-gallery/quick-create', element: <I18nProvider><QuickExhibitionCreate /></I18nProvider> },
    { path: '/virtual-gallery/my-exhibitions', element: <h1>My exhibitions</h1> },
  ], { initialEntries: [`/virtual-gallery/quick-create${draftId ? `?draftId=${encodeURIComponent(draftId)}` : ''}`] });
  render(<RouterProvider router={router} />);
  return router;
}

function selectFiles(...names: string[]) {
  const files = names.map((name) => new File(['test image'], name, { type: 'image/png' }));
  fireEvent.change(screen.getByLabelText(en.quickExhibitionUploadAction), { target: { files } });
  return files;
}

function openArtworkDetails() {
  for (const label of screen.getAllByText(flowSimplificationEn.quickExhibitionArtworkDetails)) {
    const details = label.closest('details')!;
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(label.closest('summary')!);
    expect(details).toHaveAttribute('open');
  }
}

async function chooseTemplate() {
  const radio = await screen.findByRole('radio', { name: 'Warm gallery' });
  await waitFor(() => expect(radio).toBeEnabled());
  expect(api.build).not.toHaveBeenCalled();
  fireEvent.click(radio);
  expect(api.build).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save and generate preview' }));
}

async function preview() {
  if (screen.queryByRole('radio', { name: 'Warm gallery' }) && !api.build.mock.calls.length) await chooseTemplate();
  return screen.findByRole('region', { name: 'Rendered exhibition preview' });
}

describe('QuickExhibitionCreate orchestration', () => {
  let originalLang: string;

  beforeEach(() => {
    for (const mock of Object.values(api)) mock.mockReset();
    originalLang = document.documentElement.lang;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('metaexpo-locale', 'en');
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.lang = originalLang;
  });

  it('creates a saved preview from files alone and publishes only after an explicit click', async () => {
    const server = fakeServer();
    const building = deferred<QuickExhibitionDraft>();
    api.build.mockReturnValueOnce(building.promise);
    const router = renderPage();

    expect(screen.getByLabelText(en.quickExhibitionTitleLabel)).toHaveValue('');
    expect(screen.getByLabelText(en.quickExhibitionTitleLabel)).not.toBeRequired();
    expect(api.create).not.toHaveBeenCalled();
    expect(api.build).not.toHaveBeenCalled();

    expect(screen.getByText('1. Upload an image').closest('li')).toHaveAttribute('aria-current', 'step');
    const files = selectFiles('first.png', 'second.png');
    await chooseTemplate();
    for (const name of [en.quickExhibitionArtworkTitleLabel, en.quickExhibitionArtistLabel, en.quickExhibitionDescriptionLabel]) {
      screen.getAllByRole('textbox', { name }).forEach((field) => expect(field).not.toBeVisible());
    }
    await waitFor(() => expect(api.build).toHaveBeenCalledOnce());
    expect(api.create).toHaveBeenCalledWith('owner-token', expect.any(String), { title: '', language: 'en' });
    expect(api.create).toHaveBeenCalledOnce();
    expect(api.upload.mock.calls.map((call) => call[1])).toEqual(files);
    expect(server.current().input.assets.map((asset) => asset.fileName)).toEqual(['first.png', 'second.png']);
    expect(new URLSearchParams(router.state.location.search).get('draftId')).toBe(server.current().draftId);
    expect(screen.getByLabelText(en.quickExhibitionUploadAction)).toBeDisabled();
    expect(screen.getByLabelText(en.quickExhibitionTitleLabel)).toBeDisabled();
    expect(screen.queryByRole('region', { name: 'Rendered exhibition preview' })).not.toBeInTheDocument();
    expect(api.publish).not.toHaveBeenCalled();

    await act(async () => building.resolve(completedDraft(server.current())));
    const rendered = await preview();
    expect(within(rendered).getByRole('heading')).toHaveTextContent(en.quickExhibitionDefaultTitle);
    expect(within(rendered).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['first.png', 'second.png']);
    expect(screen.getByText(en.quickExhibitionSaved)).toBeVisible();
    expect(screen.getByText('3. Preview and publish').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(api.publish).not.toHaveBeenCalled();
    expect(api.apply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionPublish }));
    expect(await screen.findByRole('link', { name: en.quickExhibitionOpenPublic })).toHaveAttribute('href', '/exhibitions/saved-gallery');
    expect(api.publish).toHaveBeenCalledExactlyOnceWith('owner-token', 'saved-gallery');
    expect(screen.getByText('3. Preview and publish').closest('li')).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionShare }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy the link');
    expect(screen.getByLabelText('Public exhibition link')).toHaveValue(`${window.location.origin}/exhibitions/saved-gallery`);
    expect(screen.getByRole('link', { name: en.quickExhibitionAdvanced })).toHaveAttribute('href', '/virtual-gallery/create?exhibitionId=saved-gallery&mode=advanced');
  }, 10000);

  it('returns to my exhibitions with the saved private draft without publishing', async () => {
    const server = fakeServer();
    const router = renderPage();
    selectFiles('saved.png');
    await preview();
    expect(server.current().status).toBe('ready');
    expect(screen.queryByRole('button', { name: en.quickExhibitionSave })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionBack }));
    expect(await screen.findByRole('heading', { name: 'My exhibitions' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/virtual-gallery/my-exhibitions');
    expect(api.publish).not.toHaveBeenCalled();
    expect(server.current().input.assets[0].fileName).toBe('saved.png');
  });

  it('keeps successful uploads and retries only the failed file before showing a preview', async () => {
    const server = fakeServer();
    const privateMessage = 'Internal storage path: /private/uploads/failed.png';
    api.upload.mockRejectedValueOnce(new Error(privateMessage));
    renderPage();
    selectFiles('failed.png', 'saved.png');

    const retry = await screen.findByRole('button', { name: `${en.quickExhibitionRetry}: failed.png` });
    await waitFor(() => expect(server.current().input.assets.map((asset) => asset.fileName)).toEqual(['saved.png']));
    expect(screen.getByText(en.quickExhibitionError)).toBeVisible();
    expect(screen.queryByText(privateMessage)).not.toBeInTheDocument();
    expect(api.build).not.toHaveBeenCalled();
    expect(api.publish).not.toHaveBeenCalled();

    fireEvent.click(retry);
    const rendered = await preview();
    expect(within(rendered).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['failed.png', 'saved.png']);
    expect(api.upload.mock.calls.filter((call) => call[1].name === 'saved.png')).toHaveLength(1);
    expect(api.upload.mock.calls.filter((call) => call[1].name === 'failed.png')).toHaveLength(2);
    expect(api.build).toHaveBeenCalledOnce();
    expect(api.publish).not.toHaveBeenCalled();
  });

  it('shows a localized conflict and reloads the saved result without repeating uploads or rebuilding', async () => {
    const server = fakeServer();
    const privateMessage = 'Expected revision 2; owner database row changed';
    api.build.mockRejectedValueOnce(Object.assign(new Error(privateMessage), { code: 'DRAFT_CHANGED', status: 409 }));
    renderPage();
    selectFiles('saved.png');
    await chooseTemplate();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(en.quickExhibitionConflict);
    expect(alert).not.toHaveTextContent(privateMessage);
    expect(screen.queryByRole('button', { name: en.quickExhibitionRetryBuild })).not.toBeInTheDocument();
    const updated = completedDraft({ ...server.current(), input: { ...server.current().input, title: 'Updated elsewhere' } });
    server.replace(updated);

    fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionReload }));
    expect(within(await preview()).getByRole('heading')).toHaveTextContent('Updated elsewhere');
    expect(api.get).toHaveBeenCalledExactlyOnceWith('owner-token', updated.draftId);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.create).toHaveBeenCalledOnce();
    expect(api.upload).toHaveBeenCalledOnce();
    expect(api.build).toHaveBeenCalledOnce();
    expect(api.publish).not.toHaveBeenCalled();
  });

  it('returns an editor-managed draft to its saved exhibition instead of offering another quick build', async () => {
    fakeServer();
    api.get.mockRejectedValueOnce(Object.assign(new Error('managed'), {
      code: 'DRAFT_EDITOR_MANAGED', status: 409, galleryId: 'saved-gallery',
    }));
    renderPage('saved-draft');
    expect(await screen.findByRole('alert')).toHaveTextContent(en.quickExhibitionEditorManaged);
    expect(screen.getByRole('link', { name: en.quickExhibitionAdvanced })).toHaveAttribute('href', '/virtual-gallery/create?exhibitionId=saved-gallery&mode=advanced');
    expect(screen.queryByRole('button', { name: en.quickExhibitionRetryBuild })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: en.quickExhibitionTitleLabel })).not.toBeInTheDocument();
    expect(api.build).not.toHaveBeenCalled();
  });

  it.each([en.quickExhibitionUpdatePreview, en.quickExhibitionPreviewTitle])('saves edited and cleared descriptions via "%s", then preserves them after apply and reload', async (saveAction) => {
    const original = completedDraft(draftFixture([
      { ...artwork('first.png'), description: 'Original artwork description' },
      { ...artwork('second.png', 2), description: 'Keep this description' },
    ]));
    const server = fakeServer(original);
    renderPage(original.draftId);
    await preview();

    for (const description of ['創作靈感\nAn updated artwork story.', '']) {
      fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionManage }));
      openArtworkDetails();
      const descriptions = screen.getAllByRole('textbox', { name: en.quickExhibitionDescriptionLabel });
      expect(descriptions).toHaveLength(2);
      expect(descriptions[0].tagName).toBe('TEXTAREA');
      expect(descriptions[0]).not.toBeRequired();
      expect(descriptions[0]).toHaveAttribute('maxlength', '5000');
      expect(descriptions[0]).toHaveValue(server.current().input.assets[0].description);
      expect(descriptions[1]).toHaveValue('Keep this description');
      const patchCount = api.patch.mock.calls.length;
      const buildCount = api.build.mock.calls.length;
      const applyCount = api.apply.mock.calls.length;
      const saved = server.current();

      await act(async () => fireEvent.change(descriptions[0], { target: { value: description } }));
      expect(descriptions[0]).toHaveValue(description);
      expect(descriptions[1]).toHaveValue('Keep this description');
      expect(saved.input.assets[0].description).not.toBe(description);
      expect(api.patch).toHaveBeenCalledTimes(patchCount);
      expect(api.build).toHaveBeenCalledTimes(buildCount);
      expect(api.apply).toHaveBeenCalledTimes(applyCount);
      expect(api.publish).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: saveAction }));
      const apply = await screen.findByRole('button', { name: en.quickExhibitionApply });
      await preview();
      expect(api.patch).toHaveBeenCalledTimes(patchCount + 1);
      expect(api.patch).toHaveBeenLastCalledWith('owner-token', original.draftId, {
        expectedRevision: saved.revision,
        title: saved.input.title, style: saved.input.style,
        assets: [
          expect.objectContaining({ assetId: 'asset-1', clientFileId: 'client-1', description }),
          expect.objectContaining({ assetId: 'asset-2', clientFileId: 'client-2', description: 'Keep this description' }),
        ],
      });
      expect(api.build).toHaveBeenCalledTimes(buildCount + 1);
      expect(server.current().input.assets[0].description).toBe(description);
      expect(api.apply).toHaveBeenCalledTimes(applyCount);
      expect(screen.queryByRole('button', { name: en.quickExhibitionPublish })).not.toBeInTheDocument();

      const candidate = server.current();
      fireEvent.click(apply);
      expect(await screen.findByRole('button', { name: en.quickExhibitionPublish })).toBeEnabled();
      expect(api.apply).toHaveBeenCalledTimes(applyCount + 1);
      expect(api.apply).toHaveBeenLastCalledWith('owner-token', original.draftId, {
        expectedRevision: candidate.revision, requestId: expect.any(String),
      });
      expect(server.current().status).toBe('ready');

      // Resume with a fresh controller and no local recovery data or source File objects.
      cleanup();
      sessionStorage.clear();
      renderPage(original.draftId);
      await preview();
      fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionManage }));
      openArtworkDetails();
      const restored = screen.getAllByRole('textbox', { name: en.quickExhibitionDescriptionLabel });
      expect(restored[0]).toHaveValue(description);
      expect(restored[1]).toHaveValue('Keep this description');
      fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionPreviewTitle }));
      await preview();
      expect(api.patch).toHaveBeenCalledTimes(patchCount + 1);
      expect(api.build).toHaveBeenCalledTimes(buildCount + 1);
      expect(api.create).not.toHaveBeenCalled();
      expect(api.upload).not.toHaveBeenCalled();
      expect(api.publish).not.toHaveBeenCalled();
    }
    expect(api.get).toHaveBeenCalledTimes(3);
  });

  it('saves artwork title and artist through apply and reload while preserving descriptions and other artwork', async () => {
    const original = completedDraft(draftFixture([
      { ...artwork('first.png'), artist: 'Original artist', description: 'Original artwork description' },
      { ...artwork('second.png', 2), artist: 'Other artist', description: 'Keep this description' },
    ]));
    const server = fakeServer(original);
    const expected = [
      { ...original.input.assets[0], title: 'Evening harbour', artist: 'Lin Mei' },
      original.input.assets[1],
    ];
    renderPage(original.draftId);
    await preview();
    fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionManage }));
    expect(screen.getAllByRole('button', { name: en.quickExhibitionUpdatePreview })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Save and generate preview' })).not.toBeInTheDocument();
    openArtworkDetails();
    const titles = screen.getAllByRole('textbox', { name: en.quickExhibitionArtworkTitleLabel });
    const artists = screen.getAllByRole('textbox', { name: en.quickExhibitionArtistLabel });
    expect(titles[0].tagName).toBe('INPUT');
    expect(titles[0]).toHaveValue('first');
    expect(titles[0]).toHaveAttribute('maxlength', '200');
    expect(artists[0].tagName).toBe('INPUT');
    expect(artists[0]).toHaveValue('Original artist');
    expect(artists[0]).toHaveAttribute('maxlength', '200');
    expect(artists[0]).not.toBeRequired();

    fireEvent.change(titles[0], { target: { value: 'Evening harbour' } });
    fireEvent.change(artists[0], { target: { value: 'Lin Mei' } });
    expect(titles[0]).toHaveValue('Evening harbour');
    expect(artists[0]).toHaveValue('Lin Mei');
    expect(screen.getAllByRole('textbox', { name: en.quickExhibitionDescriptionLabel })[0]).toHaveValue('Original artwork description');
    const editedDetails = titles[0].closest('details')!;
    const editedSummary = editedDetails.querySelector('summary')!;
    expect(editedSummary).toHaveTextContent('Evening harbour');
    fireEvent.click(editedSummary);
    expect(editedDetails).not.toHaveAttribute('open');
    expect(titles[0]).not.toBeVisible();
    fireEvent.click(editedSummary);
    expect(screen.getAllByRole('textbox', { name: en.quickExhibitionArtworkTitleLabel })[0]).toHaveValue('Evening harbour');
    expect(screen.getAllByRole('textbox', { name: en.quickExhibitionArtistLabel })[0]).toHaveValue('Lin Mei');
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.build).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionUpdatePreview }));
    const apply = await screen.findByRole('button', { name: en.quickExhibitionApply });
    expect(server.current()).toMatchObject({ status: 'candidate_ready', input: { assets: expected } });
    expect(api.patch).toHaveBeenCalledExactlyOnceWith('owner-token', original.draftId, {
      expectedRevision: original.revision, title: original.input.title, style: original.input.style,
      assets: expected.map(({ assetId, clientFileId, order, title, artist, description }) => ({
        assetId, clientFileId, order, title, artist, description,
      })),
    });
    expect(api.apply).not.toHaveBeenCalled();
    fireEvent.click(apply);
    expect(await screen.findByRole('button', { name: en.quickExhibitionPublish })).toBeEnabled();
    expect(server.current()).toMatchObject({ status: 'ready', input: { assets: expected } });

    cleanup();
    sessionStorage.clear();
    renderPage(original.draftId);
    await preview();
    fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionManage }));
    openArtworkDetails();
    expected.forEach((asset, index) => {
      expect(screen.getAllByRole('textbox', { name: en.quickExhibitionArtworkTitleLabel })[index]).toHaveValue(asset.title);
      expect(screen.getAllByRole('textbox', { name: en.quickExhibitionArtistLabel })[index]).toHaveValue(asset.artist);
      expect(screen.getAllByRole('textbox', { name: en.quickExhibitionDescriptionLabel })[index]).toHaveValue(asset.description);
    });
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.patch).toHaveBeenCalledOnce();
    expect(api.build).toHaveBeenCalledOnce();
    expect(api.apply).toHaveBeenCalledOnce();
    expect(api.create).not.toHaveBeenCalled();
    expect(api.upload).not.toHaveBeenCalled();
    expect(api.publish).not.toHaveBeenCalled();
  });

  it('requires an explicit apply action for a restored candidate before enabling publication', async () => {
    const candidate: QuickExhibitionDraft = { ...completedDraft(draftFixture([artwork('candidate.png')])), status: 'candidate_ready', revision: 7 };
    fakeServer(candidate);
    const applying = deferred<QuickExhibitionDraft>();
    api.apply.mockReturnValueOnce(applying.promise);
    renderPage(candidate.draftId);

    await preview();
    expect(api.get).toHaveBeenCalledExactlyOnceWith('owner-token', candidate.draftId);
    expect(api.create).not.toHaveBeenCalled();
    expect(api.upload).not.toHaveBeenCalled();
    expect(api.build).not.toHaveBeenCalled();
    expect(api.apply).not.toHaveBeenCalled();
    expect(api.publish).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: en.quickExhibitionPublish })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.quickExhibitionKeepCurrent })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionApply }));
    expect(api.apply).toHaveBeenCalledExactlyOnceWith('owner-token', candidate.draftId, {
      expectedRevision: 7, requestId: expect.any(String),
    });
    expect(screen.getByRole('button', { name: en.quickExhibitionApply })).toBeDisabled();
    expect(screen.getByRole('button', { name: en.quickExhibitionManage })).toBeDisabled();
    expect(api.publish).not.toHaveBeenCalled();

    await act(async () => applying.resolve({ ...candidate, status: 'ready', revision: 8 }));
    expect(await screen.findByRole('button', { name: en.quickExhibitionPublish })).toBeEnabled();
    expect(screen.queryByRole('button', { name: en.quickExhibitionApply })).not.toBeInTheDocument();
    expect(api.publish).not.toHaveBeenCalled();
    expect(api.build).not.toHaveBeenCalled();
  });

  it('discards a candidate on Keep current and restores the saved version before allowing publication', async () => {
    const original = completedDraft(draftFixture([artwork('current.png')]));
    const candidate: QuickExhibitionDraft = {
      ...completedDraft(draftFixture([artwork('candidate.png', 2)])),
      status: 'candidate_ready', revision: 7,
    };
    fakeServer(candidate);
    const discarding = deferred<QuickExhibitionDraft>();
    api.discard.mockReturnValueOnce(discarding.promise);
    renderPage(candidate.draftId);

    expect(within(await preview()).getByText('candidate.png')).toBeVisible();
    expect(api.discard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionKeepCurrent }));
    expect(api.discard).toHaveBeenCalledExactlyOnceWith('owner-token', candidate.draftId, {
      expectedRevision: 7, requestId: expect.any(String),
    });
    expect(screen.getByRole('button', { name: en.quickExhibitionKeepCurrent })).toBeDisabled();
    expect(api.apply).not.toHaveBeenCalled();
    expect(api.publish).not.toHaveBeenCalled();

    await act(async () => discarding.resolve({ ...original, revision: 8 }));
    expect(within(await preview()).getByText('current.png')).toBeVisible();
    expect(screen.queryByText('candidate.png')).not.toBeInTheDocument();
    const publish = await screen.findByRole('button', { name: en.quickExhibitionPublish });
    expect(publish).toBeEnabled();
    expect(api.publish).not.toHaveBeenCalled();
    expect(api.build).not.toHaveBeenCalled();
    expect(api.apply).not.toHaveBeenCalled();

    fireEvent.click(publish);
    expect(await screen.findByRole('link', { name: en.quickExhibitionOpenPublic })).toHaveAttribute('href', '/exhibitions/saved-gallery');
    expect(api.publish).toHaveBeenCalledExactlyOnceWith('owner-token', candidate.galleryId);
  });

  it('offers reload when the initial request for an existing draft fails', async () => {
    const saved = completedDraft(draftFixture([artwork('restored.png')]));
    fakeServer(saved);
    api.get.mockRejectedValueOnce(Object.assign(new Error('Private network diagnostics'), { code: 'NETWORK_ERROR' }));
    renderPage(saved.draftId);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(en.quickExhibitionError);
    expect(alert).not.toHaveTextContent('Private network diagnostics');
    fireEvent.click(screen.getByRole('button', { name: en.quickExhibitionReload }));

    expect(within(await preview()).getByText('restored.png')).toBeVisible();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.create).not.toHaveBeenCalled();
    expect(api.upload).not.toHaveBeenCalled();
    expect(api.build).not.toHaveBeenCalled();
    expect(api.publish).not.toHaveBeenCalled();
  });
});
