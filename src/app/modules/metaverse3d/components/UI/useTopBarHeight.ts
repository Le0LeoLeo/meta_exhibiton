import { RefObject, useEffect } from "react";

type Options = {
  topBarRef: RefObject<HTMLDivElement | null>;
  active: boolean;
};

export function useTopBarHeight({ topBarRef, active }: Options) {
  useEffect(() => {
    if (!active) return;

    let observer: ResizeObserver | null = null;
    let rafId = 0;
    const root = document.documentElement;

    const syncHeight = () => {
      const el = topBarRef.current;
      if (!el) return;
      const height = Math.ceil(el.getBoundingClientRect().height);
      root.style.setProperty("--top-bar-height", `${height}px`);
    };

    const scheduleSync = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(syncHeight);
    };

    scheduleSync();

    const attach = () => {
      const el = topBarRef.current;
      if (!el) {
        rafId = requestAnimationFrame(attach);
        return;
      }
      observer = new ResizeObserver(scheduleSync);
      observer.observe(el);
      window.addEventListener("resize", scheduleSync);
      scheduleSync();
    };

    attach();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleSync);
    };
  }, [active, topBarRef]);
}
