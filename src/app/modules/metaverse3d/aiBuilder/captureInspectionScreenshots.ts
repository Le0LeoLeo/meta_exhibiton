import type { BuilderScreenshot } from "../../../api/exhibitionScene";
import type { RoomSize } from "../types";

type CaptureOptions = {
  canvas?: HTMLCanvasElement | null;
  documentRef?: Document;
  frameDelayMs?: number;
  roomSize?: RoomSize;
};

export type BuilderInspectionView = {
  viewId: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
};

export type BuilderInspectionCaptureController = {
  captureInspectionView: (view: BuilderInspectionView) => Promise<string>;
};

const INSPECTION_VIEWS = [
  { viewId: "entrance-current", label: "Current editor view for entrance/readability check" },
  { viewId: "wall-current", label: "Current editor view for wall-object collision check" },
  { viewId: "layout-current", label: "Current editor view for spacing/path check" },
] as const;

let activeCaptureController: BuilderInspectionCaptureController | null = null;

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function createBuilderInspectionViews(roomSize: Pick<RoomSize, "width" | "length" | "height">): BuilderInspectionView[] {
  const halfWidth = Math.max(4, roomSize.width / 2);
  const halfLength = Math.max(4, roomSize.length / 2);
  const eyeHeight = Math.min(Math.max(2.8, roomSize.height * 0.53), 4.2);
  const targetHeight = Math.min(Math.max(1.6, roomSize.height * 0.3), 2.2);

  return [
    {
      viewId: "entrance",
      label: "Entrance view: readability, first impression, and path opening",
      position: [0, round(eyeHeight), round(halfLength * 1.4)],
      target: [0, round(targetHeight), 0],
      fov: 58,
    },
    {
      viewId: "left-wall",
      label: "Left wall view: wall-mounted object clearance and label readability",
      position: [round(-halfWidth * 1.35), round(eyeHeight), 0],
      target: [0, round(targetHeight), 0],
      fov: 58,
    },
    {
      viewId: "right-wall",
      label: "Right wall view: wall-mounted object clearance and spacing",
      position: [round(halfWidth * 1.35), round(eyeHeight), 0],
      target: [0, round(targetHeight), 0],
      fov: 58,
    },
    {
      viewId: "top-down",
      label: "Top-down view: circulation, overlaps, and floor object placement",
      position: [0, round(Math.max(roomSize.height + 6, halfLength * 1.5)), 0.1],
      target: [0, 0, 0],
      fov: 62,
    },
  ];
}

export function registerBuilderInspectionCaptureController(
  controller: BuilderInspectionCaptureController | null,
) {
  activeCaptureController = controller;
  return () => {
    if (activeCaptureController === controller) {
      activeCaptureController = null;
    }
  };
}

function waitForNextFrame(frameDelayMs: number) {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, frameDelayMs);
      });
      return;
    }
    window.setTimeout(resolve, frameDelayMs);
  });
}

function findSceneCanvas(documentRef: Document) {
  return documentRef.querySelector<HTMLCanvasElement>("canvas");
}

export async function captureBuilderInspectionScreenshots(
  options: CaptureOptions = {},
): Promise<BuilderScreenshot[]> {
  if (activeCaptureController && options.roomSize) {
    const screenshots: BuilderScreenshot[] = [];
    for (const view of createBuilderInspectionViews(options.roomSize)) {
      const dataUrl = await activeCaptureController.captureInspectionView(view);
      if (!dataUrl.startsWith("data:image/")) {
        throw new Error(`3D canvas screenshot capture failed for ${view.viewId}`);
      }
      screenshots.push({
        viewId: view.viewId,
        label: view.label,
        dataUrl,
      });
    }
    return screenshots;
  }

  const documentRef = options.documentRef ?? document;
  const canvas = options.canvas ?? findSceneCanvas(documentRef);
  if (!canvas) throw new Error("3D canvas is not available for visual review");

  const screenshots: BuilderScreenshot[] = [];
  const frameDelayMs = options.frameDelayMs ?? 80;
  for (const view of INSPECTION_VIEWS) {
    await waitForNextFrame(frameDelayMs);
    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("3D canvas screenshot capture failed");
    }
    screenshots.push({ ...view, dataUrl });
  }

  return screenshots;
}
