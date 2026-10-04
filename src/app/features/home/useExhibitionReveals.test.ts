import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useExhibitionReveals } from './useExhibitionReveals';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('reveals intersecting content once and disconnects on unmount', () => {
  let intersect!: IntersectionObserverCallback;
  const observe = vi.fn(), unobserve = vi.fn(), disconnect = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe = observe; unobserve = unobserve; disconnect = disconnect;
  });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  const root = document.createElement('div'); root.innerHTML = '<section data-museum-reveal>Exhibition</section>';
  const section = root.firstElementChild!;
  const view = renderHook(() => useExhibitionReveals({ current: root }, 'ready'));
  expect(observe).toHaveBeenCalledWith(section);
  expect(section).not.toHaveAttribute('hidden');
  intersect([{ isIntersecting: true, target: section } as IntersectionObserverEntry], {} as IntersectionObserver);
  expect(section).toHaveClass('museum-revealed');
  expect(unobserve).toHaveBeenCalledWith(section);
  view.unmount(); expect(disconnect).toHaveBeenCalledOnce();
});
it('leaves content untouched when reduced motion is requested', () => {
  const observer = vi.fn(); vi.stubGlobal('IntersectionObserver', observer);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  renderHook(() => useExhibitionReveals({ current: document.createElement('div') }, 'ready'));
  expect(observer).not.toHaveBeenCalled();
});
