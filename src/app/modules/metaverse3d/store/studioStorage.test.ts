import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStudioStorage } from './studioStorage';
import { createDemoScene } from '@/app/features/public-demo/demoScene';

afterEach(() => { history.replaceState(null, '', '/'); localStorage.clear(); vi.resetModules(); });

describe('native demo document storage', () => {
  it.each(['/demo/participate', '/demo/participate/'])('never hydrates, migrates or writes a draft at %s', async path => {
    const saved = JSON.stringify({ version: 0, state: { items: [{ id: 'private-draft' }] } });
    localStorage.setItem('metaverse-exhibition-storage', saved);
    history.replaceState(null, '', path);
    vi.resetModules();
    const { useMetaverseStudioStore: store } = await import('./useMetaverseStudioStore');
    expect(store.getState().items.some(item => item.id === 'private-draft')).toBe(false);
    store.getState().importScene(createDemoScene(key => key, 'garden'));
    store.getState().setMode('view');
    store.getState().setAgent({ participationMode: 'ai', enabled: true });
    await store.persist.rehydrate();
    expect(localStorage.getItem('metaverse-exhibition-storage')).toBe(saved);
    expect(store.getState().items).toHaveLength(11);
    history.replaceState(null, '', '/demo');
    expect(getStudioStorage().getItem('metaverse-exhibition-storage')).toBe(saved);
  });
  it('retains normal editor persistence outside the dedicated demo document', () => {
    history.replaceState(null, '', '/virtual-gallery/create');
    getStudioStorage().setItem('draft-test', 'saved');
    expect(localStorage.getItem('draft-test')).toBe('saved');
  });
});
