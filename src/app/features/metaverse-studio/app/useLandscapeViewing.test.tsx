import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LANDSCAPE_REQUEST_TIMEOUT_MS, useLandscapeViewing } from "./useLandscapeViewing";

let fullscreen: Element | null;
const lock = vi.fn<() => Promise<void>>();
const unlock = vi.fn();
const enterFullscreen = vi.fn<() => Promise<void>>();
const exitFullscreen = vi.fn<() => Promise<void>>();
const originals = [
  [document, "fullscreenElement"],
  [document, "exitFullscreen"],
  [document.documentElement, "requestFullscreen"],
].map(([target, key]) => ({ target: target as object, key: key as string, descriptor: Object.getOwnPropertyDescriptor(target, key as string) }));

beforeEach(() => {
  fullscreen = null;
  lock.mockReset().mockResolvedValue();
  unlock.mockReset();
  enterFullscreen.mockReset().mockImplementation(async () => { fullscreen = document.documentElement; });
  exitFullscreen.mockReset().mockImplementation(async () => { fullscreen = null; });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreen });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
  Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: enterFullscreen });
  vi.stubGlobal("screen", { orientation: { lock, unlock } });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const { target, key, descriptor } of originals) {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  }
});

describe("mobile landscape viewing", () => {
  it("requests fullscreen synchronously from entry, locks landscape, and releases on leaving view mode", async () => {
    const { result, rerender } = renderHook(({ enabled }) => useLandscapeViewing(enabled), { initialProps: { enabled: true } });
    expect(enterFullscreen).not.toHaveBeenCalled();
    await act(async () => {
      result.current.requestLandscape();
      expect(enterFullscreen).toHaveBeenCalledOnce();
    });
    expect(lock).toHaveBeenCalledWith("landscape");
    expect(result.current.status).toBe("locked");
    rerender({ enabled: false });
    expect(unlock).toHaveBeenCalledOnce();
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  it("falls back without entering fullscreen when orientation locking is absent", async () => {
    vi.stubGlobal("screen", { orientation: { unlock } });
    const { result } = renderHook(() => useLandscapeViewing(true));
    await act(async () => result.current.requestLandscape());
    expect(result.current.status).toBe("manual");
    expect(result.current.canLock).toBe(false);
    expect(enterFullscreen).not.toHaveBeenCalled();
  });

  it("leaves its fullscreen session when locking is rejected", async () => {
    lock.mockRejectedValue(new DOMException("Unsupported", "NotSupportedError"));
    const { result } = renderHook(() => useLandscapeViewing(true));
    await act(async () => result.current.requestLandscape());
    expect(result.current.status).toBe("manual");
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(fullscreen).toBeNull();
  });

  it("can lock in an installed app even when fullscreen is unavailable", async () => {
    enterFullscreen.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    const { result, unmount } = renderHook(() => useLandscapeViewing(true));
    await act(async () => result.current.requestLandscape());
    expect(result.current.status).toBe("locked");
    unmount();
    expect(unlock).toHaveBeenCalledOnce();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it("handles rejection of both APIs without blocking the visit", async () => {
    enterFullscreen.mockRejectedValue(new Error("Denied"));
    lock.mockRejectedValue(new Error("Denied"));
    const { result } = renderHook(() => useLandscapeViewing(true));
    await act(async () => result.current.requestLandscape());
    expect(result.current.status).toBe("manual");
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it("preserves fullscreen that already existed before this visit", async () => {
    fullscreen = document.documentElement;
    const { result, unmount } = renderHook(() => useLandscapeViewing(true));
    await act(async () => result.current.requestLandscape());
    unmount();
    expect(enterFullscreen).not.toHaveBeenCalled();
    expect(exitFullscreen).not.toHaveBeenCalled();
    expect(unlock).toHaveBeenCalledOnce();
  });

  it("does not lock after the visitor leaves while fullscreen is pending", async () => {
    let finishFullscreen!: () => void;
    enterFullscreen.mockImplementation(() => new Promise<void>((resolve) => {
      finishFullscreen = () => { fullscreen = document.documentElement; resolve(); };
    }));
    const { result, unmount } = renderHook(() => useLandscapeViewing(true));
    act(() => result.current.requestLandscape());
    unmount();
    await act(async () => finishFullscreen());
    expect(lock).not.toHaveBeenCalled();
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  it("cancels a pending lock on unmount and ignores repeated entry taps", async () => {
    let finishLock!: () => void;
    lock.mockImplementation(() => new Promise<void>((resolve) => { finishLock = resolve; }));
    const { result, unmount } = renderHook(() => useLandscapeViewing(true));
    await act(async () => result.current.requestLandscape());
    act(() => result.current.requestLandscape());
    expect(lock).toHaveBeenCalledOnce();
    unmount();
    expect(unlock).toHaveBeenCalledOnce();
    await act(async () => finishLock());
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  it("offers entry again after the visitor exits fullscreen", async () => {
    const { result } = renderHook(() => useLandscapeViewing(true));
    await act(async () => result.current.requestLandscape());
    act(() => {
      fullscreen = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(unlock).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("ready");
    await act(async () => result.current.requestLandscape());
    expect(lock).toHaveBeenCalledTimes(2);
  });

  it("does not report a lock if fullscreen was exited before locking completed", async () => {
    let finishLock!: () => void;
    lock.mockImplementation(() => new Promise<void>((resolve) => { finishLock = resolve; }));
    const { result } = renderHook(() => useLandscapeViewing(true));
    await act(async () => result.current.requestLandscape());
    act(() => {
      fullscreen = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    await act(async () => finishLock());
    expect(result.current.status).toBe("ready");
    expect(unlock).toHaveBeenCalledOnce();
  });

  it.each(["desktop", "edit"])("does not request browser changes in %s", async (mode) => {
    if (mode === "desktop") vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    const { result } = renderHook(() => useLandscapeViewing(mode !== "edit"));
    await act(async () => result.current.requestLandscape());
    expect(enterFullscreen).not.toHaveBeenCalled();
    expect(lock).not.toHaveBeenCalled();
  });

  it("falls back to manual rotation when the browser never settles the lock", async () => {
    vi.useFakeTimers();
    try {
      lock.mockImplementation(() => new Promise<void>(() => {}));
      const { result } = renderHook(() => useLandscapeViewing(true));
      await act(async () => { result.current.requestLandscape(); await Promise.resolve(); });
      expect(result.current.status).toBe("requesting");
      await act(async () => { await vi.advanceTimersByTimeAsync(LANDSCAPE_REQUEST_TIMEOUT_MS + 10); });
      expect(result.current.status).toBe("manual");
      expect(exitFullscreen).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
