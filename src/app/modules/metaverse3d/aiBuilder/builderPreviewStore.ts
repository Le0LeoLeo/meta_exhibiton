import { create } from "zustand";

import type { SceneSnapshot } from "../store/metaverseStoreTypes";

type BuilderPreviewState = {
  scene: SceneSnapshot | null;
  setScene: (scene: SceneSnapshot | null) => void;
};

export const useBuilderPreviewStore = create<BuilderPreviewState>((set) => ({
  scene: null,
  setScene: (scene) => set({ scene }),
}));

function waitForPreviewRender() {
  return new Promise<void>((resolve) => {
    const schedule = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
    schedule(() => schedule(() => resolve()));
  });
}

export async function captureBuilderPreviewScene<T>(
  scene: SceneSnapshot,
  capture: () => Promise<T>,
  waitForRender: () => Promise<void> = waitForPreviewRender,
) {
  useBuilderPreviewStore.getState().setScene(scene);
  try {
    await waitForRender();
    return await capture();
  } finally {
    useBuilderPreviewStore.getState().setScene(null);
  }
}
