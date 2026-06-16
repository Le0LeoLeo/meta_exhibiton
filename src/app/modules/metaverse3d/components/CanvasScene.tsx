import { lazy, Suspense, useEffect, useMemo, type MutableRefObject } from "react";
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
  shouldPreload?: boolean;
  playerInput?: MutableRefObject<PlayerInputState>;
  onNearbyItemChange?: (title: string | null) => void;
}

export function CanvasScene({
  mode,
  roomSize,
  items,
  isFloorPlan,
  floorPlanIsTransforming,
  selectedFloorPlanElementId,
  onPointerMissed,
  shouldPreload: _shouldPreload = false,
  playerInput,
  onNearbyItemChange,
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

  return (
    <Canvas
      key={isFloorPlan ? "floor-plan-canvas" : `main-3d-canvas-${mode}`}
      shadows={enableShadows}
      dpr={isFloorPlan ? [1, 1.2] : performanceProfile.dpr}
      frameloop={frameloop}
      gl={{
        antialias: !isFloorPlan,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: isFloorPlan ? 1 : 1.03,
      }}
      onCreated={({ gl, scene }) => {
        gl.physicallyCorrectLights = true;
        gl.shadowMap.enabled = enableShadows;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.fog = isFloorPlan ? null : new THREE.FogExp2("#0f172a", 0.028);
        scene.background = new THREE.Color("#0f172a");
      }}
      orthographic={isFloorPlan}
      camera={isFloorPlan ? { position: [0, 40, 0], zoom: 28, near: 0.1, far: 500 } : { position: [0, 5, 10], fov: 55 }}
      onPointerMissed={onPointerMissed}
    >
      <Suspense fallback={null}>
        <FramePerformanceMonitor
          eligible={sampleEligible}
          onSample={adaptivePerformance.reportSample}
        />
        {!isFloorPlan && performanceProfile.enableEnvironment && <Environment preset="warehouse" background={false} blur={0.1} />}
        <ambientLight intensity={isFloorPlan ? 0.42 : (performanceProfile.effectiveMode === "performance" ? 0.12 : 0.028) * envBrightness} color={isFloorPlan ? "#ffffff" : "#b7c7ff"} />
        {!isFloorPlan && <hemisphereLight skyColor="#cfe3ff" groundColor="#1e293b" intensity={(performanceProfile.effectiveMode === "performance" ? 0.14 : 0.05) * envBrightness} />}
        {!isFloorPlan && <directionalLight castShadow={enableShadows} position={[8, 12, 6]} intensity={0.16 * envBrightness} color="#ffffff" shadow-mapSize={[performanceProfile.shadowMapSize, performanceProfile.shadowMapSize]} shadow-bias={-0.00012} shadow-normalBias={0.02} />}
        {!isFloorPlan && <spotLight castShadow={enableShadows} position={[0, 5.8, 0]} angle={0.42} penumbra={0.7} intensity={0.56 * envBrightness} distance={28} color="#f8fafc" shadow-mapSize={[performanceProfile.shadowMapSize, performanceProfile.shadowMapSize]} shadow-bias={-0.00008} shadow-normalBias={0.02} />}
        {!isFloorPlan && performanceProfile.enableExtraAccentLights && <spotLight castShadow={enableShadows} position={[-4.5, 5.4, -3.5]} angle={0.35} penumbra={0.78} intensity={0.24 * envBrightness} distance={18} color="#dbeafe" shadow-mapSize={[256, 256]} shadow-bias={-0.00008} />}
        {!isFloorPlan && performanceProfile.enableExtraAccentLights && <spotLight castShadow={enableShadows} position={[4.5, 5.4, 3.5]} angle={0.35} penumbra={0.78} intensity={0.24 * envBrightness} distance={18} color="#f5f3ff" shadow-mapSize={[256, 256]} shadow-bias={-0.00008} />}
        {!isFloorPlan && performanceProfile.enableExtraAccentLights && <pointLight position={[0, 2.2, -9.4]} intensity={0.02 * envBrightness} distance={6.6} decay={2} color="#93c5fd" />}

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
  );
}
