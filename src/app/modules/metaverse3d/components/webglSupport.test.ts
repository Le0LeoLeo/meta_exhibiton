import { describe, expect, it, vi } from "vitest";
import { canCreateWebGLContext } from "./webglSupport";

describe("canCreateWebGLContext", () => {
  it("returns false when canvas cannot create a WebGL context", () => {
    const documentRef = {
      createElement: vi.fn(() => ({
        getContext: vi.fn(() => null),
      })),
    } as unknown as Document;

    expect(canCreateWebGLContext(documentRef)).toBe(false);
  });

  it("returns true when webgl2 or webgl context is available", () => {
    const documentRef = {
      createElement: vi.fn(() => ({
        getContext: vi.fn((kind: string) => (kind === "webgl2" ? ({}) : null)),
      })),
    } as unknown as Document;

    expect(canCreateWebGLContext(documentRef)).toBe(true);
  });

  it("returns false when the renderer factory throws after context detection", () => {
    const documentRef = {
      createElement: vi.fn(() => ({
        getContext: vi.fn(() => ({})),
      })),
    } as unknown as Document;

    expect(canCreateWebGLContext(documentRef, () => {
      throw new Error("Error creating WebGL context.");
    })).toBe(false);
  });
});
