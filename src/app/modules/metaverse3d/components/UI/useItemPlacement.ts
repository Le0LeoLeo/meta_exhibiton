import { useEffect } from "react";
import { ExhibitItem, RoomSize, WallFace } from "../../types";

type SpawnLocation = "center" | "north" | "south" | "east" | "west";
type PendingPlacement = {
  type: ExhibitItem["type"];
  position: [number, number, number];
  rotation: [number, number, number];
  wallSide: "front" | "back";
  surfaceKind?: "room-wall" | "partition";
  surfaceId?: string | null;
  batchPositions?: Array<[number, number, number]>;
  batchRotation?: [number, number, number];
  autoTopLightstrip?: boolean;
};

interface UseItemPlacementParams {
  roomSize: RoomSize;
  selectedWallFace: WallFace | null;
  selectedWallSegmentId: string | null;
  items: ExhibitItem[];
  selectedItem?: ExhibitItem | null;
  spawnLocation: SpawnLocation;
  wallBatchCount: number;
  wallBatchSpacing: number;
  partitionAttachSide: "front" | "back";
  autoAddTopLightstrip: boolean;
  pendingPlacement?: PendingPlacement | null;
  setPendingPlacement: (placement: PendingPlacement | null) => void;
  setWallBatchCount: (count: number) => void;
  clearSelection: () => void;
}

const AUTO_LIGHT_ELIGIBLE_TYPES: ExhibitItem["type"][] = ["painting", "text"];
const WALL_MOUNTED_TYPES: ExhibitItem["type"][] = ["painting", "text", "lightstrip"];

function getItemOffset(type: ExhibitItem["type"]) {
  if (type === "painting" || type === "partition") return 0.1;
  if (type === "lightstrip") return 0.06;
  return 0.5;
}

function getItemYPosition(type: ExhibitItem["type"], roomSize: RoomSize) {
  switch (type) {
    case "partition":
      return roomSize.height / 2;
    case "pedestal":
    case "flower":
    case "vase":
    case "sculpture":
    case "plant":
    case "column":
    case "bench":
      return 0;
    case "spotlight":
      return 0.2;
    case "neon":
      return 1.4;
    case "lightstrip":
      return 2.2;
    case "chandelier":
      return Math.max(2.6, roomSize.height - 0.8);
    case "rug":
      return 0.01;
    default:
      return 1.5;
  }
}

function getItemHeight(type: ExhibitItem["type"]) {
  switch (type) {
    case "painting":
      return 1.5;
    case "text":
      return 1.2;
    case "pedestal":
      return 1;
    case "flower":
      return 0.8;
    case "vase":
      return 1.1;
    case "sculpture":
      return 1.8;
    case "bench":
      return 1.1;
    case "rug":
      return 0.05;
    case "spotlight":
      return 1.2;
    case "plant":
      return 1.4;
    case "column":
      return 3;
    case "neon":
      return 0.8;
    case "lightstrip":
      return 0.12;
    case "chandelier":
      return 1;
    default:
      return 1;
  }
}

function getItemFootprint(type: ExhibitItem["type"]) {
  switch (type) {
    case "painting":
      return 2;
    case "text":
      return 1.6;
    case "pedestal":
      return 1.2;
    case "bench":
    case "rug":
      return 2.4;
    case "sculpture":
      return 1.3;
    case "vase":
      return 0.9;
    case "flower":
      return 0.8;
    case "plant":
      return 1.1;
    case "column":
      return 1;
    case "neon":
      return 1.8;
    case "lightstrip":
      return 2;
    default:
      return 1;
  }
}

function getBatchCount(baseLength: number, wallBatchSpacing: number, wallBatchCount: number) {
  const centerGap = Math.max(0.6, wallBatchSpacing);
  const maxAllowedCount = Math.max(1, Math.floor(Math.max(0, baseLength) / centerGap) + 1);
  const count = Math.max(1, Math.min(maxAllowedCount, Math.floor(wallBatchCount)));
  return { centerGap, count };
}

function arePositionsEqual(a?: Array<[number, number, number]>, b?: Array<[number, number, number]>) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((pos, index) => {
    const other = b[index];
    return Boolean(other) && pos.every((value, axis) => Math.abs(value - other[axis]) < 0.001);
  });
}

function areRotationsEqual(a?: [number, number, number], b?: [number, number, number]) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.every((value, index) => Math.abs(value - b[index]) < 0.001);
}

