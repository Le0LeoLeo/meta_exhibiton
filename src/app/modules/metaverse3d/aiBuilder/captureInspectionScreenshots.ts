import type { BuilderScreenshot } from "../../../api/exhibitionScene";
import type { FloorPlanElement, RoomSize } from "../types";
import { getFloorPlanCenter, getFloorPlanRoomBounds } from '../store/floorPlanGeometry';

type CaptureOptions = {
  canvas?: HTMLCanvasElement | null;
  documentRef?: Document;
  frameDelayMs?: number;
  roomSize?: RoomSize;
  floorPlanElements?: FloorPlanElement[];
};

export type BuilderInspectionView = {
  viewId: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
};

export type BuilderInspectionCaptureController = {
  roomSize?: RoomSize;
  captureInspectionView: (view: BuilderInspectionView) => Promise<string>;
};

let activeCaptureController: BuilderInspectionCaptureController | null = null;

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function createBuilderInspectionViews(roomSize: Pick<RoomSize, "width" | "length" | "height">, floorPlanElements: FloorPlanElement[] = []): BuilderInspectionView[] {
  const halfWidth = roomSize.width / 2;
  const halfLength = roomSize.length / 2;
  const eyeHeight = Math.min(2.8, roomSize.height - 0.6);
  const targetHeight = Math.min(Math.max(1.6, roomSize.height * 0.3), 2.2);

  const views: BuilderInspectionView[] = [
    {
      viewId: "entrance",
      label: "Entrance view: readability, first impression, and path opening",
      position: [0, round(eyeHeight), round(halfLength * 0.65)],
      target: [0, round(targetHeight), 0],
      fov: 58,
    },
    {
      viewId: "left-wall",
      label: "Left wall view: wall-mounted object clearance and label readability",
      position: [round(halfWidth * 0.55), round(eyeHeight), 0],
      target: [round(-halfWidth + 0.4), round(targetHeight), 0],
      fov: 58,
    },
    {
      viewId: "right-wall",
      label: "Right wall view: wall-mounted object clearance and spacing",
      position: [round(-halfWidth * 0.55), round(eyeHeight), 0],
      target: [round(halfWidth - 0.4), round(targetHeight), 0],
      fov: 58,
    },
    {
      viewId: "rear-overview",
      label: "Elevated indoor rear view: entrance, circulation, and floor objects (not a floor plan)",
      position: [round(halfWidth * 0.3), round(roomSize.height - 0.6), round(-halfLength * 0.65)],
      target: [0, round(targetHeight), round(halfLength * 0.5)],
      fov: 62,
    },
  ];
  const bounds = getFloorPlanRoomBounds(floorPlanElements, roomSize.width, roomSize.length);
  const center = getFloorPlanCenter(bounds);
  const additionalRooms = bounds.filter((room) => Math.abs((room.minX + room.maxX) / 2 - center.x) > 0.1 || Math.abs((room.minZ + room.maxZ) / 2 - center.z) > 0.1);
  // Inspect opposing display walls in every annex, not just half its exhibits.
  if (additionalRooms.length > 6) views.splice(2);
  for (const room of additionalRooms.slice(0, Math.floor((16 - views.length) / 2))) {
    const x = (room.minX + room.maxX) / 2 - center.x;
    const z = (room.minZ + room.maxZ) / 2 - center.z;
    views.push({ viewId: `room-${room.id}-north`, label: `Additional room ${room.id}: north display wall`,
      position: [round(x), round(eyeHeight), round(z + (room.maxZ - room.minZ) * 0.3)], target: [round(x), round(targetHeight), round(z - (room.maxZ - room.minZ) * 0.25)], fov: 65 });
    views.push({ viewId: `room-${room.id}-south`, label: `Additional room ${room.id}: opposite south display wall, same room`,
      position: [round(x), round(eyeHeight), round(z - (room.maxZ - room.minZ) * 0.3)], target: [round(x), round(targetHeight), round(z + (room.maxZ - room.minZ) * 0.25)], fov: 65 });
  }
  return views;
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

export async function captureBuilderInspectionScreenshots(
  options: CaptureOptions = {},
): Promise<BuilderScreenshot[]> {
  // A suspended preview must not accidentally capture the previous scene.
  const deadline = Date.now() + 10000;
  while (options.roomSize && activeCaptureController?.roomSize !== options.roomSize && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const controller = activeCaptureController;
  if (controller && options.roomSize && controller.roomSize === options.roomSize) {
    const screenshots: BuilderScreenshot[] = [];
    for (const view of createBuilderInspectionViews(options.roomSize, options.floorPlanElements)) {
      if (activeCaptureController !== controller) throw new Error("Inspection scene changed during capture. Try again.");
      const dataUrl = await controller.captureInspectionView(view);
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

  throw new Error("Multi-view inspection is unavailable. Reopen the 3D editor and try again.");
}
