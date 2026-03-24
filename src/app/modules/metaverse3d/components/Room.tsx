import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { WallAnchor, WallFace, WallMaterialSettings } from "../types";
import { RigidBody } from "@react-three/rapier";
import { useTexture } from "@react-three/drei";
import { RepeatWrapping } from "three";
import { ReactNode } from "react";

type RoomBounds = {
  id: string;
  isLocked: boolean;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

type Side = "north" | "south" | "east" | "west";

type WallSegment = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number, number];
  face: WallFace;
  rotationY: number;
};

function Collision({ enabled, children, ...props }: { enabled: boolean; children: ReactNode; [key: string]: any }) {
  if (enabled) {
    return <RigidBody {...props}>{children}</RigidBody>;
  }
  return (
    <group position={props.position} rotation={props.rotation} scale={props.scale}>
      {children}
    </group>
  );
}

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
  const wallMaterialOverrides = useStore((state) => state.wallMaterialOverrides);
  const setSelectedWallFace = useStore((state) => state.setSelectedWallFace);
  const setSelectedWallAnchor = useStore((state) => state.setSelectedWallAnchor);
  const setSelectedWallSegmentId = useStore((state) => state.setSelectedWallSegmentId);
  const floorPlanElements = useStore((state) => state.floorPlanElements);
  const isView = mode === "view";
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);

  const roomBounds = useMemo<RoomBounds[]>(() => {
    const rooms = floorPlanElements.filter((el) => el.type === "room");
    if (rooms.length === 0) {
      return [
        {
          id: "fallback-room",
          isLocked: true,
          minX: -roomSize.width / 2,
          maxX: roomSize.width / 2,
          minZ: -roomSize.length / 2,
          maxZ: roomSize.length / 2,
        },
      ];
    }

    return rooms.map((room) => {
      const [x, , z] = room.position;
      const [sx, , sz] = room.scale;
      return {
        id: room.id,
        isLocked: Boolean(room.isLocked),
        minX: x - Math.abs(sx) / 2,
        maxX: x + Math.abs(sx) / 2,
        minZ: z - Math.abs(sz) / 2,
        maxZ: z + Math.abs(sz) / 2,
      };
    });
  }, [floorPlanElements, roomSize.width, roomSize.length]);

  const center = useMemo(() => {
    const anchor = roomBounds.find((r) => r.isLocked) || roomBounds[0];
    if (!anchor) return { x: 0, z: 0 };
    return {
      x: (anchor.minX + anchor.maxX) / 2,
      z: (anchor.minZ + anchor.maxZ) / 2,
    };
  }, [roomBounds]);

  const wallSegments = useMemo<WallSegment[]>(() => {
    const triggerGap = 0.8;
    const minOverlap = 1.2;
    const doorMaxWidth = 1.8;
    const wallThickness = Math.max(0.12, roomSize.wallThickness);

    const cuts = new Map<string, Array<[number, number]>>();
    const hiddenSides = new Set<string>();

    const cutKey = (roomId: string, side: Side) => `${roomId}:${side}`;
    const pushCut = (key: string, s: number, e: number) => {
      if (!cuts.has(key)) cuts.set(key, []);
      cuts.get(key)!.push([s, e]);
    };

    for (let i = 0; i < roomBounds.length; i++) {
      for (let j = i + 1; j < roomBounds.length; j++) {
        const a = roomBounds[i];
        const b = roomBounds[j];

        const overlapZStart = Math.max(a.minZ, b.minZ);
        const overlapZEnd = Math.min(a.maxZ, b.maxZ);
        const overlapZ = overlapZEnd - overlapZStart;

        const overlapXStart = Math.max(a.minX, b.minX);
        const overlapXEnd = Math.min(a.maxX, b.maxX);
        const overlapX = overlapXEnd - overlapXStart;

        const gapAXtoB = b.minX - a.maxX;
        if (gapAXtoB >= 0 && gapAXtoB <= triggerGap && overlapZ >= minOverlap) {
          hiddenSides.add(cutKey(b.id, "west"));
          const centerLine = (overlapZStart + overlapZEnd) / 2;
          const width = Math.min(doorMaxWidth, overlapZ - 0.2);
          if (width > 0.6) {
            pushCut(cutKey(a.id, "east"), centerLine - width / 2, centerLine + width / 2);
          }
          continue;
        }

        const gapBXtoA = a.minX - b.maxX;
        if (gapBXtoA >= 0 && gapBXtoA <= triggerGap && overlapZ >= minOverlap) {
          hiddenSides.add(cutKey(a.id, "west"));
          const centerLine = (overlapZStart + overlapZEnd) / 2;
          const width = Math.min(doorMaxWidth, overlapZ - 0.2);
          if (width > 0.6) {
            pushCut(cutKey(b.id, "east"), centerLine - width / 2, centerLine + width / 2);
          }
          continue;
        }

        const gapAZtoB = b.minZ - a.maxZ;
        if (gapAZtoB >= 0 && gapAZtoB <= triggerGap && overlapX >= minOverlap) {
          hiddenSides.add(cutKey(b.id, "north"));
          const centerLine = (overlapXStart + overlapXEnd) / 2;
          const width = Math.min(doorMaxWidth, overlapX - 0.2);
          if (width > 0.6) {
            pushCut(cutKey(a.id, "south"), centerLine - width / 2, centerLine + width / 2);
          }
          continue;
        }

        const gapBZtoA = a.minZ - b.maxZ;
        if (gapBZtoA >= 0 && gapBZtoA <= triggerGap && overlapX >= minOverlap) {
          hiddenSides.add(cutKey(a.id, "north"));
          const centerLine = (overlapXStart + overlapXEnd) / 2;
          const width = Math.min(doorMaxWidth, overlapX - 0.2);
          if (width > 0.6) {
            pushCut(cutKey(b.id, "south"), centerLine - width / 2, centerLine + width / 2);
          }
        }
      }
    }

    const segments: WallSegment[] = [];

    for (const room of roomBounds) {
      const northKey = cutKey(room.id, "north");
      const southKey = cutKey(room.id, "south");
      const eastKey = cutKey(room.id, "east");
      const westKey = cutKey(room.id, "west");

      if (!hiddenSides.has(northKey)) {
        for (const [s, e] of createSegments(room.minX, room.maxX, cuts.get(northKey) || [])) {
          segments.push({
            id: `${northKey}:${s.toFixed(2)}-${e.toFixed(2)}`,
            face: "north",
            position: [(s + e) / 2 - center.x, roomSize.height / 2, room.minZ - center.z],
            rotation: [0, 0, 0],
            rotationY: 0,
            size: [Math.max(0.1, e - s), roomSize.height, wallThickness],
          });
        }
      }

      if (!hiddenSides.has(southKey)) {
        for (const [s, e] of createSegments(room.minX, room.maxX, cuts.get(southKey) || [])) {
          segments.push({
            id: `${southKey}:${s.toFixed(2)}-${e.toFixed(2)}`,
            face: "south",
            position: [(s + e) / 2 - center.x, roomSize.height / 2, room.maxZ - center.z],
            rotation: [0, 0, 0],
            rotationY: Math.PI,
            size: [Math.max(0.1, e - s), roomSize.height, wallThickness],
          });
        }
      }

      if (!hiddenSides.has(eastKey)) {
        for (const [s, e] of createSegments(room.minZ, room.maxZ, cuts.get(eastKey) || [])) {
          segments.push({
            id: `${eastKey}:${s.toFixed(2)}-${e.toFixed(2)}`,
            face: "east",
            position: [room.maxX - center.x, roomSize.height / 2, (s + e) / 2 - center.z],
            rotation: [0, Math.PI / 2, 0],
            rotationY: -Math.PI / 2,
            size: [Math.max(0.1, e - s), roomSize.height, wallThickness],
          });
        }
      }

      if (!hiddenSides.has(westKey)) {
        for (const [s, e] of createSegments(room.minZ, room.maxZ, cuts.get(westKey) || [])) {
          segments.push({
            id: `${westKey}:${s.toFixed(2)}-${e.toFixed(2)}`,
            face: "west",
            position: [room.minX - center.x, roomSize.height / 2, (s + e) / 2 - center.z],
            rotation: [0, Math.PI / 2, 0],
            rotationY: Math.PI / 2,
            size: [Math.max(0.1, e - s), roomSize.height, wallThickness],
          });
        }
      }
    }

    return segments;
  }, [roomBounds, roomSize.height, roomSize.wallThickness, center.x, center.z]);

  const handleWallPointerDown = (wall: WallSegment, e: any) => {
    if (mode !== "edit") return;
    e.stopPropagation();
    setSelectedWallSegmentId(wall.id);
    const anchor: WallAnchor = {
      face: wall.face,
      position: wall.position,
      rotationY: wall.rotationY,
    };
    setSelectedWallAnchor(anchor);
    setSelectedWallFace(wall.face);
  };

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

  return (
    <group>
      {roomBounds.map((room, idx) => {
        const width = room.maxX - room.minX;
        const length = room.maxZ - room.minZ;
        const cx = (room.minX + room.maxX) / 2 - center.x;
        const cz = (room.minZ + room.maxZ) / 2 - center.z;

        const floorTexture = textureMap[resolvedFloorTextureUrl];

        return (
          <group key={`room-surface-${room.id}-${idx}`}>
            <Collision enabled={isView} type="fixed" position={[cx, -0.05, cz]}>
              <mesh receiveShadow>
                <boxGeometry args={[width, 0.1, length]} />
                <meshPhysicalMaterial
                  map={floorTexture}
                  color={roomSize.floorColor}
                  roughness={roomSize.floorRoughness}
                  metalness={roomSize.floorMetalness}
                  envMapIntensity={Math.max(0.1, roomSize.environmentBrightness * 0.6)}
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

      {wallSegments.map((wall) => {
        const isSelectedFace = selectedWallFace === wall.face;
        const isSelectedWall = selectedWallSegmentId === wall.id;
        const isHovered = hoveredWallId === wall.id;
        const wallMaterial = resolveWallMaterial(wall.id);
        const wallTexture = textureMap[wallMaterial.wallTextureUrl];
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
            <group>
              <mesh
                receiveShadow
                userData={{ blockPlayer: true, wallId: wall.id }}
                onPointerDown={(e) => handleWallPointerDown(wall, e)}
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
                  map={wallTexture}
                  bumpMap={wallTexture}
                  color={
                    isSelectedWall
                      ? "#c7d2fe"
                      : isHovered
                        ? "#eef2ff"
                        : isSelectedFace
                          ? "#f1f5f9"
                          : wallMaterial.wallColor
                  }
                  roughness={wallMaterialProps.roughness}
                  metalness={wallMaterialProps.metalness}
                  bumpScale={wallMaterialProps.bumpScale}
                  envMapIntensity={wallMaterialProps.envMapIntensity}
                  transparent={wallMaterialProps.transparent}
                  opacity={wallMaterialProps.opacity}
                  transmission={wallMaterialProps.transmission}
                  ior={wallMaterialProps.ior}
                />
              </mesh>
            </group>
          </Collision>
        );
      })}
    </group>
  );
}
