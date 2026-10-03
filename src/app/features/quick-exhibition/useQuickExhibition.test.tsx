import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickExhibitionController } from './useQuickExhibition';
import type { QuickExhibitionAsset, QuickExhibitionDraft, QuickExhibitionPatch } from './types';
import type { SceneSnapshot } from '@/app/modules/metaverse3d/store/metaverseStoreTypes';

function fixture() {
  let draft: QuickExhibitionDraft = {
    draftId: 'draft-1', galleryId: 'gallery-1', revision: 0, status: 'collecting',
    input: { title: '', language: 'zh-TW', style: 'white-box', assets: [] }, result: null, createdAt: '', updatedAt: '',
  };
  const uploaded = new Map<string, QuickExhibitionAsset>();
  const services = {
    create: vi.fn(async () => draft), get: vi.fn(async () => draft),
    upload: vi.fn(async (_token: string, file: File) => {
      const id = `asset-${uploaded.size + 1}`;
      uploaded.set(id, { assetId: id, clientFileId: '', order: 0, fileName: file.name, mimeType: file.type, width: 100, height: 80, title: file.name, artist: '', description: '', url: `/api/media/${id}` });
      return { id, fileName: id, originalFileName: file.name, mimeType: file.type, width: 100, height: 80, size: file.size, metadataSanitized: true, url: `/api/media/${id}` };
    }),
    patch: vi.fn(async (_token: string, _id: string, input: QuickExhibitionPatch) => {
      if (input.expectedRevision !== draft.revision) throw Object.assign(new Error('changed'), { code: 'DRAFT_CHANGED' });
      draft = { ...draft, revision: draft.revision + 1, status: 'collecting', input: { ...draft.input, title: input.title ?? draft.input.title, assets: input.assets?.map((asset) => ({ ...uploaded.get(asset.assetId)!, ...asset })) ?? draft.input.assets } };
      return draft;
    }),
    build: vi.fn(async () => {
      const ids = draft.input.assets.map((asset) => asset.assetId);
      draft = { ...draft, revision: draft.revision + 1, status: draft.result ? 'candidate_ready' : 'ready', result: { scene: { items: [] } as unknown as SceneSnapshot, title: draft.input.title || '我的作品展', includedAssetIds: ids, uploadedCount: ids.length, placedCount: ids.length, layoutVersion: 1, warnings: [] } };
      return draft;
    }),
    apply: vi.fn(async () => { draft = { ...draft, revision: draft.revision + 1, status: 'ready' }; return draft; }),
    discard: vi.fn(async () => draft),
    publish: vi.fn(async () => ({ gallery: {} as never })),
  };
  const controller = new QuickExhibitionController({ token: 'token', userId: 'user-1', draftId: 'draft-1', resume: false, language: 'zh-TW', services, storage: sessionStorage });
  return { controller, services, setDraft: (next: QuickExhibitionDraft) => { draft = next; }, getDraft: () => draft };
}

const image = (name: string) => new File(['image'], name, { type: 'image/png' });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

beforeEach(() => sessionStorage.clear());

