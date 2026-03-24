import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import { PCFShadowMap } from "three";
import { StudioRoom } from "./StudioRoom";
import { StudioExhibitItem } from "./StudioExhibitItem";
import { StudioFloorPlanScene } from "./StudioFloorPlanScene";
import { useMetaverseStudioStore } from "../store/useMetaverseStudioStore";

export function StudioCanvas() {
  const mode = useMetaverseStudioStore((s) => s.mode);
  const items = useMetaverseStudioStore((s) => s.items);
  const setSelectedItemId = useMetaverseStudioStore((s) => s.setSelectedItemId);
  const setSelectedFloorPlanElementId = useMetaverseStudioStore((s) => s.setSelectedFloorPlanElementId);

  const isFloorPlan = mode === "floor-plan";

  return (
    <div className="absolute inset-0">
      <Canvas
        key={isFloorPlan ? "studio-floor" : "studio-main"}
        shadows={!isFloorPlan}
        orthographic={isFloorPlan}
        camera={isFloorPlan ? { position: [0, 40, 0], zoom: 28, near: 0.1, far: 500 } : { position: [0, 6, 14], fov: 55 }}
        onCreated={({ gl }) => {
          gl.shadowMap.type = PCFShadowMap;
        }}
        onPointerMissed={() => {
          if (mode === "edit") setSelectedItemId(null);
          if (mode === "floor-plan") setSelectedFloorPlanElementId(null);
        }}
      >
        <Suspense fallback={null}>
          {!isFloorPlan && <Environment preset="apartment" />}
          <ambientLight intensity={isFloorPlan ? 0.75 : 0.6} />
          {!isFloorPlan && <directionalLight castShadow position={[8, 12, 6]} intensity={0.9} />}

          {isFloorPlan ? (
            <>
              <StudioFloorPlanScene />
              <OrbitControls makeDefault enableRotate={false} minPolarAngle={0} maxPolarAngle={0} />
            </>
          ) : (
            <>
              <StudioRoom />
              {items.map((item) => (
                <StudioExhibitItem key={item.id} item={item} />
              ))}
              {mode === "edit" && <OrbitControls makeDefault />}
            </>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
