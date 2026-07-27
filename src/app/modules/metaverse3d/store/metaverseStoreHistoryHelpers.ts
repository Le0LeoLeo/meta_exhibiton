import { v4 as uuidv4 } from "uuid";
import type { ExhibitItem, FloorPlanElement, FloorPlanElementType, RoomSize, WallMaterialSettings } from "../types";
import { createSnapshot, normalizeImportedItemContent, parseRotationVec3, parseVec3 } from "./metaverseStoreUtils";

const IMPORTED_ITEM_CANONICAL_Y: Partial<Record<ExhibitItem["type"], number>> = {
  pedestal: 0,
  flower: 0,
  bench: 0,
  rug: 0.01,
  vase: 0,
  sculpture: 0,
  spotlight: 0.2,
  plant: 0,
  column: 0,
};

export function normalizeImportedItemPosition(
  type: ExhibitItem["type"],
  value: unknown,
): [number, number, number] {
  const position = parseVec3(value, [0, 1.5, 0]);
  const canonicalY = IMPORTED_ITEM_CANONICAL_Y[type];
  return canonicalY === undefined ? position : [position[0], canonicalY, position[2]];
}

export interface SceneSnapshotLike {
  roomSize: RoomSize;
  items: ExhibitItem[];
  floorPlanElements: FloorPlanElement[];
  wallMaterialOverrides: Record<string, Partial<WallMaterialSettings>>;
  selectedItemId?: string | null;
  selectedItemIds?: string[];
  selectedFloorPlanElementId?: string | null;
}

export function createImportedSceneSnapshot(snapshot: Partial<SceneSnapshotLike>) {
  return {
    roomSize: {
      wallColor: "#dbe7ff",
      wallMaterialPreset: "paint" as const,
      wallTextureUrl: "/textures/wall-paint.svg",
      wallTextureTiling: 3,
      wallRoughness: 0.35,
      wallMetalness: 0.08,
      wallBumpScale: 0.04,
      wallEnvIntensity: 0.9,
      wallOpacity: 0.98,
      wallTransmission: 0,
      wallIor: 1.45,
      floorColor: "#0f172a",
      floorTextureUrl: "/textures/wall-concrete.svg",
      floorTextureTiling: 2.5,
      floorRoughness: 0.55,
      floorMetalness: 0.18,
      environmentBrightness: 0.45,
      ...snapshot.roomSize,
    },
    items: Array.isArray(snapshot.items)
      ? snapshot.items.map((item: Partial<ExhibitItem>) => ({
          id: item.id || uuidv4(),
          type: (item.type as ExhibitItem["type"]) || "text",
          position: normalizeImportedItemPosition(
            (item.type as ExhibitItem["type"]) || "text",
            item.position,
          ),
          rotation: parseRotationVec3(item.rotation, [0, 0, 0]),
          scale: parseVec3(item.scale, [1, 1, 1]),
          content: normalizeImportedItemContent(((item.type as ExhibitItem["type"]) || "text"), item.content),
          fileName: item.fileName,
          fileMimeType: item.fileMimeType,
          videoThumbnailUrl: item.videoThumbnailUrl,
          videoAutoplay: item.videoAutoplay,
          videoLoop: item.videoLoop,
          videoMuted: item.videoMuted,
          frameWidth: item.frameWidth,
          frameHeight: item.frameHeight,
          modelOffset: item.modelOffset,
          title: item.title,
          artist: item.artist,
          description: item.description,
          externalUrl: item.externalUrl,
          textFontFamily: item.textFontFamily,
          textColor: item.textColor,
          textFontSize: item.textFontSize,
          textIsBold: item.textIsBold,
          textBackboardEnabled: item.textBackboardEnabled,
          textBackboardColor: item.textBackboardColor,
          lightIntensity: item.lightIntensity,
          isLocked: item.isLocked,
        }))
      : [],
    floorPlanElements: Array.isArray(snapshot.floorPlanElements)
      ? snapshot.floorPlanElements.map((el: Partial<FloorPlanElement>) => ({
          id: el.id || uuidv4(),
          type: (el.type as FloorPlanElementType) || "wall",
          position: Array.isArray(el.position) && el.position.length === 3
            ? [Number(el.position[0]) || 0, Number(el.position[1]) || 0.1, Number(el.position[2]) || 0] as [number, number, number]
            : [0, 0.1, 0],
          rotation: Array.isArray(el.rotation) && el.rotation.length === 3
            ? [Number(el.rotation[0]) || 0, Number(el.rotation[1]) || 0, Number(el.rotation[2]) || 0] as [number, number, number]
            : [0, 0, 0],
          scale: Array.isArray(el.scale) && el.scale.length === 3
            ? [Number(el.scale[0]) || 1, Number(el.scale[1]) || 0.2, Number(el.scale[2]) || 1] as [number, number, number]
            : [1, 0.2, 1],
          color: el.color,
          isLocked: el.isLocked,
        }))
      : [],
    wallMaterialOverrides:
      snapshot.wallMaterialOverrides && typeof snapshot.wallMaterialOverrides === "object"
        ? snapshot.wallMaterialOverrides
        : {},
  };
}

export function createUndoRedoPatch(state: SceneSnapshotLike, direction: "undo" | "redo", undoStack: SceneSnapshotLike[], redoStack: SceneSnapshotLike[]) {
  const previousOrNext = direction === "undo" ? undoStack[undoStack.length - 1] : redoStack[redoStack.length - 1];
  if (!previousOrNext) return null;
  const current = createSnapshot(state);
  const itemIds = new Set(previousOrNext.items.map((item) => item.id));
  const selectedItemIds = (state.selectedItemIds ?? []).filter((id) => itemIds.has(id));
  const selectedItemId =
    state.selectedItemId && itemIds.has(state.selectedItemId)
      ? state.selectedItemId
      : selectedItemIds[0] ?? null;
  const floorPlanElementIds = new Set(previousOrNext.floorPlanElements.map((element) => element.id));
  const selectedFloorPlanElementId =
    state.selectedFloorPlanElementId && floorPlanElementIds.has(state.selectedFloorPlanElementId)
      ? state.selectedFloorPlanElementId
      : null;

  return direction === "undo"
    ? {
        roomSize: previousOrNext.roomSize,
        items: previousOrNext.items,
        floorPlanElements: previousOrNext.floorPlanElements,
        wallMaterialOverrides: previousOrNext.wallMaterialOverrides,
        selectedItemId,
        selectedItemIds,
        selectedFloorPlanElementId,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, current].slice(-100),
      }
    : {
        roomSize: previousOrNext.roomSize,
        items: previousOrNext.items,
        floorPlanElements: previousOrNext.floorPlanElements,
        wallMaterialOverrides: previousOrNext.wallMaterialOverrides,
        selectedItemId,
        selectedItemIds,
        selectedFloorPlanElementId,
        undoStack: [...undoStack, current].slice(-100),
        redoStack: redoStack.slice(0, -1),
      };
}
