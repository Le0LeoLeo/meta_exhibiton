import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

import {
  type BuilderInspectionView,
  registerBuilderInspectionCaptureController,
} from "./captureInspectionScreenshots";

type Props = {
  enabled: boolean;
};

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function isPerspectiveCamera(camera: THREE.Camera): camera is THREE.PerspectiveCamera {
  return (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true;
}

export function BuilderInspectionCaptureBridge({ enabled }: Props) {
  const { camera, gl, scene } = useThree();

  useEffect(() => {
    if (!enabled) return undefined;

    return registerBuilderInspectionCaptureController({
      async captureInspectionView(view: BuilderInspectionView) {
        const originalPosition = camera.position.clone();
        const originalQuaternion = camera.quaternion.clone();
        const originalFov = isPerspectiveCamera(camera) ? camera.fov : null;

        camera.position.set(...view.position);
        camera.lookAt(new THREE.Vector3(...view.target));
        if (isPerspectiveCamera(camera) && view.fov) {
          camera.fov = view.fov;
        }
        camera.updateProjectionMatrix();
        gl.render(scene, camera);
        await nextFrame();
        gl.render(scene, camera);
        const dataUrl = gl.domElement.toDataURL("image/png");

        camera.position.copy(originalPosition);
        camera.quaternion.copy(originalQuaternion);
        if (isPerspectiveCamera(camera) && originalFov !== null) {
          camera.fov = originalFov;
        }
        camera.updateProjectionMatrix();
        gl.render(scene, camera);

        return dataUrl;
      },
    });
  }, [camera, enabled, gl, scene]);

  return null;
}
