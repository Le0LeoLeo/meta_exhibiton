import { useMemo, useRef, useState } from 'react';

type Draft = { name: string; content: string };
const emptyDraft: Draft = { name: '', content: '' };
const prefix = 'metaexb-comment-draft-v1:';
const maxAge = 24 * 60 * 60 * 1000;

export function commentDraftKey(owner: string | null, gallery: string, artwork: string) {
  // Identifiers only: never persist an authentication or share token.
  return prefix + JSON.stringify([owner, gallery, artwork]);
}

export function readCommentDraft(key: string): Draft {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw || raw.length > 16000) return emptyDraft;
    const value = JSON.parse(raw);
    if (!value || typeof value.name !== 'string' || value.name.length > 80
      || typeof value.content !== 'string' || value.content.length > 2000
      || !Number.isFinite(value.savedAt) || Date.now() - value.savedAt > maxAge
      || value.savedAt > Date.now() + 60000) return emptyDraft;
    return { name: value.name, content: value.content };
  } catch { return emptyDraft; }
}

function writeCommentDraft(key: string, draft: Draft): boolean {
  try {
    if (!draft.name && !draft.content) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export function useCommentDraft(owner: string | null, gallery: string, artwork: string) {
  const key = commentDraftKey(owner, gallery, artwork);
  const restored = useMemo(() => readCommentDraft(key), [key]);
  const latest = useRef<Record<string, Draft>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const draft = drafts[key] ?? restored;

  const update = (next: Draft) => {
    latest.current[key] = next;
    // Flush on the input event, so a reload need not wait for a debounce/effect.
    const persisted = Boolean(gallery && artwork) && writeCommentDraft(key, next);
    setDrafts((current) => ({ ...current, [key]: next }));
    setSaved((current) => ({ ...current, [key]: persisted }));
  };

  return {
    name: draft.name,
    content: draft.content,
    saved: saved[key] ?? Boolean(restored.name || restored.content),
    setName: (name: string) => update({ ...(latest.current[key] ?? restored), name }),
    setContent: (content: string) => update({ ...(latest.current[key] ?? restored), content }),
    clearSubmitted: (name: string, content: string) => {
      const current = latest.current[key] ?? restored;
      if (current.name.trim() === name && current.content.trim() === content) update(emptyDraft);
    },
  };
}
