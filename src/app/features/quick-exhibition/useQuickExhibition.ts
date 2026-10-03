import { useEffect, useState, useSyncExternalStore } from 'react';
import { uploadMediaAsset } from '@/app/api/media';
import { publishGalleryById } from '@/app/api/gallery';
import { applyQuickExhibition, buildQuickExhibition, createQuickExhibition, discardQuickExhibition, getQuickExhibition, patchQuickExhibition } from '@/app/api/quickExhibition';
import { canBuildAutomatically, QUICK_EXHIBITION_MAX_ARTWORK_TEXT_LENGTH, QUICK_EXHIBITION_MAX_DESCRIPTION_LENGTH, quickInputKey, restoreQuickItems, uploadedAssetInputs, validateQuickFiles } from './quickExhibitionState';
import { createUploadQueue } from './uploadQueue';
import type { QuickExhibitionDraft, QuickExhibitionLanguage, QuickExhibitionPhase, QuickExhibitionStyle, QuickUploadItem } from './types';

const defaultServices = {
  upload: uploadMediaAsset, create: createQuickExhibition, get: getQuickExhibition,
  patch: patchQuickExhibition, build: buildQuickExhibition, apply: applyQuickExhibition, discard: discardQuickExhibition, publish: publishGalleryById,
};

type Services = typeof defaultServices;
type Options = {
  requireTemplateChoice?: boolean;
  token: string;
  userId: string;
  draftId: string;
  resume: boolean;
  language: QuickExhibitionLanguage;
  onCreated?: (draftId: string) => void;
  services?: Services;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
};

type QuickState = {
  style: QuickExhibitionStyle;
  templateChosen: boolean;
  draft: QuickExhibitionDraft | null;
  items: QuickUploadItem[];
  title: string;
  phase: QuickExhibitionPhase;
  error: { code: string; message?: string; galleryId?: string } | null;
  managing: boolean;
};

function errorDetails(error: unknown) {
  const value = error as { code?: string; status?: number; message?: string; galleryId?: string };
  return { code: value?.status === 401 ? 'AUTH_REQUIRED' : value?.code || 'QUICK_EXHIBITION_FAILED', message: value?.message, galleryId: value?.galleryId };
}

/** Owns one route's work. It never reads or writes the global studio scene. */
export class QuickExhibitionController {
  private state: QuickState;
  private listeners = new Set<() => void>();
  private services: Services;
  private queue = createUploadQueue();
  private epoch = 0;
  private active = false;
  private creating: Promise<QuickExhibitionDraft> | null = null;
  private syncing = false;
  private syncedKey = '';
  private previewRequested = false;
  private layoutKey = '';
  private objectUrls = new Set<string>();
  private buildRequest: { requestId: string; expectedRevision: number } | null = null;

