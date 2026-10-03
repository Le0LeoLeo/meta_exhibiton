import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { renderInspectionView } from "./inspectionCamera";

describe("inspection camera isolation", () => {
  it.each([false, true])("restores the rendered editor view even on capture failure (%s)", (fail) => {
    const editor = new THREE.PerspectiveCamera(42);
    editor.position.set(1, 2, 3);
    const scene = new THREE.Scene();
    const render = vi.fn();
    const gl = { render, domElement: { width: 800, height: 400, toDataURL: () => {
      if (fail) throw new Error("tainted");
      return "data:image/png;base64,test";
    } } } as unknown as THREE.WebGLRenderer;
    const capture = () => renderInspectionView(gl, scene, editor, {
      viewId: "test", label: "test", position: [0, 2, 5], target: [0, 2, 0],
    });
    if (fail) expect(capture).toThrow("tainted");
    else expect(capture()).toContain("data:image/png");
    expect(editor.position.toArray()).toEqual([1, 2, 3]);
    expect(editor.fov).toBe(42);
    expect(render.mock.calls[0][1]).not.toBe(editor);
    expect(render.mock.calls[0][1].aspect).toBe(2);
    expect(render).toHaveBeenLastCalledWith(scene, editor);
  });
});
