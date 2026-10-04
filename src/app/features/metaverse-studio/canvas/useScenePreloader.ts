import { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF, useTexture } from "@react-three/drei";

import type { AppMode, ExhibitItem, RoomSize } from "../../../modules/metaverse3d/types";

export type SceneLoadStage = "interface" | "core" | "nearby" | "complete";
export type PreloadAssetKind = "image" | "model" | "other";
export type SceneAssetLoader = (
  url: string,
  kind: PreloadAssetKind,
) => Promise<unknown> | unknown;

interface PreloadAsset {
  url: string;
  kind: PreloadAssetKind;
}

const SHARED_BACKGROUND_TEXTURES = [
  "/textures/wall-paint.svg",
  "/textures/floor-marble.svg",
  "/textures/floor-wood.svg",
  "/textures/floor-concrete.svg",
] as const;

const PRELOAD_MODEL_EXTENSIONS = /\.(glb|gltf)$/i;
const PRELOAD_IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i;
const URL_LIKE_PATTERN = /^(https?:|blob:|data:|\/)/i;

function isNonEmptyUrl(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function uniqueAssets(assets: PreloadAsset[]) {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    if (!isNonEmptyUrl(asset.url) || seen.has(asset.url)) return false;
    seen.add(asset.url);
    return true;
  });
}

function getItemAssets(items: ExhibitItem[]): PreloadAsset[] {
  return uniqueAssets(
    items.flatMap((item) => {
      const content = item.content?.trim();
      const thumbnail = item.videoThumbnailUrl?.trim() || item.thumbnailUrl?.trim();
      const collected: PreloadAsset[] = [];

      if (content && URL_LIKE_PATTERN.test(content)) {
        collected.push({
          url: content,
          kind: item.type === "pedestal" && getAssetKind(content) === "model"
            ? "model"
            : item.type === "painting"
              ? "image"
              : getAssetKind(content),
        });
      }
      if (thumbnail && URL_LIKE_PATTERN.test(thumbnail)) {
        collected.push({ url: thumbnail, kind: "image" });
      }

      return collected;
    }),
  );
}

function getScenePreloadQueues(roomSize: RoomSize, items: ExhibitItem[]) {
  return {
    coreAssets: uniqueAssets([
      { url: roomSize.wallTextureUrl, kind: "image" },
      { url: roomSize.floorTextureUrl, kind: "image" },
    ]),
    backgroundAssets: uniqueAssets([
      ...getItemAssets(items),
      ...SHARED_BACKGROUND_TEXTURES.map((url) => ({ url, kind: "image" as const })),
    ]),
  };
}

function getAssetKind(url: string): PreloadAssetKind {
  if (PRELOAD_MODEL_EXTENSIONS.test(url)) return "model";
  if (PRELOAD_IMAGE_EXTENSIONS.test(url)) return "image";
  return "other";
}

const defaultLoadAsset: SceneAssetLoader = (url, kind) => {
  if (kind === "model") return useGLTF.preload(url);
  if (kind === "image") return useTexture.preload(url);
  return undefined;
};

async function preloadAssets({
  assets,
  loadAsset,
  onSettled,
}: {
  assets: PreloadAsset[];
  loadAsset: SceneAssetLoader;
  onSettled: (failedCount: number) => void;
}) {
  if (assets.length === 0) return 0;

  const results = await Promise.allSettled(
    assets.map(async (asset) => loadAsset(asset.url, asset.kind)),
  );
  const failedCount = results.filter((result) => result.status === "rejected").length;
  onSettled(failedCount);
  return failedCount;
}

export function useScenePreloader({
  mode,
  roomSize,
  items,
  loadAsset = defaultLoadAsset,
}: {
  mode: AppMode;
  roomSize: RoomSize;
  items: ExhibitItem[];
  loadAsset?: SceneAssetLoader;
}) {
  const shouldPreloadScene = mode !== "floor-plan";
  // Serialize only the resolved queues: moving an item must not restart loading.
  const queueKey = JSON.stringify(getScenePreloadQueues(roomSize, items));
  const { coreAssets, backgroundAssets } = useMemo(
    () => JSON.parse(queueKey) as ReturnType<typeof getScenePreloadQueues>,
    [queueKey],
  );

  const [stage, setStage] = useState<SceneLoadStage>("interface");
  const [progress, setProgress] = useState(shouldPreloadScene ? 0 : 100);
  const [coreReady, setCoreReady] = useState(!shouldPreloadScene);
  const [canEnter, setCanEnter] = useState(!shouldPreloadScene);
  const [backgroundComplete, setBackgroundComplete] = useState(!shouldPreloadScene);
  const [failedAssets, setFailedAssets] = useState(0);
  const previousShouldPreloadScene = useRef(shouldPreloadScene);
  const preloadCycle = useRef(shouldPreloadScene ? 1 : 0);
  if (shouldPreloadScene && !previousShouldPreloadScene.current) {
    preloadCycle.current += 1;
  }
  previousShouldPreloadScene.current = shouldPreloadScene;
  const currentPreloadCycle = preloadCycle.current;
  const [completedPreloadCycle, setCompletedPreloadCycle] = useState<number | null>(
    shouldPreloadScene ? null : currentPreloadCycle,
  );

  useEffect(() => {
    let cancelled = false;

    if (!shouldPreloadScene) {
      setStage("complete");
      setProgress(100);
      setCoreReady(true);
      setCanEnter(true);
      setBackgroundComplete(true);
      setFailedAssets(0);
      setCompletedPreloadCycle(currentPreloadCycle);
      return () => {
        cancelled = true;
      };
    }

    async function preload() {
      setStage("core");
      setProgress(0);
      setCoreReady(false);
      setCanEnter(false);
      setBackgroundComplete(false);
      setFailedAssets(0);
      setCompletedPreloadCycle(null);

      const coreFailures = await preloadAssets({
        assets: coreAssets,
        loadAsset,
        onSettled: () => undefined,
      });

      if (cancelled) return;
      setCoreReady(true);
      setCanEnter(true);
      setFailedAssets(coreFailures);
      setProgress(backgroundAssets.length > 0 ? 50 : 100);

      if (backgroundAssets.length === 0) {
        setStage("complete");
        setBackgroundComplete(true);
        setCompletedPreloadCycle(currentPreloadCycle);
        return;
      }

      setStage("nearby");
      const backgroundFailures = await preloadAssets({
        assets: backgroundAssets,
        loadAsset,
        onSettled: () => undefined,
      });

      if (cancelled) return;
      setFailedAssets(coreFailures + backgroundFailures);
      setStage("complete");
      setProgress(100);
      setBackgroundComplete(true);
      setCompletedPreloadCycle(currentPreloadCycle);
    }

    void preload();

    return () => {
      cancelled = true;
    };
  }, [
    backgroundAssets,
    coreAssets,
    currentPreloadCycle,
    loadAsset,
    shouldPreloadScene,
  ]);

  const currentBackgroundComplete =
    !shouldPreloadScene ||
    (backgroundComplete && completedPreloadCycle === currentPreloadCycle);

  return {
    stage,
    progress,
    coreReady,
    canEnter,
    backgroundComplete: currentBackgroundComplete,
    failedAssets,
    shouldPreloadScene,
    preloadComplete: currentBackgroundComplete,
    preloadProgress: progress,
    preloadStage: stage,
  };
}