describe('quick exhibition workflow', () => {
  it('goes from files to a persisted preview with no form submission', async () => {
    const { controller, services } = fixture();
    const stop = controller.activate();
    await controller.addFiles([image('first.png'), image('second.png')]);
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
    expect(services.create).toHaveBeenCalledOnce();
    expect(services.build).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().draft?.result?.placedCount).toBe(2);
    expect(controller.getSnapshot().draft?.input.assets.map((asset) => asset.title)).toEqual(['first', 'second']);
    expect(services.publish).not.toHaveBeenCalled();
    await controller.publish();
    expect(controller.getSnapshot().phase).toBe('published');
    stop();
  });

  it('persists successful files but waits for a failed file to be retried', async () => {
    const { controller, services } = fixture();
    const upload = services.upload.getMockImplementation()!;
    let fail = true;
    services.upload.mockImplementation(async (token, file) => {
      if (file.name === 'retry.png' && fail) throw new Error('network');
      return upload(token, file);
    });
    const stop = controller.activate();
    await controller.addFiles([image('saved.png'), image('retry.png')]);
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('needs_attention'));
    expect(services.patch).toHaveBeenCalled();
    expect(services.build).not.toHaveBeenCalled();
    fail = false;
    const id = controller.getSnapshot().items.find((item) => item.fileName === 'retry.png')!.id;
    await controller.retryItem(id);
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
    expect(services.upload.mock.calls.filter((call) => call[1].name === 'saved.png')).toHaveLength(1);
    expect(controller.getSnapshot().draft?.result?.placedCount).toBe(2);
    stop();
  });

  it('merges a second batch while the first upload is still running', async () => {
    const { controller, services } = fixture();
    const upload = services.upload.getMockImplementation()!;
    let release!: () => void;
    services.upload.mockImplementation(async (token, file) => {
      if (file.name === 'first.png') await new Promise<void>((resolve) => { release = resolve; });
      return upload(token, file);
    });
    const stop = controller.activate();
    await controller.addFiles([image('first.png')]);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await controller.addFiles([image('second.png')]);
    await vi.waitFor(() => expect(controller.getSnapshot().items[1].status).toBe('succeeded'));
    release();
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
    expect(controller.getSnapshot().draft?.input.assets.map((asset) => asset.title)).toEqual(['first', 'second']);
    expect(services.build).toHaveBeenCalledOnce();
    stop();
  });

  it('restores missing local files without automatically omitting them', async () => {
    const { controller, services } = fixture();
    sessionStorage.setItem('quick-exhibition:user-1:draft-1', JSON.stringify([{ id: 'pending', fileName: 'not-uploaded.png' }]));
    const stop = controller.activate();
    await controller.reload();
    expect(controller.getSnapshot().items[0].status).toBe('missing');
    expect(controller.getSnapshot().phase).toBe('needs_attention');
    expect(services.build).not.toHaveBeenCalled();
    stop();
  });

  it('saves an edited title before returning from management to the preview', async () => {
    const { controller, services } = fixture();
    const stop = controller.activate();
    await controller.addFiles([image('original.png')]);
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
    controller.manage();
    controller.setTitle('Revised exhibition');
    controller.showPreview();
    await vi.waitFor(() => expect(controller.getSnapshot().draft?.result?.title).toBe('Revised exhibition'));
    expect(controller.getSnapshot().draft?.status).toBe('candidate_ready');
    expect(controller.getSnapshot().managing).toBe(false);
    expect(services.upload).toHaveBeenCalledOnce();
    expect(services.publish).not.toHaveBeenCalled();
    stop();
  });

  it('regenerates an unchanged saved draft on update preview without reuploading its artworks', async () => {
    const { controller, services } = fixture();
    const stop = controller.activate();
    try {
      await controller.addFiles([image('original.png')]);
      await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
      const saved = controller.getSnapshot().draft!;
      const patchCount = services.patch.mock.calls.length;
      controller.manage();
      controller.retryBuild();
      await vi.waitFor(() => expect(controller.getSnapshot().draft?.status).toBe('candidate_ready'));
      expect(services.build).toHaveBeenCalledTimes(2);
      expect(services.build).toHaveBeenLastCalledWith('token', 'draft-1', {
        expectedRevision: saved.revision, requestId: expect.any(String),
      });
      expect(services.patch).toHaveBeenCalledTimes(patchCount);
      expect(services.upload).toHaveBeenCalledOnce();
      expect(controller.getSnapshot().draft?.input).toEqual(saved.input);
      expect(services.apply).not.toHaveBeenCalled();
      expect(services.publish).not.toHaveBeenCalled();
    } finally { stop(); }
  });

  it('saves and clears artwork descriptions through candidate apply and reload without reuploading', async () => {
    const { controller, services, getDraft } = fixture();
    const stop = controller.activate();
    try {
      await controller.addFiles([image('first.png'), image('second.png')]);
      await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
      const [first, second] = controller.getSnapshot().items;

      for (const description of ['創作背景\nA story behind the artwork.', '']) {
        const saved = getDraft();
        const patchCount = services.patch.mock.calls.length;
        const buildCount = services.build.mock.calls.length;
        controller.manage();
        controller.setDescription(first.id, description);
        // A dirty description must also prevent publishing the old saved version.
        await controller.publish();
        expect(controller.getSnapshot().items[0].asset?.description).toBe(description);
        expect(controller.getSnapshot().items[1].asset).toEqual(second.asset);
        expect(saved.input.assets[0].description).not.toBe(description);
        expect(services.patch).toHaveBeenCalledTimes(patchCount);
        expect(services.build).toHaveBeenCalledTimes(buildCount);
        expect(services.publish).not.toHaveBeenCalled();

        if (description) controller.retryBuild();
        else controller.showPreview();
        await vi.waitFor(() => expect(controller.getSnapshot().draft?.status).toBe('candidate_ready'));
        expect(services.patch).toHaveBeenCalledTimes(patchCount + 1);
        expect(services.patch).toHaveBeenLastCalledWith('token', 'draft-1', {
          expectedRevision: saved.revision,
          title: saved.input.title, style: saved.input.style,
          assets: [
            expect.objectContaining({ assetId: first.asset?.assetId, clientFileId: first.id, description }),
            expect.objectContaining({ assetId: second.asset?.assetId, clientFileId: second.id, description: '' }),
          ],
        });
        expect(services.build).toHaveBeenCalledTimes(buildCount + 1);
        expect(controller.getSnapshot().managing).toBe(false);
        expect(getDraft().input.assets[0].description).toBe(description);
        expect(services.apply).toHaveBeenCalledTimes(description ? 0 : 1);

        const candidate = getDraft();
        await controller.apply();
        expect(services.apply).toHaveBeenLastCalledWith('token', 'draft-1', {
          expectedRevision: candidate.revision, requestId: expect.any(String),
        });
        await controller.reload();
        expect(controller.getSnapshot().draft?.status).toBe('ready');
        expect(controller.getSnapshot().items[0]).toMatchObject({
          id: first.id, status: 'succeeded', asset: { assetId: first.asset?.assetId, description },
        });
        expect(controller.getSnapshot().items[0].file).toBeUndefined();
        expect(services.patch).toHaveBeenCalledTimes(patchCount + 1);
        expect(services.build).toHaveBeenCalledTimes(buildCount + 1);
        expect(services.upload).toHaveBeenCalledTimes(2);
        expect(services.publish).not.toHaveBeenCalled();
      }
      expect(services.apply).toHaveBeenCalledTimes(2);
    } finally {
      stop();
    }
  });

  it('limits descriptions to 5000 characters and ignores unsuccessful or unknown artwork', async () => {
    const { controller, services } = fixture();
    services.upload.mockRejectedValueOnce(new Error('network'));
    const stop = controller.activate();
    try {
      await controller.addFiles([image('failed.png'), image('saved.png')]);
      await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('needs_attention'));
      const [failed, saved] = controller.getSnapshot().items;
      const patchCount = services.patch.mock.calls.length;
      controller.setDescription(failed.id, 'Not uploaded');
      controller.setDescription('unknown-artwork', 'Unknown');
      controller.setDescription(saved.id, '作'.repeat(5001));
      await Promise.resolve();
      expect(controller.getSnapshot().items[0]).toEqual(failed);
      expect(controller.getSnapshot().items[1].asset?.description).toBe('作'.repeat(5000));
      expect(controller.getSnapshot().items).toHaveLength(2);
      expect(services.patch).toHaveBeenCalledTimes(patchCount);
      expect(services.build).not.toHaveBeenCalled();
      expect(services.publish).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  });

  it.each(['Newer typing while saving', ''])('preserves a newer description %j when an older PATCH response arrives', async (description) => {
    const { controller, services, getDraft, setDraft } = fixture();
    const response = deferred<QuickExhibitionDraft>();
    const stop = controller.activate();
    try {
      await controller.addFiles([image('original.png')]);
      await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
      const saved = getDraft();
      setDraft({ ...saved, input: { ...saved.input, assets: saved.input.assets.map((asset) => ({ ...asset, description: 'Saved description' })) } });
      await controller.reload();
      const item = controller.getSnapshot().items[0];
      const patch = services.patch.getMockImplementation()!;
      const patchCount = services.patch.mock.calls.length;
      const buildCount = services.build.mock.calls.length;
      // Persist the submitted input, but delay delivery of that older server snapshot.
      services.patch.mockImplementationOnce(async (token, id, input) => {
        await patch(token, id, input);
        return response.promise;
      });
      controller.manage();
      controller.setDescription(item.id, 'Submitted description');
      controller.retryBuild();
      await vi.waitFor(() => expect(services.patch).toHaveBeenCalledTimes(patchCount + 1));
      const submitted = getDraft();
      expect(submitted.input.assets[0].description).toBe('Submitted description');
      controller.setDescription(item.id, description);
      expect(controller.getSnapshot().items[0].asset?.description).toBe(description);
      expect(submitted.input.assets[0].description).toBe('Submitted description');
      expect(services.build).toHaveBeenCalledTimes(buildCount);

      response.resolve(submitted);
      await vi.waitFor(() => expect(controller.getSnapshot().draft?.status).toBe('candidate_ready'));
      expect(services.patch).toHaveBeenCalledTimes(patchCount + 2);
      expect(services.patch).toHaveBeenLastCalledWith('token', 'draft-1', expect.objectContaining({
        expectedRevision: submitted.revision,
        assets: [expect.objectContaining({ assetId: item.asset?.assetId, clientFileId: item.id, description })],
      }));
      expect(controller.getSnapshot().items[0].asset?.description).toBe(description);
      expect(getDraft().input.assets[0].description).toBe(description);
      expect(services.build).toHaveBeenCalledTimes(buildCount + 1);
      expect(services.build).toHaveBeenLastCalledWith('token', 'draft-1', {
        expectedRevision: submitted.revision + 1, requestId: expect.any(String),
      });
      expect(services.upload).toHaveBeenCalledOnce();
      expect(services.apply).not.toHaveBeenCalled();
      expect(services.publish).not.toHaveBeenCalled();
    } finally {
      stop();
      response.resolve(getDraft());
    }
  });

  it('preserves a newer artwork title and cleared artist while PATCH is in flight', async () => {
    const { controller, services, getDraft, setDraft } = fixture();
    const response = deferred<QuickExhibitionDraft>();
    const stop = controller.activate();
    try {
      await controller.addFiles([image('original.png')]);
      await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
      const saved = getDraft();
      setDraft({ ...saved, input: { ...saved.input, assets: saved.input.assets.map((asset) => ({
        ...asset, artist: 'Original artist', description: 'Original artwork description',
      })) } });
      await controller.reload();
      const item = controller.getSnapshot().items[0];
      const patch = services.patch.getMockImplementation()!;
      const patchCount = services.patch.mock.calls.length;
      const buildCount = services.build.mock.calls.length;
      services.patch.mockImplementationOnce(async (token, id, input) => {
        await patch(token, id, input);
        return response.promise;
      });

      controller.manage();
      controller.setArtworkTitle(item.id, 'Submitted title');
      controller.setArtist(item.id, 'Submitted artist');
      controller.retryBuild();
      await vi.waitFor(() => expect(services.patch).toHaveBeenCalledTimes(patchCount + 1));
      const submitted = getDraft();
      expect(submitted.input.assets[0]).toMatchObject({
        title: 'Submitted title', artist: 'Submitted artist', description: 'Original artwork description',
      });
      controller.setArtworkTitle(item.id, 'Newer title');
      controller.setArtist(item.id, '');
      const expected = { ...item.asset, title: 'Newer title', artist: '' };
      expect(controller.getSnapshot().items[0].asset).toEqual(expected);
      expect(services.build).toHaveBeenCalledTimes(buildCount);

      response.resolve(submitted);
      await vi.waitFor(() => expect(controller.getSnapshot().draft?.status).toBe('candidate_ready'));
      expect(services.patch).toHaveBeenCalledTimes(patchCount + 2);
      expect(services.patch).toHaveBeenLastCalledWith('token', 'draft-1', expect.objectContaining({
        expectedRevision: submitted.revision,
        assets: [expect.objectContaining({ assetId: item.asset?.assetId, clientFileId: item.id,
          title: 'Newer title', artist: '', description: 'Original artwork description' })],
      }));
      expect(controller.getSnapshot().items[0].asset).toEqual(expected);
      expect(getDraft().input.assets[0]).toEqual(expected);
      expect(services.build).toHaveBeenCalledTimes(buildCount + 1);
      expect(services.build).toHaveBeenLastCalledWith('token', 'draft-1', {
        expectedRevision: submitted.revision + 1, requestId: expect.any(String),
      });
      expect(services.upload).toHaveBeenCalledOnce();
    } finally {
      stop();
      response.resolve(getDraft());
    }
  });

  it('accepts a filename fallback and trimmed artist from a normalized PATCH response', async () => {
    const { controller, services, getDraft, setDraft } = fixture();
    const stop = controller.activate();
    try {
      await controller.addFiles([image('original.png')]);
      await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
      const item = controller.getSnapshot().items[0];
      const patch = services.patch.getMockImplementation()!;
      const patchCount = services.patch.mock.calls.length;
      const buildCount = services.build.mock.calls.length;
      services.patch.mockImplementationOnce(async (token, id, input) => {
        const updated = await patch(token, id, input);
        setDraft({ ...updated, input: { ...updated.input, assets: updated.input.assets.map((asset) => ({
          ...asset, title: 'original', artist: 'Lin Mei',
        })) } });
        return getDraft();
      });
      controller.manage();
      controller.setArtworkTitle(item.id, '');
      controller.setArtist(item.id, '  Lin Mei  ');
      controller.retryBuild();

      await vi.waitFor(() => expect(controller.getSnapshot().draft?.status).toBe('candidate_ready'));
      expect(services.patch.mock.calls[patchCount][2].assets).toEqual([
        expect.objectContaining({ title: '', artist: '  Lin Mei  ', description: '' }),
      ]);
      const expected = { ...item.asset, title: 'original', artist: 'Lin Mei' };
      expect(controller.getSnapshot().items[0].asset).toEqual(expected);
      expect(getDraft().input.assets[0]).toEqual(expected);
      expect(services.patch.mock.calls.length - patchCount).toBeLessThanOrEqual(2);
      expect(services.build).toHaveBeenCalledTimes(buildCount + 1);
      expect(services.upload).toHaveBeenCalledOnce();
    } finally {
      stop();
    }
  });

  it('rebuilds a candidate when a description is reverted to the original while PATCH is in flight', async () => {
    const { controller, services, getDraft, setDraft } = fixture();
    const response = deferred<QuickExhibitionDraft>();
    const stop = controller.activate();
    try {
      await controller.addFiles([image('original.png')]);
      await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
      const original = getDraft();
      const item = controller.getSnapshot().items[0];
      const originalDescription = original.input.assets[0].description;
      const patch = services.patch.getMockImplementation()!;
      const build = services.build.getMockImplementation()!;
      const patchCount = services.patch.mock.calls.length;
      const buildCount = services.build.mock.calls.length;
      let holdResponse = true;
      // Actual PATCH clears the draft result; the applied gallery scene still exists.
      services.patch.mockImplementation(async (token, id, input) => {
        const updated = await patch(token, id, input);
        setDraft({ ...updated, result: null });
        if (holdResponse) {
          holdResponse = false;
          return response.promise;
        }
        return getDraft();
      });
      services.build.mockImplementation(async () => {
        const built = await build();
        setDraft({ ...built, status: 'candidate_ready' });
        return getDraft();
      });

      controller.manage();
      controller.setDescription(item.id, 'Temporary description');
      controller.retryBuild();
      await vi.waitFor(() => expect(getDraft().result).toBeNull());
      const submitted = getDraft();
      expect(submitted.status).toBe('collecting');
      expect(submitted.input.assets[0].description).toBe('Temporary description');
      controller.setDescription(item.id, originalDescription);
      expect(controller.getSnapshot().items[0].asset?.description).toBe(originalDescription);
      expect(services.build).toHaveBeenCalledTimes(buildCount);

      response.resolve(submitted);
      await vi.waitFor(() => expect(controller.getSnapshot().draft?.status).toBe('candidate_ready'));
      expect(services.patch).toHaveBeenCalledTimes(patchCount + 2);
      expect(services.patch).toHaveBeenLastCalledWith('token', 'draft-1', expect.objectContaining({
        expectedRevision: submitted.revision,
        assets: [expect.objectContaining({ assetId: item.asset?.assetId, description: originalDescription })],
      }));
      expect(services.build).toHaveBeenCalledTimes(buildCount + 1);
      expect(services.build).toHaveBeenLastCalledWith('token', 'draft-1', {
        expectedRevision: submitted.revision + 1, requestId: expect.any(String),
      });
      expect(controller.getSnapshot()).toMatchObject({ phase: 'preview', managing: false });
      expect(controller.getSnapshot().draft?.input.assets).toEqual(original.input.assets);
      expect(controller.getSnapshot().draft?.result?.includedAssetIds).toEqual(original.result?.includedAssetIds);
      expect(services.upload).toHaveBeenCalledOnce();
      expect(services.apply).not.toHaveBeenCalled();
      expect(services.publish).not.toHaveBeenCalled();
    } finally {
      stop();
      response.resolve(getDraft());
    }
  });

  it.each(['loading', 'building', 'publishing', 'published'] as const)('ignores description edits while %s', async (phase) => {
    const { controller, services, getDraft, setDraft } = fixture();
    const pending = deferred<QuickExhibitionDraft>();
    const stop = controller.activate();
    try {
      await controller.addFiles([image('original.png')]);
      await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
      const item = controller.getSnapshot().items[0];
      if (phase === 'loading') {
        services.get.mockReturnValueOnce(pending.promise);
        void controller.reload();
      } else if (phase === 'building') {
        services.build.mockReturnValueOnce(pending.promise);
        controller.setTitle('Updated title');
        controller.retryBuild();
      } else if (phase === 'publishing') {
        services.publish.mockImplementationOnce(async () => { await pending.promise; return { gallery: {} as never }; });
        void controller.publish();
      } else {
        setDraft({ ...getDraft(), status: 'published' });
        await controller.reload();
      }
      await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe(phase));
      controller.setDescription(item.id, 'Must remain unchanged');
      expect(controller.getSnapshot().items[0].asset?.description).toBe('');
      expect(controller.getSnapshot().draft?.input.assets[0].description).toBe('');
      expect(services.upload).toHaveBeenCalledOnce();
    } finally {
      stop();
      pending.resolve(getDraft());
    }
  });

  it('restores the applied artwork list when keeping the current version', async () => {
    const { controller, services, getDraft } = fixture();
    const stop = controller.activate();
    await controller.addFiles([image('original.png')]);
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
    const original = getDraft();
    await controller.addFiles([image('candidate.png')]);
    await vi.waitFor(() => expect(controller.getSnapshot().draft?.status).toBe('candidate_ready'));
    services.discard.mockResolvedValueOnce({ ...original, revision: getDraft().revision + 1 });
    await controller.discard();
    expect(controller.getSnapshot().items.map((item) => item.fileName)).toEqual(['original.png']);
    expect(controller.getSnapshot().draft?.status).toBe('ready');
    expect(JSON.parse(sessionStorage.getItem('quick-exhibition:user-1:draft-1')!)).toHaveLength(1);
    await controller.publish();
    expect(services.publish).toHaveBeenCalledOnce();
    stop();
  });

  it('does not apply a late upload to an unmounted route', async () => {
    const { controller, services } = fixture();
    const upload = services.upload.getMockImplementation()!;
    let release!: () => void;
    services.upload.mockImplementation(async (token, file) => { await new Promise<void>((resolve) => { release = resolve; }); return upload(token, file); });
    const stop = controller.activate();
    await controller.addFiles([image('late.png')]);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    stop(); release();
    await Promise.resolve(); await Promise.resolve();
    expect(services.patch).not.toHaveBeenCalled();
    expect(services.build).not.toHaveBeenCalled();
  });

  it('stops on conflicts and retries an uncertain build with the same request ID', async () => {
    const { controller, services } = fixture();
    const build = services.build.getMockImplementation()!;
    services.build.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'REQUEST_TIMEOUT' })).mockImplementation(build);
    const stop = controller.activate();
    await controller.addFiles([image('one.png')]);
    await vi.waitFor(() => expect(controller.getSnapshot().error?.code).toBe('REQUEST_TIMEOUT'));
    controller.retryBuild();
    await vi.waitFor(() => expect(controller.getSnapshot().phase).toBe('preview'));
    expect(services.build.mock.calls[0]).toEqual(services.build.mock.calls[1]);
    controller.manage(); controller.setTitle('new');
    services.patch.mockRejectedValueOnce(Object.assign(new Error('changed'), { code: 'DRAFT_CHANGED' }));
    controller.retryBuild();
    await vi.waitFor(() => expect(controller.getSnapshot().error?.code).toBe('DRAFT_CHANGED'));
    expect(services.build).toHaveBeenCalledTimes(2);
    stop();
  });
});
