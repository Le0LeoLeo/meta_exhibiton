import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MutableRefObject,
} from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

import type { RoomSize, ExhibitItem as ExhibitItemType } from "../types";
import { useRenderPerformanceProfile } from "../performanceProfile";
import { FramePerformanceMonitor } from "../performance/FramePerformanceMonitor";
import {
  getBrowserPerformanceSignals,
  useAdaptivePerformance,
} from "../performance/useAdaptivePerformance";
import { useStore } from "../store/useStore";
import { useSceneLifecycle } from "../lifecycle/useSceneLifecycle";
import type { PlayerInputState } from "../input/playerInput";
import { WebGLRecoveryOverlay } from "./WebGLRecoveryOverlay";
import { BuilderInspectionCaptureBridge } from "../aiBuilder/BuilderInspectionCaptureBridge";
import { WebGLCanvasBoundary } from "./WebGLCanvasBoundary";
import { canCreateWebGLContext } from "./webglSupport";
import { GalleryLighting } from "./GalleryLighting";
import { GalleryArtworkLighting } from "./GalleryArtworkLighting";
import {
  DEFAULT_CAMERA_FAR,
  DEFAULT_CAMERA_FOV,
  DEFAULT_CAMERA_NEAR,
  DEFAULT_EYE_HEIGHT,
} from "../sceneScale";

const ViewCanvas = lazy(() => import("./ViewCanvas").then((mod) => ({ default: mod.ViewCanvas })));
const EditCanvas = lazy(() => import("./EditCanvas").then((mod) => ({ default: mod.EditCanvas })));
const FloorPlanCanvas = lazy(() => import("./FloorPlanCanvas").then((mod) => ({ default: mod.FloorPlanCanvas })));

interface CanvasSceneProps {
  mode: string;
  roomSize: RoomSize;
  items: ExhibitItemType[];
  isFloorPlan: boolean;
  floorPlanIsTransforming: boolean;
  selectedFloorPlanElementId: string | null;
  onPointerMissed: () => void;
  playerInput?: MutableRefObject<PlayerInputState>;
  onNearbyItemChange?: (title: string | null) => void;
  onUse2D?: () => void;
}

export function shouldPreserveDrawingBuffer(mode: string, isFloorPlan: boolean) {
  return mode === "edit" || isFloorPlan;
}

