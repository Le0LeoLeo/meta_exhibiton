import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useStore } from '../modules/metaverse3d/store/useStore';
import { editorDraftScope, purgeEditorTabDrafts, readEditorTabDraft, resetEditorTabDraftState, startEditorTabDraftSession, useEditorTabDraftStore, writeEditorTabDraft } from './editorTabDraft';

beforeEach(() => { sessionStorage.clear(); resetEditorTabDraftState(); vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear(); resetEditorTabDraftState(); });
const scene = () => structuredClone(useStore.getState().exportScene());

it('isolates accounts, galleries and shares without retaining access tokens', async () => {
  const scope = await editorDraftScope('account-a', 'gallery-a', 'private-share');
  const other = await editorDraftScope('account-a', 'gallery-a', 'other-share');
  expect(scope.key).not.toContain('private-share'); expect(scope.key).not.toBe(other.key);
  expect(scope.key).not.toBe((await editorDraftScope('account-b', 'gallery-a', 'private-share')).key);
  expect(scope.key).not.toBe((await editorDraftScope('account-a', 'gallery-b', 'private-share')).key);
  const local = scene(); local.items[0].content = '/api/media/11111111-1111-1111-1111-111111111111?shareToken=private-share';
  writeEditorTabDraft(scope, scene(), local);
  expect(sessionStorage.getItem(scope.key)).not.toContain('private-share');
  expect(readEditorTabDraft(scope)?.scene.items[0].content).toBe('/api/media/11111111-1111-1111-1111-111111111111');
  expect(readEditorTabDraft(other)).toBeNull();
});

it('rejects expired, corrupt, future and mismatched-owner records', async () => {
  const scope = await editorDraftScope('account', 'gallery', '');
  for (const patch of [{ savedAt: Date.now() - 86_400_001 }, { savedAt: Date.now() + 120_000 }, { owner: 'other' }, { scene: { items: [] } }]) {
    writeEditorTabDraft(scope, scene(), scene());
    sessionStorage.setItem(scope.key, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(scope.key)!), ...patch }));
    expect(readEditorTabDraft(scope)).toBeNull();
  }
  sessionStorage.setItem(scope.key, '{broken'); expect(readEditorTabDraft(scope)).toBeNull();
});

it('purges other-account records and clears all on logout without touching unrelated storage', async () => {
  const a = await editorDraftScope('a', 'gallery', ''); const b = await editorDraftScope('b', 'gallery', '');
  writeEditorTabDraft(a, scene(), scene()); writeEditorTabDraft(b, scene(), scene()); sessionStorage.setItem('other', 'keep');
  purgeEditorTabDrafts('a'); expect(readEditorTabDraft(a)).not.toBeNull(); expect(readEditorTabDraft(b)).toBeNull();
  purgeEditorTabDrafts(); expect(readEditorTabDraft(a)).toBeNull(); expect(sessionStorage.getItem('other')).toBe('keep');
});

it('flushes edits on pagehide before the debounce and clears only after the same scene is saved', async () => {
  const scope = await editorDraftScope('account', 'gallery', ''); vi.useFakeTimers();
  let current = scene(); let base = scene(); let changed = () => {};
  const session = startEditorTabDraftSession({ scope, read: () => current, baseline: () => base, isCurrent: () => true, subscribe: cb => { changed = cb; return () => {}; } });
  current = { ...current, items: [] }; changed(); window.dispatchEvent(new Event('pagehide'));
  expect(readEditorTabDraft(scope)?.scene.items).toEqual([]);
  expect(readEditorTabDraft(scope)?.base.items.length).toBeGreaterThan(0);
  base = current; session.flush(); expect(readEditorTabDraft(scope)).toBeNull(); session.stop();
});

it('keeps a pending draft intact during remote changes and repeated reloads until explicit discard', async () => {
  const scope = await editorDraftScope('account', 'gallery', ''); const local = scene(); local.items = [];
  writeEditorTabDraft(scope, scene(), local);
  const session = startEditorTabDraftSession({ scope, read: scene, baseline: scene, isCurrent: () => true, subscribe: () => () => {} });
  expect(useEditorTabDraftStore.getState().pending?.scene.items).toEqual([]);
  session.flush(); session.stop(); expect(readEditorTabDraft(scope)?.scene.items).toEqual([]);
  const next = startEditorTabDraftSession({ scope, read: scene, baseline: scene, isCurrent: () => true, subscribe: () => () => {} });
  next.discard(); expect(readEditorTabDraft(scope)).toBeNull(); next.stop();
});

it('reports quota failures, rejects oversized or blob snapshots, and never rewrites after account invalidation', async () => {
  const scope = await editorDraftScope('account', 'gallery', ''); const local = scene(); local.items = [];
  let valid = true;
  const session = startEditorTabDraftSession({ scope, read: () => local, baseline: scene, isCurrent: () => valid, subscribe: () => () => {} });
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
  session.flush(); expect(useEditorTabDraftStore.getState().failed).toBe(true); write.mockRestore();
  valid = false; session.stop(); expect(readEditorTabDraft(scope)).toBeNull();
  const invalid = scene(); invalid.items[0].content = 'blob:temporary';
  expect(() => writeEditorTabDraft(scope, scene(), invalid)).toThrow();
  invalid.items[0].content = 'x'.repeat(1024 * 1024);
  expect(() => writeEditorTabDraft(scope, scene(), invalid)).toThrow();
});
