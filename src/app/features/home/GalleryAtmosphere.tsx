import { useEffect, useRef } from 'react';
import '@/styles/gallery-atmosphere.css';

/** Decorative CSS layers; pause when offscreen, hidden or motion is reduced. */
export function GalleryAtmosphere({ variant = 'light' }: { variant?: 'light' | 'pigment' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const update = () => { element.dataset.running = String(visible && !document.hidden && !preference.matches); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer?.observe(element);
    preference.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer?.disconnect();
      preference.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return <div ref={ref} className={`gallery-atmosphere gallery-atmosphere-${variant}`} aria-hidden="true">
    <div className="gallery-atmosphere-wash" />
    <div className="gallery-atmosphere-window" />
    <div className="gallery-atmosphere-contours"><i/><i/><i/></div>
  </div>;
}