export function CanvasScene({
  mode,
  roomSize,
  items,
  isFloorPlan,
  floorPlanIsTransforming,
  selectedFloorPlanElementId,
  onPointerMissed,
  playerInput,
  onNearbyItemChange,
  onUse2D,
}: CanvasSceneProps) {
  const requestedMode = useStore((state) => state.performanceMode);
  const setEffectivePerformanceMode = useStore(
    (state) => state.setEffectivePerformanceMode,
  );
  const viewingItem = useStore((state) => state.viewingItem);
  const signals = useMemo(() => getBrowserPerformanceSignals(), []);
  const adaptivePerformance = useAdaptivePerformance({
    requestedMode,
    signals,
  });
  const performanceProfile = useRenderPerformanceProfile();
  const lifecycle = useSceneLifecycle({ detailOpen: viewingItem !== null });
  const envBrightness = roomSize.environmentBrightness ?? 1;
  const preserveDrawingBuffer = shouldPreserveDrawingBuffer(mode, isFloorPlan);
  const createRendererProbe = useCallback(
    () =>
      new THREE.WebGLRenderer({
        antialias: !isFloorPlan,
        powerPreference: "high-performance",
        preserveDrawingBuffer,
      }),
    [isFloorPlan, preserveDrawingBuffer],
  );
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [webglContextLost, setWebglContextLost] = useState(false);
  const [webglSupported, setWebglSupported] = useState(() =>
    canCreateWebGLContext(document, createRendererProbe),
  );
  const enableShadows = !isFloorPlan && performanceProfile.enableShadows;
  const sampleEligible =
    mode === "view" && !isFloorPlan && lifecycle.allowMotion;
  const frameloop =
    mode === "view" && lifecycle.obscured
      ? performanceProfile.idleFrameloop
      : "always";

  useEffect(() => {
    setEffectivePerformanceMode(adaptivePerformance.effectiveMode);
  }, [adaptivePerformance.effectiveMode, setEffectivePerformanceMode]);

  useEffect(() => {
    if (!canvasElement) return;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setWebglContextLost(true);
    };
    const handleContextRestored = () => setWebglContextLost(false);

    canvasElement.addEventListener("webglcontextlost", handleContextLost);
    canvasElement.addEventListener("webglcontextrestored", handleContextRestored);

    return () => {
      canvasElement.removeEventListener("webglcontextlost", handleContextLost);
      canvasElement.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, [canvasElement]);

  const reloadCanvas = useCallback(() => {
    setWebglSupported(canCreateWebGLContext(document, createRendererProbe));
    setCanvasVersion((version) => version + 1);
    setWebglContextLost(false);
  }, [createRendererProbe]);

  const canvasKey = isFloorPlan ? "floor-plan-canvas" : `main-3d-canvas-${mode}`;

  return (
    <div className="relative h-full w-full">
      {webglSupported ? (
        <WebGLCanvasBoundary onReload={reloadCanvas} onUse2D={onUse2D}>
        <Canvas
          key={`${canvasKey}-${canvasVersion}`}
          shadows={enableShadows ? THREE.PCFShadowMap : false}
          dpr={isFloorPlan ? [1, 1.2] : performanceProfile.dpr}
          frameloop={frameloop}
          gl={{
            antialias: !isFloorPlan,
            powerPreference: "high-performance",
            preserveDrawingBuffer,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: isFloorPlan
              ? 1
              : performanceProfile.effectiveMode === "quality"
                ? 1
                : 1.02,
          }}
          onCreated={({ gl, scene }) => {
            setCanvasElement(gl.domElement);
            gl.physicallyCorrectLights = true;
            gl.shadowMap.enabled = enableShadows;
            gl.shadowMap.type = THREE.PCFShadowMap;
            scene.fog = isFloorPlan ? null : new THREE.FogExp2("#34383b", 0.014);
            scene.background = new THREE.Color(isFloorPlan ? "#0f172a" : "#171a1c");
          }}
          orthographic={isFloorPlan}
          camera={isFloorPlan ? { position: [0, 40, 0], zoom: 28, near: 0.1, far: 500 } : {
            position: [0, DEFAULT_EYE_HEIGHT, 5],
            fov: DEFAULT_CAMERA_FOV,
            near: DEFAULT_CAMERA_NEAR,
            far: DEFAULT_CAMERA_FAR,
          }}
          onPointerMissed={onPointerMissed}
        >
          <Suspense fallback={null}>
            <FramePerformanceMonitor
              eligible={sampleEligible}
              onSample={adaptivePerformance.reportSample}
            />
            {!isFloorPlan && performanceProfile.enableEnvironment && <Environment preset="warehouse" background={false} blur={0.1} />}
            {isFloorPlan ? (
              <ambientLight intensity={0.42} color="#ffffff" />
            ) : (
              <GalleryLighting
                profile={performanceProfile}
                environmentBrightness={envBrightness}
              />
            )}
            {!isFloorPlan && (
              <GalleryArtworkLighting
                items={items}
                mode={performanceProfile.effectiveMode}
                environmentBrightness={envBrightness}
              />
            )}
            {!isFloorPlan && <BuilderInspectionCaptureBridge enabled />}

            {isFloorPlan ? (
              <FloorPlanCanvas floorPlanIsTransforming={floorPlanIsTransforming} selectedFloorPlanElementId={selectedFloorPlanElementId} />
            ) : mode === "edit" ? (
              <EditCanvas roomSize={roomSize} items={items} />
            ) : (
              <ViewCanvas
                items={items}
                allowMotion={lifecycle.allowMotion}
                playerInput={playerInput}
                onNearbyItemChange={onNearbyItemChange}
              />
            )}
          </Suspense>
        </Canvas>
        </WebGLCanvasBoundary>
      ) : (
        <WebGLRecoveryOverlay onReload={reloadCanvas} onUse2D={onUse2D} />
      )}
      {webglContextLost && <WebGLRecoveryOverlay onReload={reloadCanvas} onUse2D={onUse2D} />}
    </div>
  );
}