function buildWallBatchPositions(params: {
  targetFace: WallFace;
  roomSize: RoomSize;
  offset: number;
  yPos: number;
  itemFootprint: number;
  wallBatchSpacing: number;
  wallBatchCount: number;
}) {
  const { targetFace, roomSize, offset, yPos, itemFootprint, wallBatchSpacing, wallBatchCount } = params;
  const hw = roomSize.width / 2;
  const hl = roomSize.length / 2;
  const wallLength = targetFace === "north" || targetFace === "south" ? roomSize.width : roomSize.length;
  const edgePadding = Math.max(0.4, itemFootprint / 2 + 0.2);
  const distributableLength = Math.max(0, wallLength - edgePadding * 2);
  const { count } = getBatchCount(distributableLength, wallBatchSpacing, wallBatchCount);
  const wallCenterZ = targetFace === "north" ? -hl + offset : targetFace === "south" ? hl - offset : 0;
  const wallCenterX = targetFace === "east" ? hw - offset : targetFace === "west" ? -hw + offset : 0;
  const wallRotationY =
    targetFace === "north"
      ? 0
      : targetFace === "south"
        ? Math.PI
        : targetFace === "east"
          ? -Math.PI / 2
          : Math.PI / 2;
  const desiredSpan = count > 1 ? Math.min(distributableLength, wallBatchSpacing * (count - 1)) : 0;
  const step = count > 1 ? desiredSpan / (count - 1) : 0;
  const start = count > 1 ? -desiredSpan / 2 : 0;
  const batchPositions: Array<[number, number, number]> = [];

  for (let i = 0; i < count; i++) {
    const lineOffset = start + step * i;
    batchPositions.push(
      targetFace === "north" || targetFace === "south"
        ? [Math.max(-hw + edgePadding, Math.min(hw - edgePadding, lineOffset)), yPos, wallCenterZ]
        : [wallCenterX, yPos, Math.max(-hl + edgePadding, Math.min(hl - edgePadding, lineOffset))],
    );
  }

  return {
    count,
    wallRotationY,
    batchPositions,
    fallbackPosition:
      batchPositions[0] ??
      (targetFace === "north" || targetFace === "south" ? [0, yPos, wallCenterZ] : [wallCenterX, yPos, 0]),
  };
}

