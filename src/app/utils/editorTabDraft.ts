import { create } from 'zustand';
import { stripMediaAccessTokensFromScene } from '../features/exhibition-wizard/mediaSceneUrls';
import type { SceneSnapshot } from '../modules/metaverse3d/network/protocol';

const PREFIX = 'metaexb-editor-recovery-v1:';
const MAX_CHARS = 1024 * 1024;
const MAX_AGE = 24 * 60 * 60 * 1000;
export type DraftScope = { key: string; owner: string };
export type EditorTabDraft = { version: 1; owner: string; savedAt: number; base: SceneSnapshot; scene: SceneSnapshot };
export const useEditorTabDraftStore = create<{
  pending: EditorTabDraft | null; failed: boolean; available: boolean;
}>(() => ({ pending: null, failed: false, available: false }));
export const isEditorTabDraftPending = () => Boolean(useEditorTabDraftStore.getState().pending);
export const resetEditorTabDraftState = () => useEditorTabDraftStore.setState({ pending: null, failed: false, available: false });

export async function editorDraftScope(owner: string, gallery: string, share: string): Promise<DraftScope> {
  // Never put a bearer share token into storage keys or records.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([owner, gallery, share])));
  return { owner, key: PREFIX + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') };
}
export function purgeEditorTabDrafts(owner?: string) {
  const pending = useEditorTabDraftStore.getState().pending;
  if (pending && pending.owner !== owner) resetEditorTabDraftState();
  try {
    for (const key of Object.keys(sessionStorage).filter(key => key.startsWith(PREFIX))) {
      try { if (owner && JSON.parse(sessionStorage.getItem(key) || 'null')?.owner === owner) continue; } catch { /* Invalid record. */ }
      sessionStorage.removeItem(key);
    }
  } catch { /* Storage may be disabled; authentication must remain available. */ }
}
function isScene(value: unknown): value is SceneSnapshot {
  if (!value || typeof value !== 'object') return false;
  const scene = value as SceneSnapshot;
  return Boolean(scene.roomSize && typeof scene.roomSize === 'object' && !Array.isArray(scene.roomSize)
    && Array.isArray(scene.items) && scene.items.every(item => item && typeof item.id === 'string')
    && Array.isArray(scene.floorPlanElements) && scene.floorPlanElements.every(item => item && typeof item.id === 'string')
    && scene.wallMaterialOverrides && typeof scene.wallMaterialOverrides === 'object');
}
export function readEditorTabDraft(scope: DraftScope): EditorTabDraft | null {
  const raw = sessionStorage.getItem(scope.key);
  if (!raw) return null;
  let draft: EditorTabDraft | null = null;
  try { if (raw.length <= MAX_CHARS) draft = JSON.parse(raw); } catch { /* Reject malformed data. */ }
  if (!draft || draft.version !== 1 || draft.owner !== scope.owner || !Number.isFinite(draft.savedAt)
    || Date.now() - draft.savedAt > MAX_AGE || draft.savedAt > Date.now() + 60_000
    || !isScene(draft.base) || !isScene(draft.scene)) {
    sessionStorage.removeItem(scope.key); return null;
  }
  return draft;
}
export function writeEditorTabDraft(scope: DraftScope, base: SceneSnapshot, scene: SceneSnapshot) {
  const record = JSON.stringify({ version: 1, owner: scope.owner, savedAt: Date.now(),
    base: stripMediaAccessTokensFromScene(base), scene: stripMediaAccessTokensFromScene(scene) });
  // Blob URLs cannot survive a reload; keep the last usable record and show a failure.
  if (record.length > MAX_CHARS || /"blob:/.test(record)) throw new Error('Draft cannot be restored after reload');
  sessionStorage.setItem(scope.key, record);
}
export function startEditorTabDraftSession(options: {
  scope: DraftScope; read: () => SceneSnapshot; baseline: () => SceneSnapshot;
  subscribe: (listener: () => void) => () => void; isCurrent: () => boolean;
}) {
  resetEditorTabDraftState();
  const cleanJson = (scene: SceneSnapshot) => JSON.stringify(stripMediaAccessTokensFromScene(scene));
  try {
    const stored = readEditorTabDraft(options.scope);
    if (stored && cleanJson(stored.scene) !== cleanJson(options.read())) {
      useEditorTabDraftStore.setState({ pending: stored, available: true });
    } else sessionStorage.removeItem(options.scope.key);
  } catch { useEditorTabDraftStore.setState({ failed: true }); }
  let timer: number | undefined;
  let active = true;
  const flush = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    if (!active || !options.isCurrent() || isEditorTabDraftPending()) return;
    try {
      const scene = options.read(); const base = options.baseline();
      const dirty = cleanJson(scene) !== cleanJson(base);
      if (dirty) writeEditorTabDraft(options.scope, base, scene);
      else sessionStorage.removeItem(options.scope.key);
      useEditorTabDraftStore.setState({ available: dirty, failed: false });
    } catch { useEditorTabDraftStore.setState({ failed: true }); }
  };
  const unsubscribe = options.subscribe(() => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(flush, 200);
  });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  return {
    flush,
    discard: () => {
      try { sessionStorage.removeItem(options.scope.key); } catch { useEditorTabDraftStore.setState({ failed: true }); }
      useEditorTabDraftStore.setState({ pending: null, available: false });
    },
    stop: () => {
      flush(); active = false; unsubscribe();
      window.removeEventListener('pagehide', flush); window.removeEventListener('beforeunload', flush);
      resetEditorTabDraftState();
    },
  };
}