  constructor(private options: Options) {
    this.services = options.services ?? defaultServices;
    this.state = { style: 'white-box', templateChosen: !options.requireTemplateChoice, draft: null, items: [], title: '', phase: options.resume ? 'loading' : 'empty', error: null, managing: true };
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private set(patch: Partial<QuickState>) {
    if (!this.active) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
    if (patch.items) {
      try {
        this.options.storage?.setItem(this.storageKey, JSON.stringify(this.state.items.map(({ id, fileName }) => ({ id, fileName }))));
      } catch { /* The server remains authoritative when browser storage is unavailable. */ }
    }
  }

  private get storageKey() { return `quick-exhibition:${this.options.userId}:${this.options.draftId}`; }
  private isCurrent(epoch: number) { return this.active && this.epoch === epoch; }
  private get locked() { return this.state.error?.code === 'DRAFT_EDITOR_MANAGED' || ['loading', 'building', 'publishing', 'published'].includes(this.state.phase); }

  activate = () => {
    this.active = true;
    this.epoch += 1;
    this.queue = createUploadQueue();
    if (this.options.resume) void this.reload();
    return () => {
      this.active = false;
      this.epoch += 1;
      this.queue.stop();
      for (const url of this.objectUrls) URL.revokeObjectURL(url);
      this.objectUrls.clear();
    };
  };

  reload = async () => {
    const epoch = this.epoch;
    this.set({ phase: 'loading', error: null });
    try {
      const draft = await this.services.get(this.options.token, this.options.draftId);
      if (!this.isCurrent(epoch)) return;
      let pending: Pick<QuickUploadItem, 'id' | 'fileName'>[] = [];
      try {
        const parsed: unknown = JSON.parse(this.options.storage?.getItem(this.storageKey) || '[]');
        if (Array.isArray(parsed)) pending = parsed.filter((item) => typeof item?.id === 'string' && typeof item?.fileName === 'string');
      } catch { /* Ignore malformed local recovery data. */ }
      const items = restoreQuickItems(draft, pending);
      this.syncedKey = quickInputKey(items, draft.input.title, draft.input.style);
      const needsFiles = items.some((item) => item.status === 'missing');
      this.layoutKey = draft.result && draft.status !== 'collecting' ? this.syncedKey : '';
      this.set({ draft, items, style: draft.input.style, templateChosen: Boolean(draft.result) || !this.options.requireTemplateChoice, title: draft.input.title, managing: !draft.result || needsFiles,
        phase: needsFiles ? 'needs_attention' : draft.status === 'published' ? 'published' : draft.result ? 'preview' : 'empty',
        error: needsFiles ? { code: 'FILE_RESELECT_REQUIRED' } : null });
      if (!needsFiles && draft.status === 'collecting' && canBuildAutomatically(items)) void this.reconcile();
    } catch (error) {
      if (this.isCurrent(epoch)) this.set({ phase: 'needs_attention', error: errorDetails(error) });
    }
  };

  private ensureDraft() {
    if (this.state.draft) return Promise.resolve(this.state.draft);
    if (this.creating) return this.creating;
    const epoch = this.epoch;
    this.creating = this.services.create(this.options.token, this.options.draftId, {
      title: this.state.title, language: this.options.language,
    }).then((draft) => {
      if (this.isCurrent(epoch)) {
        this.set({ draft });
        this.options.onCreated?.(draft.draftId);
      }
      return draft;
    }).finally(() => { this.creating = null; });
    return this.creating;
  }

  get hasUnsavedChanges() { return this.syncedKey !== quickInputKey(this.state.items, this.state.title, this.state.style); }

  setStyle = (style: QuickExhibitionStyle) => {
    if (this.locked) return;
    this.set({ style, templateChosen: true, error: null });
  };

  setTitle = (title: string) => {
    if (this.locked) return;
    this.set({ title: title.slice(0, 120), error: null });
  };

  private setArtworkField(id: string, field: 'title' | 'artist' | 'description', value: string) {
    if (this.locked) return;
    const item = this.state.items.find((entry) => entry.id === id);
    if (item?.status !== 'succeeded' || !item.asset) return;
    const maxLength = field === 'description' ? QUICK_EXHIBITION_MAX_DESCRIPTION_LENGTH : QUICK_EXHIBITION_MAX_ARTWORK_TEXT_LENGTH;
    this.updateItem(id, { asset: { ...item.asset, [field]: value.slice(0, maxLength) } });
  }

  setArtworkTitle = (id: string, title: string) => { this.setArtworkField(id, 'title', title); };
  setArtist = (id: string, artist: string) => { this.setArtworkField(id, 'artist', artist); };
  setDescription = (id: string, description: string) => { this.setArtworkField(id, 'description', description); };

  manage = () => { if (!this.locked) this.set({ managing: true }); };
  showPreview = () => {
    this.previewRequested = true;
    if (this.state.draft?.result && !this.locked) void this.reconcile();
  };

  addFiles = async (files: File[]) => {
    if (!files.length || this.locked) return;
    const limits = this.state.draft?.limits;
    const invalid = validateQuickFiles(files, this.state.items.length, limits?.maxAssets, limits?.maxFileBytes);
    if (invalid) { this.set({ error: { code: invalid } }); return; }
    const added: QuickUploadItem[] = files.map((file) => {
      const previewUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined;
      if (previewUrl) this.objectUrls.add(previewUrl);
      return { id: crypto.randomUUID(), fileName: file.name, file, previewUrl, status: 'pending' };
    });
    this.set({ items: [...this.state.items, ...added], phase: 'uploading', error: null, managing: true });
    const epoch = this.epoch;
    try {
      await this.ensureDraft();
      if (!this.isCurrent(epoch)) return;
      for (const item of added) this.enqueue(item.id);
    } catch (error) {
      if (!this.isCurrent(epoch)) return;
      const ids = new Set(added.map((item) => item.id));
      this.set({ items: this.state.items.map((item) => ids.has(item.id) ? { ...item, status: 'failed', error: 'DRAFT_CREATE_FAILED' } : item), phase: 'needs_attention', error: errorDetails(error) });
    }
  };

  private updateItem(id: string, patch: Partial<QuickUploadItem>) {
    this.set({ items: this.state.items.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  private enqueue(id: string) {
    const epoch = this.epoch;
    void this.queue.add(async () => {
      const item = this.state.items.find((entry) => entry.id === id);
      if (!this.isCurrent(epoch) || !item?.file) return;
      this.updateItem(id, { status: 'uploading', error: undefined });
      try {
        const media = await this.services.upload(this.options.token, item.file);
        if (!this.isCurrent(epoch)) return;
        this.updateItem(id, { status: 'succeeded', previewUrl: media.previewUrl || media.url, asset: {
          assetId: media.id, clientFileId: id, order: this.state.items.findIndex((entry) => entry.id === id),
          fileName: media.originalFileName, mimeType: media.mimeType, width: media.width ?? 0, height: media.height ?? 0,
          title: item.fileName.replace(/\.[^.]+$/, '').slice(0, 200), artist: '', description: '', url: media.url, previewUrl: media.previewUrl,
        } });
      } catch (error) {
        if (this.isCurrent(epoch)) this.updateItem(id, { status: 'failed', error: errorDetails(error).code });
      }
      if (this.isCurrent(epoch)) void this.reconcile();
    }).catch(() => { /* Queued jobs are intentionally rejected when the route unmounts. */ });
  }

  retryItem = async (id: string) => {
    if (this.locked) return;
    const item = this.state.items.find((entry) => entry.id === id);
    if (!item?.file || item.status !== 'failed') return;
    this.updateItem(id, { status: 'pending', error: undefined });
    this.set({ phase: 'uploading', error: null });
    try { await this.ensureDraft(); this.enqueue(id); }
    catch (error) { this.updateItem(id, { status: 'failed' }); this.set({ phase: 'needs_attention', error: errorDetails(error) }); }
  };

  removeItem = (id: string) => {
    if (this.locked) return;
    const item = this.state.items.find((entry) => entry.id === id);
    if (!item || item.status === 'uploading') return;
    this.set({ items: this.state.items.filter((entry) => entry.id !== id), error: null });
    // Removing from this draft is not permission to destroy a media file used by a saved scene.
    void this.reconcile();
  };

  retryBuild = () => {
    if (this.locked || !this.state.templateChosen) return;
    this.previewRequested = true;
    this.layoutKey = '';
    this.set({ error: null });
    void this.reconcile();
  };

  private async reconcile() {
    if (this.syncing || !this.active || this.locked) return;
    this.syncing = true;
    const epoch = this.epoch;
    try {
      await this.ensureDraft();
      if (!this.isCurrent(epoch)) return;
      let key = quickInputKey(this.state.items, this.state.title, this.state.style);
      while (key !== this.syncedKey) {
        const draft = this.state.draft!;
        const assets = uploadedAssetInputs(this.state.items);
        const submittedAssets = new Map(assets.map((asset) => [asset.clientFileId, asset]));
        const next = await this.services.patch(this.options.token, draft.draftId, {
          expectedRevision: draft.revision, title: this.state.title.trim(), style: this.state.style, assets,
        });
        if (!this.isCurrent(epoch)) return;
        this.syncedKey = key;
        const refreshed = new Map(next.input.assets.map((asset) => [asset.clientFileId, asset]));
        this.set({ draft: next, items: this.state.items.map((item) => {
          const asset = refreshed.get(item.id);
          if (!asset) return item;
          // Keep text entered while this save was in flight for the next pass.
          const submitted = submittedAssets.get(item.id);
          const updated = { ...asset };
          if (item.asset && submitted) {
            for (const field of ['title', 'artist', 'description'] as const) {
              if (item.asset[field] !== submitted[field]) updated[field] = item.asset[field];
            }
          }
          return { ...item, asset: updated, previewUrl: asset.previewUrl || asset.url };
        }) });
        key = quickInputKey(this.state.items, this.state.title, this.state.style);
      }
      if (!canBuildAutomatically(this.state.items)) {
        this.set({ phase: this.state.items.some((item) => ['pending', 'uploading'].includes(item.status)) ? 'uploading' : this.state.items.length ? 'needs_attention' : 'empty' });
        return;
      }
      if (!this.state.templateChosen || (this.options.requireTemplateChoice && !this.previewRequested)) { this.set({ phase: 'empty' }); return; }
      if (key === this.layoutKey && this.state.draft?.result && this.state.draft.status !== 'collecting') {
        this.set({ phase: 'preview', managing: false }); return;
      }
      this.set({ phase: 'building', error: null });
      const draft = this.state.draft!;
      if (!this.buildRequest || this.buildRequest.expectedRevision !== draft.revision) {
        this.buildRequest = { requestId: crypto.randomUUID(), expectedRevision: draft.revision };
      }
      const completed = await this.services.build(this.options.token, draft.draftId, this.buildRequest);
      if (!this.isCurrent(epoch)) return;
      this.layoutKey = key;
      this.buildRequest = null;
      this.previewRequested = false;
      this.set({ draft: completed, phase: 'preview', managing: false, error: null });
    } catch (error) {
      if (this.isCurrent(epoch)) this.set({ phase: 'needs_attention', error: errorDetails(error) });
    } finally {
      this.syncing = false;
    }
  }

  apply = async () => {
    const draft = this.state.draft;
    if (!draft || draft.status !== 'candidate_ready' || this.locked) return;
    const epoch = this.epoch;
    this.set({ phase: 'building', error: null });
    try {
      const updated = await this.services.apply(this.options.token, draft.draftId, { expectedRevision: draft.revision, requestId: crypto.randomUUID() });
      if (this.isCurrent(epoch)) this.set({ draft: updated, phase: 'preview', error: null });
    } catch (error) {
      if (this.isCurrent(epoch)) this.set({ phase: 'needs_attention', error: errorDetails(error) });
    }
  };

  discard = async () => {
    const draft = this.state.draft;
    if (!draft || draft.status !== 'candidate_ready' || this.locked) return;
    const epoch = this.epoch;
    this.set({ phase: 'building', error: null });
    try {
      const updated = await this.services.discard(this.options.token, draft.draftId, { expectedRevision: draft.revision, requestId: crypto.randomUUID() });
      if (!this.isCurrent(epoch)) return;
      const items = restoreQuickItems(updated, []);
      this.syncedKey = quickInputKey(items, updated.input.title, updated.input.style);
      this.layoutKey = this.syncedKey;
      this.set({ draft: updated, items, style: updated.input.style, templateChosen: true, title: updated.input.title, phase: 'preview', managing: false, error: null });
    } catch (error) {
      if (this.isCurrent(epoch)) this.set({ phase: 'needs_attention', error: errorDetails(error) });
    }
  };

  publish = async () => {
    const draft = this.state.draft;
    if (!draft || draft.status !== 'ready' || this.locked || this.syncedKey !== quickInputKey(this.state.items, this.state.title, this.state.style)) return;
    const epoch = this.epoch;
    this.set({ phase: 'publishing', error: null });
    try {
      await this.services.publish(this.options.token, draft.galleryId);
      if (this.isCurrent(epoch)) this.set({ draft: { ...draft, status: 'published' }, phase: 'published' });
    } catch (error) {
      if (this.isCurrent(epoch)) this.set({ phase: 'needs_attention', error: errorDetails(error) });
    }
  };
}

export function useQuickExhibition(options: Options) {
  const [controller] = useState(() => new QuickExhibitionController(options));
  useEffect(() => controller.activate(), [controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { ...state, controller };
}
