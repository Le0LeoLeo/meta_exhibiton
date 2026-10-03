import type { StateStorage } from 'zustand/middleware';

const transientStorage: StateStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

/** Demo participation runs in its own document and must never hydrate or overwrite a draft. */
export function getStudioStorage(): StateStorage {
  return /^\/demo\/participate\/?$/.test(window.location.pathname) ? transientStorage : window.localStorage;
}
