import { useEffect, type RefObject } from 'react';

/** Animate each exhibition section once. Content stays usable before observation. */
export function useExhibitionReveals(root: RefObject<HTMLDivElement>, contentState: string) {
  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('museum-revealed');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    root.current.querySelectorAll('[data-museum-reveal]:not(.museum-revealed)').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [root, contentState]);
}
