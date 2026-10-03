import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { renderInspectionView } from "./inspectionCamera";
import { waitForInspectionText } from './inspectionTextReady';
import type { RoomSize } from "../types";

import {
  type BuilderInspectionView,
  registerBuilderInspectionCaptureController,
} from "./captureInspectionScreenshots";

type Props = {
  enabled: boolean;
  roomSize: RoomSize;
};

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function BuilderInspectionCaptureBridge({ enabled, roomSize }: Props) {
  const { camera, gl, scene } = useThree();

  useEffect(() => {
    if (!enabled) return undefined;

    return registerBuilderInspectionCaptureController({
      roomSize,
      async captureInspectionView(view: BuilderInspectionView) {
        await nextFrame();
        await waitForInspectionText(scene);
        return renderInspectionView(gl, scene, camera, view);
      },
    });
  }, [camera, enabled, gl, scene, roomSize]);

  return null;
}
