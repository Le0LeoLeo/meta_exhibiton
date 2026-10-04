import { describe, expect, it } from "vitest";

import { getManualChunk } from "./manualChunks";

describe("getManualChunk", () => {
  it('keeps shared state and route loading independent of the 3D runtime', () => {
    expect(getManualChunk('/workspace/node_modules/zustand/esm/react.mjs')).toBe('vendor-state');
    expect(getManualChunk('/workspace/node_modules/use-sync-external-store/shim/index.js')).toBe('vendor-state');
    expect(getManualChunk('\0vite/preload-helper.js')).toBe('vendor-preload');
  });
  it("keeps the Rapier runtime and its React adapter in separate cache chunks", () => {
    expect(
      getManualChunk("/workspace/node_modules/@dimforge/rapier3d-compat/rapier.js"),
    ).toBe("vendor-physics");
    expect(
      getManualChunk("/workspace/node_modules/@react-three/rapier/dist/react-three-rapier.esm.js"),
    ).toBe("vendor-react-three-physics");
  });

  it("normalizes Windows module paths", () => {
    expect(
      getManualChunk(
        "D:\\workspace\\node_modules\\@react-three\\rapier\\dist\\react-three-rapier.esm.js",
      ),
    ).toBe("vendor-react-three-physics");
  });

  it("leaves application modules to route and component code splitting", () => {
    expect(
      getManualChunk("/workspace/src/app/modules/metaverse3d/components/ViewCanvas.tsx"),
    ).toBeUndefined();
  });
});
