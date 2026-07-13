import { useEffect, useMemo, useRef, useState, memo } from "react";
import { useStore } from "../store/useStore";
import { ExhibitItem, WallAnchor, WallFace, WallMaterialSettings } from "../types";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Plane, Raycaster, RepeatWrapping, Vector3 } from "three";
import { ReactNode } from "react";
import { buildWallTopology, getFloorPlanCenter, getFloorPlanRoomBounds } from "../store/floorPlanGeometry";

type WallSegment = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number, number];
  face: WallFace;
  rotationY: number;
};

type PartitionSurface = {
  id: string;
  position: [number, number, number];
  rotationY: number;
  length: number;
  depth: number;
  isLocked: boolean;
};

function getPreviewBox(type: ExhibitItem["type"]): [number, number, number] {
  if (type === "painting") return [2, 1.5, 0.12];
  if (type === "text") return [1.6, 1.2, 0.12];
  if (type === "partition") return [5, 3, 0.2];
  if (type === "lightstrip") return [2, 0.12, 0.12];
  if (type === "flower") return [0.8, 0.8, 0.8];
  if (type === "chandelier") return [0.9, 0.9, 0.9];
  if (type === "bench") return [2.4, 1.1, 1];
  if (type === "rug") return [2.4, 0.04, 1.6];
  if (type === "vase") return [0.9, 1.1, 0.9];
  if (type === "sculpture") return [1.3, 1.8, 1.3];
  if (type === "spotlight") return [0.9, 1.2, 0.9];
  if (type === "plant") return [1.1, 1.4, 1.1];
  if (type === "column") return [1, 3, 1];
  if (type === "neon") return [1.8, 0.8, 0.12];
  return [1, 1, 1];
}

