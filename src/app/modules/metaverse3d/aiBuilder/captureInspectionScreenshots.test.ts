import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureBuilderInspectionScreenshots,
  registerBuilderInspectionCaptureController,
  createBuilderInspectionViews,
} from "./captureInspectionScreenshots";

afterEach(() => {
  registerBuilderInspectionCaptureController(null);
  vi.useRealTimers();
});

describe("captureBuilderInspectionScreenshots", () => {
  it("covers both display walls in all six annex zones within sixteen images", () => {
    const rooms = Array.from({length: 7}, (_, index) => ({id: `zone-${index}`, type: 'room' as const,
      position: [index * 20, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number],
      scale: [20, 0.04, 20] as [number, number, number], isLocked: index === 0}));
    const views = createBuilderInspectionViews({width: 20, length: 20, height: 6}, rooms);
    expect(views).toHaveLength(16);
    for (let index = 1; index <= 6; index++) expect(views.filter(view => view.label.includes(`zone-${index}:`))).toHaveLength(2);
  });
  it("adds indoor views for additional rooms relative to the primary anchor", () => {
    const views = createBuilderInspectionViews({ width: 20, length: 20, height: 6 }, [
      { id: 'main', type: 'room', position: [10, 0, 10], rotation: [0, 0, 0], scale: [20, 0.2, 20], isLocked: true },
      { id: 'east', type: 'room', position: [30, 0, 10], rotation: [0, 0, 0], scale: [20, 0.2, 20] },
    ]);
    expect(views).toHaveLength(6);
    expect(views[4].position[0]).toBe(20);
    expect(views[4].position[2]).toBe(6);
    expect(views[4].label).toContain('east');
  });
  it("waits for the requested preview instead of photographing a stale scene", async () => {
    vi.useFakeTimers();
    const roomSize = { width: 20, length: 16, height: 6 } as any;
    const stale = vi.fn();
    const ready = vi.fn(async (view) => `data:image/png;base64,${view.viewId}`);
    registerBuilderInspectionCaptureController({roomSize: {...roomSize}, captureInspectionView: stale});
    const pending = captureBuilderInspectionScreenshots({roomSize});
    await vi.advanceTimersByTimeAsync(100);
    expect(stale).not.toHaveBeenCalled();
    registerBuilderInspectionCaptureController({roomSize, captureInspectionView: ready});
    await vi.advanceTimersByTimeAsync(50);
    expect(await pending).toHaveLength(4);
  });
  it("rejects a canvas without a multi-view controller instead of repeating one view", async () => {
    const canvas = {
      toDataURL: vi.fn(() => "data:image/png;base64,abc"),
    } as unknown as HTMLCanvasElement;

    await expect(captureBuilderInspectionScreenshots({
      canvas,
      frameDelayMs: 0,
    })).rejects.toThrow("Multi-view inspection is unavailable");
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });

  it("captures planned inspection views through the active 3D controller", async () => {
    const captureInspectionView = vi.fn(async (view) => `data:image/png;base64,${view.viewId}`);
    const roomSize = { width: 20, length: 16, height: 6 } as any;
    registerBuilderInspectionCaptureController({ captureInspectionView, roomSize });

    const screenshots = await captureBuilderInspectionScreenshots({
      roomSize,
      frameDelayMs: 0,
    });

    expect(screenshots.map((shot) => shot.viewId)).toEqual([
      "entrance",
      "left-wall",
      "right-wall",
      "rear-overview",
    ]);
    expect(captureInspectionView).toHaveBeenCalledTimes(4);
    expect(captureInspectionView).toHaveBeenCalledWith(expect.objectContaining({
      viewId: "entrance",
      position: [0, 2.8, 5.2],
      target: [0, 1.8, 0],
    }));
    expect(screenshots[3].dataUrl).toBe("data:image/png;base64,rear-overview");
  });

  it.each([{width: 8, length: 8, height: 3}, {width: 24, length: 60, height: 6}])(
    "keeps all inspection cameras inside opaque room geometry: %o", (room) => {
      for (const view of createBuilderInspectionViews(room)) {
        expect(Math.abs(view.position[0])).toBeLessThan(room.width / 2 - 0.3);
        expect(Math.abs(view.position[2])).toBeLessThan(room.length / 2 - 0.3);
        expect(view.position[1]).toBeGreaterThan(0.3);
        expect(view.position[1]).toBeLessThan(room.height - 0.3);
      }
    },
  );
});
