import { PCFShadowMap, WebGLRenderer, Clock } from "three";

export async function createRenderer(parameters: ConstructorParameters<typeof WebGLRenderer>[0]) {
  const supportsWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;

  if (supportsWebGPU) {
    const { WebGPURenderer } = await import("three/webgpu");
    const renderer = new WebGPURenderer(parameters as never);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    await renderer.init();
    return renderer;
  }

  const renderer = new WebGLRenderer(parameters);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  return renderer;
}

export function createSceneClock() {
  return new Clock();
}
