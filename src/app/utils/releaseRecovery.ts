let sceneReader: (() => unknown) | null = null;
let capturedScene: string | null = null;
let captureFailed = false;
export function hasRecoveryScene() { return Boolean(sceneReader || capturedScene || captureFailed); }

export function registerRecoveryScene(reader: () => unknown) {
  sceneReader = reader;
  capturedScene = null;
  captureFailed = false;
  return () => {
    if (sceneReader === reader) sceneReader = null;
  };
}
export function captureRecoveryScene() {
  if (!sceneReader) return;
  try { capturedScene = JSON.stringify(sceneReader(), null, 2); captureFailed = false; }
  catch { captureFailed = true; }
}
export function readRecoveryScene(): string | null {
  if (sceneReader) captureRecoveryScene();
  if (captureFailed) throw new Error('Scene recovery unavailable');
  return capturedScene;
}
export function isChunkLoadError(error: unknown) {
  return error instanceof Error && /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|Unable to preload CSS|error loading dynamically imported module/i.test(error.message);
}
export function downloadRecoveryScene(scene: string) {
  const url = URL.createObjectURL(new Blob([scene], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'exhibition-recovery.json';
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