const PreviewGhost = memo(function PreviewGhost({
  type,
  position,
  rotation,
  surfaceKind,
}: {
  type: ExhibitItem["type"];
  position: [number, number, number];
  rotation: [number, number, number];
  surfaceKind?: "room-wall" | "partition";
}) {
  const box = getPreviewBox(type);
  const isWallMounted = type === "painting" || type === "text" || type === "lightstrip";
  const isPartitionPreview = surfaceKind === "partition";
  const offsetZ = isWallMounted ? (isPartitionPreview ? 0.16 : 0.08) : 0;

  return (
    <group position={position} rotation={rotation}>
      {isPartitionPreview && isWallMounted && (
        <mesh position={[0, 0, offsetZ + 0.02]}>
          <boxGeometry args={[box[0] + 0.08, box[1] + 0.08, Math.max(0.08, box[2] + 0.06)]} />
          <meshStandardMaterial color="#93c5fd" transparent opacity={0.2} depthWrite={false} />
        </mesh>
      )}
      <mesh position={[0, 0, offsetZ]} renderOrder={10}>
        <boxGeometry args={box} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={isWallMounted ? 0.85 : 0.28} wireframe={!isPartitionPreview} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
});

const Collision = memo(function Collision({ enabled, children, ...props }: { enabled: boolean; children: ReactNode; [key: string]: any }) {
  if (!enabled) {
    return (
      <group position={props.position} rotation={props.rotation} scale={props.scale}>
        {children}
      </group>
    );
  }

  return (
    <group position={props.position} rotation={props.rotation} scale={props.scale}>
      {children}
    </group>
  );
});

function createSegments(start: number, end: number, cuts: Array<[number, number]>) {
  const normalized = cuts
    .map(([s, e]) => [Math.max(start, Math.min(s, e)), Math.min(end, Math.max(s, e))] as [number, number])
    .filter(([s, e]) => e - s > 0.05)
    .sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const [s, e] of normalized) {
    const last = merged[merged.length - 1];
    if (!last || s > last[1]) merged.push([s, e]);
    else last[1] = Math.max(last[1], e);
  }

  const result: Array<[number, number]> = [];
  let cursor = start;
  for (const [s, e] of merged) {
    if (s - cursor > 0.08) result.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (end - cursor > 0.08) result.push([cursor, end]);
  return result;
}

export function Room() {
  const mode = useStore((state) => state.mode);
  const roomSize = useStore((state) => state.roomSize);
  const selectedWallFace = useStore((state) => state.selectedWallFace);
  const selectedWallSegmentId = useStore((state) => state.selectedWallSegmentId);
  const pendingPlacement = useStore((state) => state.pendingPlacement);
  const items = useStore((state) => state.items);
  const wallMaterialOverrides = useStore((state) => state.wallMaterialOverrides);
  const setSelectedWallFace = useStore((state) => state.setSelectedWallFace);
  const setSelectedWallAnchor = useStore((state) => state.setSelectedWallAnchor);
  const setSelectedWallSegmentId = useStore((state) => state.setSelectedWallSegmentId);
  const setSelectedItemId = useStore((state) => state.setSelectedItemId);
  const setPendingPlacement = useStore((state) => state.setPendingPlacement);
  const addItem = useStore((state) => state.addItem);
  const floorPlanElements = useStore((state) => state.floorPlanElements);
  const isView = mode === "view";
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const previewRef = useRef<any>(null);
  const isWallMountedPending = pendingPlacement?.type === "painting" || pendingPlacement?.type === "text" || pendingPlacement?.type === "lightstrip";
  const { camera, pointer } = useThree();

  const roomBounds = useMemo(
    () => getFloorPlanRoomBounds(floorPlanElements, roomSize.width, roomSize.length),
    [floorPlanElements, roomSize.width, roomSize.length],
  );

  const center = useMemo(() => getFloorPlanCenter(roomBounds), [roomBounds]);

  const roomExtents = useMemo(() => ({
    minX: Math.min(...roomBounds.map((b) => b.minX)) - center.x,
    maxX: Math.max(...roomBounds.map((b) => b.maxX)) - center.x,
    minZ: Math.min(...roomBounds.map((b) => b.minZ)) - center.z,
    maxZ: Math.max(...roomBounds.map((b) => b.maxZ)) - center.z,
  }), [roomBounds, center.x, center.z]);

  const partitionSurfaces = useMemo<PartitionSurface[]>(() => {
    return items
      .filter((candidate) => candidate.type === "partition")
      .map((partition) => ({
        id: partition.id,
        position: partition.position,
        rotationY: partition.rotation[1] || 0,
        length: Math.max(0.6, Math.abs(partition.scale[0] || 1)),
        depth: Math.max(0.1, Math.abs(partition.scale[2] || 0.2)),
        isLocked: Boolean(partition.isLocked),
      }));
  }, [items]);

  const wallSegments = useMemo<WallSegment[]>(() => {
    const topology = buildWallTopology(roomBounds, roomSize.height, Math.max(0.12, roomSize.wallThickness), center);
    return topology.segments;
  }, [roomBounds, roomSize.height, roomSize.wallThickness, center]);

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const createAutoTopLightstripPlacement = (
    targetType: ExhibitItem["type"],
    position: [number, number, number],
    rotation: [number, number, number],
  ) => {
    const autoLightEligibleTypes: ExhibitItem["type"][] = ["painting", "text"];
    if (!autoLightEligibleTypes.includes(targetType)) return null;

    const itemHeight = targetType === "painting" ? 1.5 : targetType === "text" ? 1.2 : 1;
    const desired = position[1] + itemHeight / 2 + 0.22;
    const lightY = Math.max(1.6, Math.min(roomSize.height - 0.2, desired));

    return {
      position: [position[0], lightY, position[2]] as [number, number, number],
      rotation: [0, rotation[1] ?? 0, 0] as [number, number, number],
    };
  };

  const placePendingItemOnWall = (
    wall: WallSegment,
    point: { x: number; y: number; z: number },
  ) => {
    if (!pendingPlacement) return;

    const resolved = resolveWallPreviewPlacement(wall, point);
    const placements = resolved.batchPositions?.length ? resolved.batchPositions : [resolved.position];
    const rotations = placements.map(() => resolved.rotation);

    placements.forEach((position, index) => {
      const rotation = rotations[index] ?? resolved.rotation;
      addItem(pendingPlacement.type, { position, rotation });

      if (pendingPlacement.autoTopLightstrip) {
        const lightPlacement = createAutoTopLightstripPlacement(pendingPlacement.type, position, rotation);
        if (lightPlacement) {
          addItem("lightstrip", lightPlacement);
        }
      }
    });

    setPendingPlacement(null);
    setSelectedWallSegmentId(null);
    setSelectedWallAnchor(null);
    setSelectedWallFace(null);
    setHoveredWallId(null);
  };

  const getWallMountedExtent = (type: string) => {
    if (type === "painting") return { horizontal: 1, vertical: 0.75 };
    if (type === "text") return { horizontal: 0.8, vertical: 0.6 };
    if (type === "lightstrip") return { horizontal: 1, vertical: 0.06 };
    return { horizontal: 0.6, vertical: 0.6 };
  };

  const getFreePlacementY = (type: string) => {
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
  };

  const resolveFreePlacement = (point: { x: number; y: number; z: number }) => {
    const type = pendingPlacement?.type ?? "pedestal";
    const snapStep = type === "rug" ? 0.25 : 0.5;
    const snapValue = (value: number, step: number) => Math.round(value / step) * step;
    const minX = roomExtents.minX + 0.5;
    const maxX = roomExtents.maxX - 0.5;
    const minZ = roomExtents.minZ + 0.5;
    const maxZ = roomExtents.maxZ - 0.5;
    const x = Math.max(minX, Math.min(maxX, snapValue(point.x, snapStep)));
    const z = Math.max(minZ, Math.min(maxZ, snapValue(point.z, snapStep)));
    const y = getFreePlacementY(type);
    const rotation = pendingPlacement?.rotation ?? [0, 0, 0];
    return {
      position: [x, y, z] as [number, number, number],
      rotation,
    };
  };

  useEffect(() => {
    if (mode !== "edit" || !pendingPlacement || isWallMountedPending) return;

    const raycaster = new Raycaster();
    const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
    const hit = new Vector3();
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(floorPlane, hit)) return;

    const next = resolveFreePlacement({ x: hit.x, y: hit.y, z: hit.z });
    const current = pendingPlacement.position;
    const [nx, ny, nz] = next.position;
    if (Math.abs(current[0] - nx) < 0.001 && Math.abs(current[1] - ny) < 0.001 && Math.abs(current[2] - nz) < 0.001) return;

    setPendingPlacement({
      ...pendingPlacement,
      position: next.position,
      rotation: next.rotation,
      batchPositions: undefined,
      batchRotation: undefined,
    });
  }, [mode, pendingPlacement, isWallMountedPending, pointer.x, pointer.y, camera, setPendingPlacement]);

  const resolveWallPreviewPlacement = (wall: WallSegment, point: { x: number; y: number; z: number }) => {
    const extent = getWallMountedExtent(pendingPlacement?.type ?? "painting");
    const edgePadding = 0.12;
    const wallDepthOffset = roomSize.wallThickness / 2 + 0.02;
    const isBackSide = pendingPlacement?.wallSide === "back";
    const normalSign = isBackSide ? -1 : 1;
    const snapStep = pendingPlacement?.type === "text" ? 0.25 : 0.5;
    const snapValue = (value: number) => Math.round(value / snapStep) * snapStep;
    const snapVertical = clamp(snapValue(point.y), extent.vertical + 0.2, roomSize.height - extent.vertical - 0.2);
    const batchPositions = pendingPlacement?.batchPositions ?? [];
    const batchCount = batchPositions.length;
    const reference = batchCount > 0 ? batchPositions[0] : pendingPlacement?.position;
    const deltas = batchCount > 0 && reference
      ? batchPositions.map((position) => [position[0] - reference[0], position[1] - reference[1], position[2] - reference[2]] as [number, number, number])
      : [[0, 0, 0] as [number, number, number]];

    if (wall.face === "north" || wall.face === "south") {
      const deltaXs = deltas.map((delta) => delta[0]);
      const minDeltaX = Math.min(...deltaXs);
      const maxDeltaX = Math.max(...deltaXs);
      const minX = wall.position[0] - wall.size[0] / 2 + extent.horizontal + edgePadding - minDeltaX;
      const maxX = wall.position[0] + wall.size[0] / 2 - extent.horizontal - edgePadding - maxDeltaX;
      const anchorX = clamp(snapValue(point.x), minX, maxX);
      const resolvedPositions = deltas.map((delta) => [
        anchorX + delta[0],
        snapVertical + delta[1],
        wall.position[2] + (wall.face === "north" ? wallDepthOffset * normalSign : -wallDepthOffset * normalSign),
      ] as [number, number, number]);
      const anchorPosition = resolvedPositions[0] ?? [
        anchorX,
        snapVertical,
        wall.position[2] + (wall.face === "north" ? wallDepthOffset * normalSign : -wallDepthOffset * normalSign),
      ] as [number, number, number];

      return {
        position: anchorPosition,
        batchPositions: resolvedPositions,
        rotation: [0, isBackSide ? wall.rotationY + Math.PI : wall.rotationY, 0] as [number, number, number],
        guides: {
          horizontalStart: [wall.position[0] - wall.size[0] / 2 + extent.horizontal + edgePadding, snapVertical, wall.position[2] + (wall.face === "north" ? wallDepthOffset * normalSign : -wallDepthOffset * normalSign)] as [number, number, number],
          horizontalEnd: [wall.position[0] + wall.size[0] / 2 - extent.horizontal - edgePadding, snapVertical, wall.position[2] + (wall.face === "north" ? wallDepthOffset * normalSign : -wallDepthOffset * normalSign)] as [number, number, number],
          verticalStart: [anchorPosition[0], extent.vertical + 0.2, wall.position[2] + (wall.face === "north" ? wallDepthOffset * normalSign : -wallDepthOffset * normalSign)] as [number, number, number],
          verticalEnd: [anchorPosition[0], roomSize.height - extent.vertical - 0.2, wall.position[2] + (wall.face === "north" ? wallDepthOffset * normalSign : -wallDepthOffset * normalSign)] as [number, number, number],
        },
      };
    }

    const deltaZs = deltas.map((delta) => delta[2]);
    const minDeltaZ = Math.min(...deltaZs);
    const maxDeltaZ = Math.max(...deltaZs);
    const minZ = wall.position[2] - wall.size[0] / 2 + extent.horizontal + edgePadding - minDeltaZ;
    const maxZ = wall.position[2] + wall.size[0] / 2 - extent.horizontal - edgePadding - maxDeltaZ;
    const anchorZ = clamp(snapValue(point.z), minZ, maxZ);
    const resolvedPositions = deltas.map((delta) => [
      wall.position[0] + (wall.face === "east" ? -wallDepthOffset * normalSign : wallDepthOffset * normalSign),
      snapVertical + delta[1],
      anchorZ + delta[2],
    ] as [number, number, number]);
    const anchorPosition = resolvedPositions[0] ?? [
      wall.position[0] + (wall.face === "east" ? -wallDepthOffset * normalSign : wallDepthOffset * normalSign),
      snapVertical,
      anchorZ,
    ] as [number, number, number];

    return {
      position: anchorPosition,
      batchPositions: resolvedPositions,
      rotation: [0, isBackSide ? wall.rotationY + Math.PI : wall.rotationY, 0] as [number, number, number],
      guides: {
        horizontalStart: [wall.position[0] + (wall.face === "east" ? -wallDepthOffset * normalSign : wallDepthOffset * normalSign), snapVertical, wall.position[2] - wall.size[0] / 2 + extent.horizontal + edgePadding] as [number, number, number],
        horizontalEnd: [wall.position[0] + (wall.face === "east" ? -wallDepthOffset * normalSign : wallDepthOffset * normalSign), snapVertical, wall.position[2] + wall.size[0] / 2 - extent.horizontal - edgePadding] as [number, number, number],
        verticalStart: [anchorPosition[0], extent.vertical + 0.2, anchorPosition[2]] as [number, number, number],
        verticalEnd: [anchorPosition[0], roomSize.height - extent.vertical - 0.2, anchorPosition[2]] as [number, number, number],
      },
    };
  };

  const resolvePartitionPreviewPlacement = (partition: PartitionSurface, point: { x: number; y: number; z: number }) => {
    const extent = getWallMountedExtent(pendingPlacement?.type ?? "painting");
    const edgePadding = 0.12;
    const wallDepthOffset = roomSize.wallThickness / 2 + 0.02;
    const isBackSide = pendingPlacement?.wallSide === "back";
    const sideMultiplier = isBackSide ? -1 : 1;
    const snapStep = pendingPlacement?.type === "text" ? 0.25 : 0.5;
    const snapValue = (value: number) => Math.round(value / snapStep) * snapStep;
    const snapVertical = clamp(snapValue(point.y), extent.vertical + 0.2, roomSize.height - extent.vertical - 0.2);
    const normal = [Math.sin(partition.rotationY), 0, Math.cos(partition.rotationY)] as const;
    const tangent = [Math.cos(partition.rotationY), 0, -Math.sin(partition.rotationY)] as const;
    const batchPositions = pendingPlacement?.batchPositions ?? [];
    const batchCount = batchPositions.length;
    const reference = batchCount > 0 ? batchPositions[0] : pendingPlacement?.position;
    const deltas = batchCount > 0 && reference
      ? batchPositions.map((position) => {
          const dx = position[0] - reference[0];
          const dz = position[2] - reference[2];
          const along = dx * tangent[0] + dz * tangent[2];
          return [along, position[1] - reference[1]] as [number, number];
        })
      : [[0, 0] as [number, number]];

    const relativeX = point.x - partition.position[0];
    const relativeZ = point.z - partition.position[2];
    const alongPoint = relativeX * tangent[0] + relativeZ * tangent[2];
    const deltaAlongs = deltas.map((delta) => delta[0]);
    const minDeltaAlong = Math.min(...deltaAlongs);
    const maxDeltaAlong = Math.max(...deltaAlongs);
    const minAlong = -partition.length / 2 + extent.horizontal + edgePadding - minDeltaAlong;
    const maxAlong = partition.length / 2 - extent.horizontal - edgePadding - maxDeltaAlong;
    const anchorAlong = clamp(snapValue(alongPoint), minAlong, maxAlong);

    const resolvedPositions = deltas.map((delta) => {
      const along = anchorAlong + delta[0];
      return [
        partition.position[0] + tangent[0] * along + normal[0] * (partition.depth / 2 + wallDepthOffset) * sideMultiplier,
        snapVertical + delta[1],
        partition.position[2] + tangent[2] * along + normal[2] * (partition.depth / 2 + wallDepthOffset) * sideMultiplier,
      ] as [number, number, number];
    });

    const anchorPosition = resolvedPositions[0] ?? [
      partition.position[0] + normal[0] * (partition.depth / 2 + wallDepthOffset) * sideMultiplier,
      snapVertical,
      partition.position[2] + normal[2] * (partition.depth / 2 + wallDepthOffset) * sideMultiplier,
    ] as [number, number, number];

    return {
      position: anchorPosition,
      batchPositions: resolvedPositions,
      rotation: [0, isBackSide ? partition.rotationY + Math.PI : partition.rotationY, 0] as [number, number, number],
      guides: {
        horizontalStart: [
          partition.position[0] + tangent[0] * (-partition.length / 2 + extent.horizontal + edgePadding) + normal[0] * (partition.depth / 2 + wallDepthOffset) * sideMultiplier,
          snapVertical,
          partition.position[2] + tangent[2] * (-partition.length / 2 + extent.horizontal + edgePadding) + normal[2] * (partition.depth / 2 + wallDepthOffset) * sideMultiplier,
        ] as [number, number, number],
        horizontalEnd: [
          partition.position[0] + tangent[0] * (partition.length / 2 - extent.horizontal - edgePadding) + normal[0] * (partition.depth / 2 + wallDepthOffset) * sideMultiplier,
          snapVertical,
          partition.position[2] + tangent[2] * (partition.length / 2 - extent.horizontal - edgePadding) + normal[2] * (partition.depth / 2 + wallDepthOffset) * sideMultiplier,
        ] as [number, number, number],
        verticalStart: [anchorPosition[0], extent.vertical + 0.2, anchorPosition[2]] as [number, number, number],
        verticalEnd: [anchorPosition[0], roomSize.height - extent.vertical - 0.2, anchorPosition[2]] as [number, number, number],
      },
    };
  };

  const handleWallPointerDown = (wall: WallSegment, e: any) => {
    if (mode !== "edit") return;
    e.stopPropagation();
    console.log("[Room] wall pointer down", {
      wallId: wall.id,
      wallFace: wall.face,
      button: e.button,
      hasPendingPlacement: Boolean(pendingPlacement),
      pendingType: pendingPlacement?.type ?? null,
    });

    if (pendingPlacement && !isWallMountedPending) {
      return;
    }

    if (pendingPlacement) {
      if (typeof e.button === "number" && e.button !== 0) {
        return;
      }

      placePendingItemOnWall(wall, {
        x: e.point.x,
        y: e.point.y,
        z: e.point.z,
      });
      return;
    }

    setSelectedWallSegmentId(wall.id);
    const anchor: WallAnchor = {
      face: wall.face,
      position: wall.position,
      rotationY: wall.rotationY,
    };
    setSelectedWallAnchor(anchor);
    setSelectedWallFace(wall.face);
  };

  const handlePartitionPointerDown = (partition: PartitionSurface, e: any) => {
    if (mode !== "edit") return;
    e.stopPropagation();

    if (partition.isLocked && !pendingPlacement) {
      return;
    }

    if (pendingPlacement && !isWallMountedPending) {
      return;
    }

    if (pendingPlacement) {
      if (typeof e.button === "number" && e.button !== 0) {
        return;
      }

      const resolved = resolvePartitionPreviewPlacement(partition, {
        x: e.point.x,
        y: e.point.y,
        z: e.point.z,
      });
      const placements = resolved.batchPositions?.length ? resolved.batchPositions : [resolved.position];
      placements.forEach((position) => {
        addItem(pendingPlacement.type, { position, rotation: resolved.rotation });
        if (pendingPlacement.autoTopLightstrip) {
          const lightPlacement = createAutoTopLightstripPlacement(pendingPlacement.type, position, resolved.rotation);
          if (lightPlacement) addItem("lightstrip", lightPlacement);
        }
      });

      setPendingPlacement(null);
      setSelectedWallSegmentId(null);
      setSelectedWallAnchor(null);
      setSelectedWallFace(null);
      setHoveredWallId(null);
      return;
    }

    setSelectedItemId(partition.id);
    setSelectedWallSegmentId(partition.id);
    setSelectedWallAnchor({
      face: "north",
      position: partition.position,
      rotationY: partition.rotationY,
    });
    setSelectedWallFace(null);
  };

  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.traverse((child: any) => {
        if (child) {
          child.raycast = () => null;
        }
      });
    }
  }, [pendingPlacement]);

  useEffect(() => {
    if (mode !== "edit" || !pendingPlacement) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPendingPlacement(null);
        return;
      }

      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        const nextSide = pendingPlacement.wallSide === "front" ? "back" : "front";
        setPendingPlacement({
          ...pendingPlacement,
          wallSide: nextSide,
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, pendingPlacement, setPendingPlacement]);

  useEffect(() => {
    if (mode !== "edit") {
      setSelectedWallSegmentId(null);
      setHoveredWallId(null);
      return;
    }

    if (!selectedWallSegmentId) return;
    const exists = wallSegments.some((wall) => wall.id === selectedWallSegmentId);
    if (!exists) setSelectedWallSegmentId(null);
  }, [mode, selectedWallSegmentId, wallSegments, setSelectedWallSegmentId]);

  const resolvedWallTextureUrl = roomSize.wallTextureUrl || "/textures/wall-paint.svg";
  const resolvedFloorTextureUrl = roomSize.floorTextureUrl || "/textures/wall-concrete.svg";

  const textureUrls = useMemo(() => {
    const urls = new Set<string>([resolvedWallTextureUrl, resolvedFloorTextureUrl]);
    Object.values(wallMaterialOverrides).forEach((override) => {
      if (override.wallTextureUrl) {
        urls.add(override.wallTextureUrl);
      }
    });
    return Array.from(urls).filter(Boolean);
  }, [resolvedWallTextureUrl, resolvedFloorTextureUrl, wallMaterialOverrides]);

  const loadedTextures = useTexture(textureUrls);
  const textureMap = useMemo(() => {
    const textures = Array.isArray(loadedTextures) ? loadedTextures : [loadedTextures];
    return textureUrls.reduce<Record<string, any>>((acc, url, index) => {
      const texture = textures[index];
      if (texture) {
        acc[url] = texture;
      }
      return acc;
    }, {});
  }, [loadedTextures, textureUrls]);

  useEffect(() => {
    Object.entries(textureMap).forEach(([url, texture]) => {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      const tiling =
        url === resolvedFloorTextureUrl
          ? roomSize.floorTextureTiling
          : Object.values(wallMaterialOverrides).find((override) => override.wallTextureUrl === url)?.wallTextureTiling ??
            roomSize.wallTextureTiling;
      texture.repeat.set(tiling, tiling);
      texture.center.set(0.5, 0.5);
      texture.needsUpdate = true;
    });
  }, [textureMap, resolvedFloorTextureUrl, roomSize.floorTextureTiling, roomSize.wallTextureTiling, wallMaterialOverrides]);

  const resolveWallMaterial = (segmentId: string): WallMaterialSettings => {
    const override = wallMaterialOverrides[segmentId] || {};
    return {
      wallColor: override.wallColor ?? roomSize.wallColor,
      wallMaterialPreset: override.wallMaterialPreset ?? roomSize.wallMaterialPreset,
      wallTextureUrl: override.wallTextureUrl ?? resolvedWallTextureUrl,
      wallTextureTiling: override.wallTextureTiling ?? roomSize.wallTextureTiling,
      wallRoughness: override.wallRoughness ?? roomSize.wallRoughness,
      wallMetalness: override.wallMetalness ?? roomSize.wallMetalness,
      wallBumpScale: override.wallBumpScale ?? roomSize.wallBumpScale,
      wallEnvIntensity: override.wallEnvIntensity ?? roomSize.wallEnvIntensity,
      wallOpacity: override.wallOpacity ?? roomSize.wallOpacity,
      wallTransmission: override.wallTransmission ?? roomSize.wallTransmission,
      wallIor: override.wallIor ?? roomSize.wallIor,
    };
  };

  const previewGuide = useMemo(() => {
    if (!pendingPlacement || !isWallMountedPending) return null;

    if (pendingPlacement.surfaceKind === "partition" && pendingPlacement.surfaceId) {
      const partition = partitionSurfaces.find((surface) => surface.id === pendingPlacement.surfaceId);
      if (!partition) return null;
      return resolvePartitionPreviewPlacement(partition, {
        x: pendingPlacement.position[0],
        y: pendingPlacement.position[1],
        z: pendingPlacement.position[2],
      }).guides;
    }

    if (!selectedWallSegmentId) return null;
    const wall = wallSegments.find((segment) => segment.id === selectedWallSegmentId);
    if (!wall) return null;
    return resolveWallPreviewPlacement(wall, {
      x: pendingPlacement.position[0],
      y: pendingPlacement.position[1],
      z: pendingPlacement.position[2],
    }).guides;
  }, [pendingPlacement, isWallMountedPending, selectedWallSegmentId, wallSegments, partitionSurfaces]);

  const previewPositions = pendingPlacement?.batchPositions?.length
    ? pendingPlacement.batchPositions
    : pendingPlacement
      ? [pendingPlacement.position]
      : [];
  const previewRotation = pendingPlacement?.batchRotation ?? pendingPlacement?.rotation ?? [0, 0, 0];
  const previewIsPartitionMounted = pendingPlacement?.surfaceKind === "partition";

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.debug("[Room] pendingPlacement changed", {
      type: pendingPlacement?.type ?? null,
      surfaceKind: pendingPlacement?.surfaceKind ?? null,
      surfaceId: pendingPlacement?.surfaceId ?? null,
      position: pendingPlacement?.position ?? null,
      batchCount: pendingPlacement?.batchPositions?.length ?? 0,
      rotation: pendingPlacement?.rotation ?? null,
    });
  }, [pendingPlacement]);

  return (
    <group>
      {pendingPlacement && (
        <group ref={previewRef}>
          {previewPositions.map((position, index) => (
            <PreviewGhost
              key={`${pendingPlacement.type}-preview-${index}`}
              type={pendingPlacement.type}
              position={position}
              rotation={previewRotation as [number, number, number]}
              surfaceKind={pendingPlacement.surfaceKind}
            />
          ))}
          {previewGuide && (
            <>
              {previewIsPartitionMounted && (
                <mesh position={[0, 0, 0]} renderOrder={8}>
                  <boxGeometry args={[0.08, 0.08, 0.08]} />
                  <meshStandardMaterial color="#38bdf8" transparent opacity={0.95} depthWrite={false} />
                </mesh>
              )}
              <line>
                <bufferGeometry attach="geometry">
                  <bufferAttribute
                    attach="attributes-position"
                    count={2}
                    array={new Float32Array([...previewGuide.horizontalStart, ...previewGuide.horizontalEnd])}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color="#22d3ee" transparent opacity={0.85} />
              </line>
              <line>
                <bufferGeometry attach="geometry">
                  <bufferAttribute
                    attach="attributes-position"
                    count={2}
                    array={new Float32Array([...previewGuide.verticalStart, ...previewGuide.verticalEnd])}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color="#a78bfa" transparent opacity={0.85} />
              </line>
            </>
          )}
        </group>
      )}
      {roomBounds.map((room, idx) => {
        const width = room.maxX - room.minX;
        const length = room.maxZ - room.minZ;
        const cx = (room.minX + room.maxX) / 2 - center.x;
        const cz = (room.minZ + room.maxZ) / 2 - center.z;

        const floorTexture = textureMap[resolvedFloorTextureUrl];

        return (
          <group key={`room-surface-${room.id}-${idx}`}>
            <Collision enabled={isView} type="fixed" position={[cx, -0.05, cz]}>
              <mesh
                receiveShadow
                onPointerMove={(e) => {
                  if (mode !== "edit" || !pendingPlacement || isWallMountedPending) return;
                  e.stopPropagation();
                  const next = resolveFreePlacement(e.point);
                  setPendingPlacement({
                    ...pendingPlacement,
                    position: next.position,
                    rotation: next.rotation,
                    batchPositions: undefined,
                    batchRotation: undefined,
                  });
                }}
                onPointerDown={(e) => {
                  if (mode !== "edit" || !pendingPlacement || isWallMountedPending) return;
                  e.stopPropagation();
                  const next = resolveFreePlacement(e.point);
                  addItem(pendingPlacement.type, { position: next.position, rotation: next.rotation });
                  if (pendingPlacement.autoTopLightstrip) {
                    const lightPlacement = createAutoTopLightstripPlacement(pendingPlacement.type, next.position, next.rotation);
                    if (lightPlacement) addItem("lightstrip", lightPlacement);
                  }
                  setPendingPlacement(null);
                  setSelectedWallSegmentId(null);
                  setSelectedWallAnchor(null);
                  setSelectedWallFace(null);
                  setHoveredWallId(null);
                }}
              >
                <boxGeometry args={[width, 0.1, length]} />
                <meshPhysicalMaterial
                  map={floorTexture}
                  color={roomSize.floorColor}
                  roughness={Math.max(0.25, roomSize.floorRoughness)}
                  metalness={Math.min(0.12, roomSize.floorMetalness ?? 0)}
                  envMapIntensity={Math.max(0.12, roomSize.environmentBrightness * 0.42)}
                  clearcoat={0.08}
                  clearcoatRoughness={0.92}
                />
              </mesh>
            </Collision>

            {isView && (
              <Collision enabled type="fixed" position={[cx, roomSize.height + 0.05, cz]}>
                <mesh receiveShadow>
                  <boxGeometry args={[width, 0.1, length]} />
                  <meshStandardMaterial color="#f3f4f6" />
                </mesh>
              </Collision>
            )}
          </group>
        );
      })}

      {partitionSurfaces.map((partition) => {
        const isSelectedWall = selectedWallSegmentId === partition.id;
        const isHovered = hoveredWallId === partition.id;

        return (
          <group key={`partition-surface-${partition.id}`} position={partition.position} rotation={[0, partition.rotationY, 0]}>
            <mesh
              onPointerDown={(e) => handlePartitionPointerDown(partition, e)}
              onPointerMove={(e) => {
                if (mode !== "edit" || !pendingPlacement || !isWallMountedPending || partition.isLocked) return;
                e.stopPropagation();
                const next = resolvePartitionPreviewPlacement(partition, e.point);
                setPendingPlacement({
                  ...pendingPlacement,
                  position: next.position,
                  rotation: next.rotation,
                  surfaceKind: "partition",
                  surfaceId: partition.id,
                  batchPositions: next.batchPositions,
                  batchRotation: next.rotation,
                });
              }}
              onPointerOver={(e) => {
                if (mode !== "edit") return;
                e.stopPropagation();
                setHoveredWallId(partition.id);
              }}
              onPointerOut={(e) => {
                if (mode !== "edit") return;
                e.stopPropagation();
                setHoveredWallId((current) => (current === partition.id ? null : current));
              }}
            >
              <boxGeometry args={[partition.length, roomSize.height, partition.depth + 0.08]} />
              <meshBasicMaterial transparent opacity={isSelectedWall ? 0.1 : isHovered ? 0.06 : 0.01} color={isSelectedWall ? "#818cf8" : "#cbd5e1"} depthWrite={false} />
            </mesh>
          </group>
        );
      })}

      {wallSegments.map((wall) => {
        const isSelectedFace = selectedWallFace === wall.face;
        const isSelectedWall = selectedWallSegmentId === wall.id;
        const isHovered = hoveredWallId === wall.id;
        const wallMaterial = resolveWallMaterial(wall.id);
        const wallTexture = textureMap[wallMaterial.wallTextureUrl];
        const hasCustomWallTexture = /^data:|^blob:/.test(wallMaterial.wallTextureUrl);
        const useWallTexture = Boolean(wallTexture) && (wallMaterial.wallMaterialPreset !== "paint" || hasCustomWallTexture);
        const appliedWallColor = hasCustomWallTexture ? "#ffffff" : wallMaterial.wallColor;
        const wallMaterialProps = {
          roughness: wallMaterial.wallRoughness,
          metalness: wallMaterial.wallMetalness,
          bumpScale: wallMaterial.wallBumpScale,
          envMapIntensity: wallMaterial.wallEnvIntensity,
          transparent:
            wallMaterial.wallMaterialPreset === "glass" ||
            wallMaterial.wallOpacity < 0.999 ||
            wallMaterial.wallTransmission > 0,
          opacity: wallMaterial.wallOpacity,
          transmission: wallMaterial.wallTransmission,
          ior: wallMaterial.wallIor,
        };

        return (
          <Collision
            key={wall.id}
            enabled={isView}
            type="fixed"
            position={wall.position}
            rotation={wall.rotation}
          >
              <mesh
                receiveShadow
                userData={{ blockPlayer: true, wallId: wall.id }}
                onPointerDown={(e) => handleWallPointerDown(wall, e)}
              onPointerMove={(e) => {
                if (mode !== "edit" || !pendingPlacement || !isWallMountedPending) return;
                e.stopPropagation();
                const next = resolveWallPreviewPlacement(wall, e.point);
                if (process.env.NODE_ENV === "development") {
                  console.debug("[Room] wall pointer move", {
                    wallId: wall.id,
                    wallFace: wall.face,
                    point: { x: e.point.x, y: e.point.y, z: e.point.z },
                    nextPosition: next.position,
                    nextBatchCount: next.batchPositions?.length ?? 0,
                  });
                }
                setPendingPlacement({
                  ...pendingPlacement,
                  position: next.position,
                  rotation: next.rotation,
                  batchPositions: next.batchPositions,
                  batchRotation: next.rotation,
                });
              }}
                onPointerOver={(e) => {
                  if (mode !== "edit") return;
                  e.stopPropagation();
                  setHoveredWallId(wall.id);
                }}
                onPointerOut={(e) => {
                  if (mode !== "edit") return;
                  e.stopPropagation();
                  setHoveredWallId((current) => (current === wall.id ? null : current));
                }}
              >
                <boxGeometry args={wall.size} />
                <meshPhysicalMaterial
                map={useWallTexture ? wallTexture : undefined}
                bumpMap={useWallTexture ? wallTexture : undefined}
                  color={
                    isSelectedWall
                      ? "#c7d2fe"
                      : isHovered
                        ? "#eef2ff"
                        : isSelectedFace
                          ? "#f1f5f9"
                        : appliedWallColor
                }
                roughness={Math.max(0.42, wallMaterialProps.roughness)}
                metalness={Math.min(0.06, wallMaterialProps.metalness)}
                bumpScale={Math.max(0.02, wallMaterialProps.bumpScale)}
                envMapIntensity={Math.max(0.18, wallMaterialProps.envMapIntensity)}
                  transparent={wallMaterialProps.transparent}
                  opacity={wallMaterialProps.opacity}
                  transmission={wallMaterialProps.transmission}
                  ior={wallMaterialProps.ior}
                clearcoat={wallMaterial.wallMaterialPreset === "paint" ? 0.04 : 0}
                clearcoatRoughness={0.95}
                />
              </mesh>
          </Collision>
        );
      })}
    </group>
  );
}
