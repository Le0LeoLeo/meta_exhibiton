import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};
type LandscapeStatus = "ready" | "requesting" | "locked" | "manual";
const MOBILE_QUERY = "(pointer: coarse)";
// Some browsers and in-app webviews never settle these promises; fall back to manual rotation.
export const LANDSCAPE_REQUEST_TIMEOUT_MS = 4000;

function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Timed out")), ms);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (reason) => { window.clearTimeout(timer); reject(reason); },
    );
  });
}

function subscribeMobile(onChange: () => void) {
  const query = window.matchMedia?.(MOBILE_QUERY);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/** Own only this visit's screen lock and fullscreen session. Call request from a user gesture. */
export function useLandscapeViewing(enabled: boolean) {
  const isMobile = useSyncExternalStore(subscribeMobile,
    () => window.matchMedia?.(MOBILE_QUERY).matches ?? false, () => false);
  const [status, setStatus] = useState<LandscapeStatus>("ready");
  const requestRef = useRef<(() => Promise<void>) | null>(null);
  const canLock = typeof window !== "undefined"
    && typeof (window.screen.orientation as LockableOrientation | undefined)?.lock === "function";

  useEffect(() => {
    if (!enabled || !isMobile) return;
    let active = true;
    let pending = false;
    let ownsFullscreen = false;
    let lockRequested = false;
    const root = document.documentElement;
    const orientation = window.screen.orientation as LockableOrientation | undefined;
    setStatus("ready");

    const unlock = () => {
      if (!lockRequested) return;
      lockRequested = false;
      try { orientation?.unlock(); } catch { /* The document may already be inactive. */ }
    };
    const exitOwnedFullscreen = async () => {
      const shouldExit = ownsFullscreen && document.fullscreenElement === root;
      ownsFullscreen = false;
      if (shouldExit) {
        try { await document.exitFullscreen(); } catch { /* Browser may have exited already. */ }
      }
    };
    const onFullscreenChange = () => {
      if (document.fullscreenElement) return;
      ownsFullscreen = false;
      unlock();
      if (active && !pending) setStatus((current) => current === "manual" ? current : "ready");
    };

    requestRef.current = async () => {
      if (!active || pending) return;
      if (!orientation?.lock) { setStatus("manual"); return; }
      pending = true;
      setStatus("requesting");
      try {
        // Fullscreen needs transient activation, so request it before the first await.
        // Use the document root to keep the page's exit and 2D buttons accessible.
        if (!document.fullscreenElement && root.requestFullscreen) {
          try {
            await settleWithin(root.requestFullscreen(), LANDSCAPE_REQUEST_TIMEOUT_MS);
            ownsFullscreen = document.fullscreenElement === root;
          } catch { /* Installed apps may allow locking without fullscreen. */ }
        }
        if (!active) { await exitOwnedFullscreen(); return; }
        lockRequested = true;
        await settleWithin(orientation.lock("landscape"), LANDSCAPE_REQUEST_TIMEOUT_MS);
        if (!active) { unlock(); await exitOwnedFullscreen(); return; }
        if (!lockRequested) { setStatus("ready"); return; }
        setStatus("locked");
      } catch {
        unlock();
        await exitOwnedFullscreen();
        if (active) setStatus("manual");
      } finally {
        pending = false;
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      active = false;
      requestRef.current = null;
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      unlock();
      void exitOwnedFullscreen();
    };
  }, [enabled, isMobile]);

  const requestLandscape = useCallback(() => { void requestRef.current?.(); }, []);
  return { isMobile, status, canLock, requestLandscape };
}
