import { create } from 'zustand';
import type { SceneSnapshot } from './protocol';

export type ReconnectDraft = {
  roomId: string;
  base: SceneSnapshot;
  remote: SceneSnapshot | null;
  uncertain: boolean;
};

export const useReconnectDraftStore = create<{
  draft: ReconnectDraft | null;
  decision: 'merge' | 'remote' | null;
}>(() => ({ draft: null, decision: null }));

export function clearReconnectDraft() {
  useReconnectDraftStore.setState({ draft: null, decision: null });
}

export function isReconnectReviewPending() {
  return useReconnectDraftStore.getState().draft !== null;
}