export function useItemPlacement({
  roomSize,
  selectedWallFace,
  selectedWallSegmentId,
  items,
  selectedItem,
  spawnLocation,
  wallBatchCount,
  wallBatchSpacing,
  partitionAttachSide,
  autoAddTopLightstrip,
  pendingPlacement,
  setPendingPlacement,
  setWallBatchCount,
  clearSelection,
}: UseItemPlacementParams) {
  const safeSetPendingPlacement = (placement: PendingPlacement | null) => {
    if (typeof setPendingPlacement === "function") {
      setPendingPlacement(placement);
    }
  };

  const sourcePartition = selectedWallSegmentId
    ? items.find((item) => item.id === selectedWallSegmentId && item.type === "partition")
    : null;
  useEffect(() => {
    if (!pendingPlacement) return;
    if (!WALL_MOUNTED_TYPES.includes(pendingPlacement.type)) return;
    if ((pendingPlacement.batchPositions?.length ?? 0) <= 1) return;

    if (pendingPlacement.surfaceKind === "partition" && selectedItem?.type === "partition" && selectedItem.id === pendingPlacement.surfaceId) {
      const type = pendingPlacement.type;
      const offset = getItemOffset(type);
      const yPos = getItemYPosition(type, roomSize);
      const itemFootprint = getItemFootprint(type);
      const shouldFollowWallAnchorHeight = type === "painting";
      const [px, py, pz] = selectedItem.position;
      const partitionRotationY = selectedItem.rotation[1] || 0;
      const partitionDepth = Math.max(0.1, Math.abs(selectedItem.scale[2] || 0.2));
      const partitionLength = Math.max(0.6, Math.abs(selectedItem.scale[0] || 1));
      const normal = [Math.sin(partitionRotationY), 0, Math.cos(partitionRotationY)] as const;
      const tangent = [Math.cos(partitionRotationY), 0, -Math.sin(partitionRotationY)] as const;
      const attachOffset = partitionDepth / 2 + offset;
      const sideMultiplier = pendingPlacement.wallSide === "back" ? -1 : 1;
      const edgePadding = Math.max(0.35, itemFootprint / 2 + 0.2);
      const distributableLength = Math.max(0, partitionLength - edgePadding * 2);
      const { count } = getBatchCount(distributableLength, wallBatchSpacing, wallBatchCount);
      const desiredSpan = count > 1 ? Math.min(distributableLength, wallBatchSpacing * (count - 1)) : 0;
      const step = count > 1 ? desiredSpan / (count - 1) : 0;
      const start = count > 1 ? -desiredSpan / 2 : 0;
      const attachRotationY = pendingPlacement.wallSide === "back" ? partitionRotationY + Math.PI : partitionRotationY;
      const batchPositions: Array<[number, number, number]> = [];

      for (let i = 0; i < count; i++) {
        const along = start + step * i;
        const clampedAlong = Math.max(-partitionLength / 2 + edgePadding, Math.min(partitionLength / 2 - edgePadding, along));
        batchPositions.push([
          px + tangent[0] * clampedAlong + normal[0] * attachOffset * sideMultiplier,
          shouldFollowWallAnchorHeight ? Math.max(1.2, py) : yPos,
          pz + tangent[2] * clampedAlong + normal[2] * attachOffset * sideMultiplier,
        ]);
      }

      const nextPosition = batchPositions[0] ?? pendingPlacement.position;
      const nextRotation: [number, number, number] = [0, attachRotationY, 0];
      if (
        arePositionsEqual(batchPositions, pendingPlacement.batchPositions) &&
        areRotationsEqual(nextRotation, pendingPlacement.rotation) &&
        areRotationsEqual(nextRotation, pendingPlacement.batchRotation) &&
        nextPosition.every((value, index) => Math.abs(value - pendingPlacement.position[index]) < 0.001)
      ) {
        return;
      }

      safeSetPendingPlacement({
        ...pendingPlacement,
        position: nextPosition,
        rotation: nextRotation,
        batchPositions,
        batchRotation: nextRotation,
      });
      return;
    }

    const targetFace = selectedWallFace ?? (spawnLocation === "center" ? null : spawnLocation);
    if (!targetFace) return;

    const type = pendingPlacement.type;
    const offset = getItemOffset(type);
    const yPos = getItemYPosition(type, roomSize);
    const itemFootprint = getItemFootprint(type);
    const { wallRotationY, batchPositions, fallbackPosition } = buildWallBatchPositions({
      targetFace,
      roomSize,
      offset,
      yPos,
      itemFootprint,
      wallBatchSpacing,
      wallBatchCount,
    });

    const nextPosition = fallbackPosition as [number, number, number];
    const nextRotation: [number, number, number] = [0, wallRotationY, 0];
    if (
      arePositionsEqual(batchPositions, pendingPlacement.batchPositions) &&
      areRotationsEqual(nextRotation, pendingPlacement.rotation) &&
      areRotationsEqual(nextRotation, pendingPlacement.batchRotation) &&
      nextPosition.every((value, index) => Math.abs(value - pendingPlacement.position[index]) < 0.001)
    ) {
      return;
    }

    safeSetPendingPlacement({
      ...pendingPlacement,
      position: nextPosition,
      rotation: nextRotation,
      batchPositions,
      batchRotation: nextRotation,
    });
  }, [pendingPlacement, selectedItem, selectedWallFace, selectedWallSegmentId, items, spawnLocation, roomSize, wallBatchSpacing, wallBatchCount, setPendingPlacement]);

  const handleAddItem = (type: ExhibitItem["type"]) => {
    const sourceSelectedItem = selectedItem ?? sourcePartition;
    clearSelection();
    let position: [number, number, number] = [0, 1.5, 0];
    let rotation: [number, number, number] = [0, 0, 0];

    const shouldAutoLight = autoAddTopLightstrip && AUTO_LIGHT_ELIGIBLE_TYPES.includes(type);
    const buildPlacement = (
      basePosition: [number, number, number],
      baseRotation: [number, number, number],
      extras?: { batchPositions?: Array<[number, number, number]>; batchRotation?: [number, number, number] },
    ): PendingPlacement => ({
      type,
      position: basePosition,
      rotation: baseRotation,
      wallSide: "front",
      surfaceKind: "room-wall",
      surfaceId: selectedWallFace,
      batchPositions: extras?.batchPositions,
      batchRotation: extras?.batchRotation,
      autoTopLightstrip: shouldAutoLight,
    });

    const hw = roomSize.width / 2;
    const hl = roomSize.length / 2;
    const offset = getItemOffset(type);
    const yPos = getItemYPosition(type, roomSize);
    const isWallMounted = WALL_MOUNTED_TYPES.includes(type);
    const shouldFollowWallAnchorHeight = type === "painting";
    const itemHeight = getItemHeight(type);
    const itemFootprint = getItemFootprint(type);
    const isPartitionAttachMode = isWallMounted && sourceSelectedItem?.type === "partition";

    if (isWallMounted && !isPartitionAttachMode) {
      const targetFace: WallFace = selectedWallFace ?? (type === "lightstrip" ? "north" : spawnLocation === "center" ? "north" : spawnLocation);
      const { count, wallRotationY, batchPositions, fallbackPosition } = buildWallBatchPositions({
        targetFace,
        roomSize,
        offset,
        yPos,
        itemFootprint,
        wallBatchSpacing,
        wallBatchCount,
      });

      if (count !== wallBatchCount) {
        setWallBatchCount(count);
      }

      const placement = buildPlacement(fallbackPosition as [number, number, number], [0, wallRotationY, 0], {
        batchPositions,
        batchRotation: [0, wallRotationY, 0],
      });
      safeSetPendingPlacement(placement);
      return;
    }

    if (isPartitionAttachMode && sourceSelectedItem) {
      const [px, py, pz] = sourceSelectedItem.position;
      const partitionRotationY = sourceSelectedItem.rotation[1] || 0;
      const partitionDepth = Math.max(0.1, Math.abs(sourceSelectedItem.scale[2] || 0.2));
      const partitionLength = Math.max(0.6, Math.abs(sourceSelectedItem.scale[0] || 1));
      const normal = [Math.sin(partitionRotationY), 0, Math.cos(partitionRotationY)] as const;
      const tangent = [Math.cos(partitionRotationY), 0, -Math.sin(partitionRotationY)] as const;
      const attachOffset = partitionDepth / 2 + offset;
      const sideMultiplier = partitionAttachSide === "front" ? 1 : -1;
      const edgePadding = Math.max(0.35, itemFootprint / 2 + 0.2);
      const distributableLength = Math.max(0, partitionLength - edgePadding * 2);
      const { count } = getBatchCount(distributableLength, wallBatchSpacing, wallBatchCount);

      if (count !== wallBatchCount) {
        setWallBatchCount(count);
      }

      const desiredSpan = count > 1 ? Math.min(distributableLength, wallBatchSpacing * (count - 1)) : 0;
      const step = count > 1 ? desiredSpan / (count - 1) : 0;
      const start = count > 1 ? -desiredSpan / 2 : 0;
      const attachRotationY = partitionAttachSide === "back" ? partitionRotationY + Math.PI : partitionRotationY;
      const batchPositions: Array<[number, number, number]> = [];

      for (let i = 0; i < count; i++) {
        const along = start + step * i;
        const clampedAlong = Math.max(-partitionLength / 2 + edgePadding, Math.min(partitionLength / 2 - edgePadding, along));
        batchPositions.push([
          px + tangent[0] * clampedAlong + normal[0] * attachOffset * sideMultiplier,
          type === "partition" ? yPos : shouldFollowWallAnchorHeight ? Math.max(1.2, py) : yPos,
          pz + tangent[2] * clampedAlong + normal[2] * attachOffset * sideMultiplier,
        ]);
      }

      const placement = buildPlacement(
        batchPositions[0] ?? [
          px + normal[0] * attachOffset * sideMultiplier,
          type === "partition" ? yPos : shouldFollowWallAnchorHeight ? Math.max(1.2, py) : yPos,
          pz + normal[2] * attachOffset * sideMultiplier,
        ],
        [0, attachRotationY, 0],
        {
          batchPositions,
          batchRotation: [0, attachRotationY, 0],
        },
      );
      const nextPlacement: PendingPlacement = {
        ...placement,
        surfaceKind: "partition",
        surfaceId: sourceSelectedItem.id,
        wallSide: partitionAttachSide,
      };
      safeSetPendingPlacement(nextPlacement);
      return;
    }

    const targetWall: WallFace | "center" =
      selectedWallFace || (type === "lightstrip" ? "north" : spawnLocation);

    if (isWallMounted && targetWall !== "center" && wallBatchCount > 1) {
      const { count, wallRotationY, batchPositions, fallbackPosition } = buildWallBatchPositions({
        targetFace: targetWall,
        roomSize,
        offset,
        yPos,
        itemFootprint,
        wallBatchSpacing,
        wallBatchCount,
      });

      if (count !== wallBatchCount) {
        setWallBatchCount(count);
      }

      safeSetPendingPlacement(
        buildPlacement(fallbackPosition as [number, number, number], [0, wallRotationY, 0], {
          batchPositions,
          batchRotation: [0, wallRotationY, 0],
        }),
      );
      return;
    }

    if (isWallMounted && targetWall === "north") {
      position = [0, yPos, -hl + offset];
      rotation = [0, 0, 0];
    } else if (isWallMounted && targetWall === "south") {
      position = [0, yPos, hl - offset];
      rotation = [0, Math.PI, 0];
    } else if (isWallMounted && targetWall === "east") {
      position = [hw - offset, yPos, 0];
      rotation = [0, -Math.PI / 2, 0];
    } else if (isWallMounted && targetWall === "west") {
      position = [-hw + offset, yPos, 0];
      rotation = [0, Math.PI / 2, 0];
    } else {
      position = [0, yPos, 0];
      rotation = [0, 0, 0];
    }

    const finalY = shouldFollowWallAnchorHeight ? Math.max(position[1], Math.min(roomSize.height - itemHeight / 2 - 0.4, yPos)) : position[1];
    const nextPlacement = buildPlacement([position[0], finalY, position[2]], rotation);
    safeSetPendingPlacement(nextPlacement);
  };

  return { handleAddItem };
}
