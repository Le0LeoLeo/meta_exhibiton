type RendererProbe = {
  dispose?: () => void;
  forceContextLoss?: () => void;
};

export function canCreateWebGLContext(
  documentRef: Document = document,
  createRenderer?: () => RendererProbe,
) {
  try {
    const canvas = documentRef.createElement("canvas");
    const context =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!context) return false;
    if (createRenderer) {
      const renderer = createRenderer();
      renderer.forceContextLoss?.();
      renderer.dispose?.();
    }
    return true;
  } catch {
    return false;
  }
}
