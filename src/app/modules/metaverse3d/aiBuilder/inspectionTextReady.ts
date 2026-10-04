import type { Object3D } from 'three';

type InspectionText = Object3D & {text?: string; textRenderInfo?: unknown; sync?: () => void};

// Text meshes can mount before their Unicode font/glyph requests have finished.
// A blank backboard is not valid evidence of the requested sign.
export async function waitForInspectionText(scene: Object3D, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    let pending = false;
    scene.traverse(object => {
      const text = object as InspectionText;
      if (typeof text.sync === 'function' && typeof text.text === 'string' && text.text.trim() && !text.textRenderInfo) {
        text.sync?.();
        pending = true;
      }
    });
    if (!pending) return;
    if (Date.now() >= deadline) throw new Error('Exhibition text is still loading. Try the scene inspection again once the signs are visible.');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
