import * as THREE from "three";
import type { BuilderInspectionView } from "./captureInspectionScreenshots";

// A private camera prevents OrbitControls / player updates from changing inspection poses.
export function renderInspectionView(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  editorCamera: THREE.Camera,
  view: BuilderInspectionView,
) {
  const camera = new THREE.PerspectiveCamera(
    view.fov ?? 58,
    gl.domElement.width / Math.max(1, gl.domElement.height),
    0.05,
    300,
  );
  camera.position.set(...view.position);
  camera.lookAt(...view.target);
  camera.updateMatrixWorld();
  try {
    gl.render(scene, camera);
    return gl.domElement.toDataURL("image/png");
  } finally {
    gl.render(scene, editorCamera);
  }
}
