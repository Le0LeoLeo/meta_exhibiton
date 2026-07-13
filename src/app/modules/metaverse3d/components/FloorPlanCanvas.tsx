import { memo } from "react";
import { OrbitControls } from "@react-three/drei";

import { FloorPlanScene } from "./FloorPlanScene";

export const FloorPlanCanvas = memo(function FloorPlanCanvas({
  floorPlanIsTransforming,
}: {
  floorPlanIsTransforming: boolean;
  selectedFloorPlanElementId: string | null;
}) {
  return (
    <>
      <FloorPlanScene />
      <OrbitControls
        makeDefault
        enabled={!floorPlanIsTransforming}
        target={[0, 0, 0]}
        enableRotate={false}
        enablePan={!floorPlanIsTransforming}
        enableZoom={!floorPlanIsTransforming}
        minPolarAngle={0}
        maxPolarAngle={0}
      />
    </>
  );
});
