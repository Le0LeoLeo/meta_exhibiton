import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureBuilderInspectionScreenshots,
  registerBuilderInspectionCaptureController,
} from "./captureInspectionScreenshots";

afterEach(() => {
  registerBuilderInspectionCaptureController(null);
});

describe("captureBuilderInspectionScreenshots", () => {
  it("captures three inspection screenshots from a canvas", async () => {
    const canvas = {
      toDataURL: vi.fn(() => "data:image/png;base64,abc"),
    } as unknown as HTMLCanvasElement;

    const screenshots = await captureBuilderInspectionScreenshots({
      canvas,
      frameDelayMs: 0,
    });

    expect(screenshots).toHaveLength(3);
    expect(screenshots[0]).toEqual(expect.objectContaining({
      viewId: "entrance-current",
      dataUrl: "data:image/png;base64,abc",
    }));
    expect(canvas.toDataURL).toHaveBeenCalledTimes(3);
  });

  it("captures planned inspection views through the active 3D controller", async () => {
    const captureInspectionView = vi.fn(async (view) => `data:image/png;base64,${view.viewId}`);
    registerBuilderInspectionCaptureController({ captureInspectionView });

    const screenshots = await captureBuilderInspectionScreenshots({
      roomSize: { width: 20, length: 16, height: 6 } as any,
      frameDelayMs: 0,
    });

    expect(screenshots.map((shot) => shot.viewId)).toEqual([
      "entrance",
      "left-wall",
      "right-wall",
      "top-down",
    ]);
    expect(captureInspectionView).toHaveBeenCalledTimes(4);
    expect(captureInspectionView).toHaveBeenCalledWith(expect.objectContaining({
      viewId: "entrance",
      position: [0, 3.2, 11.2],
      target: [0, 1.8, 0],
    }));
    expect(screenshots[3].dataUrl).toBe("data:image/png;base64,top-down");
  });
});
