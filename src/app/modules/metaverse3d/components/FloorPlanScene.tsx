import { Grid, TransformControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useStore } from "../store/useStore";
import { buildWallTopology, getFloorPlanRoomBounds } from "../store/floorPlanGeometry";

const ROOM_SNAP_THRESHOLD = 0.8;
const GRID_SNAP_STEP = 0.5;
function snapToGrid(value: number, step = GRID_SNAP_STEP) {
  return Math.round(value / step) * step;
}

function snapRoomToNearbyRooms(
  target: { id: string; position: [number, number, number]; scale: [number, number, number] },
  rooms: Array<{ id: string; position: [number, number, number]; scale: [number, number, number]; doorOffset?: number }>,
) {
  const nextPosition: [number, number, number] = [...target.position];
  const halfW = Math.abs(target.scale[0]) / 2;
  const halfL = Math.abs(target.scale[2]) / 2;
  const bounds = {
    minX: nextPosition[0] - halfW,
    maxX: nextPosition[0] + halfW,
    minZ: nextPosition[2] - halfL,
    maxZ: nextPosition[2] + halfL,
    centerX: nextPosition[0],
    centerZ: nextPosition[2],
  };

  let bestSnapX: { distance: number; delta: number } | null = null;
  let bestSnapZ: { distance: number; delta: number } | null = null;

  for (const room of rooms) {
    if (room.id === target.id) continue;
    const otherHalfW = Math.abs(room.scale[0]) / 2;
    const otherHalfL = Math.abs(room.scale[2]) / 2;
    const other = {
      minX: room.position[0] - otherHalfW,
      maxX: room.position[0] + otherHalfW,
      minZ: room.position[2] - otherHalfL,
      maxZ: room.position[2] + otherHalfL,
      centerX: room.position[0],
      centerZ: room.position[2],
    };

    const xCandidates = [
      other.minX - bounds.minX,
      other.minX - bounds.maxX,
      other.maxX - bounds.minX,
      other.maxX - bounds.maxX,
      other.centerX - bounds.centerX,
    ];

    const zCandidates = [
      other.minZ - bounds.minZ,
      other.minZ - bounds.maxZ,
      other.maxZ - bounds.minZ,
      other.maxZ - bounds.maxZ,
      other.centerZ - bounds.centerZ,
    ];

    for (const delta of xCandidates) {
      const distance = Math.abs(delta);
      if (distance > ROOM_SNAP_THRESHOLD) continue;
      if (!bestSnapX || distance < bestSnapX.distance) {
        bestSnapX = { distance, delta };
      }
    }

    for (const delta of zCandidates) {
      const distance = Math.abs(delta);
      if (distance > ROOM_SNAP_THRESHOLD) continue;
      if (!bestSnapZ || distance < bestSnapZ.distance) {
        bestSnapZ = { distance, delta };
      }
    }
  }

  if (bestSnapX) nextPosition[0] += bestSnapX.delta;
  if (bestSnapZ) nextPosition[2] += bestSnapZ.delta;

  return nextPosition;
}

export function FloorPlanScene() {
  const floorPlanElements = useStore((state) => state.floorPlanElements);
  const selectedFloorPlanElementId = useStore(
    (state) => state.selectedFloorPlanElementId,
  );
  const setSelectedFloorPlanElementId = useStore(
    (state) => state.setSelectedFloorPlanElementId,
  );
  const updateFloorPlanElement = useStore((state) => state.updateFloorPlanElement);
  const floorPlanEditTarget = useStore((state) => state.floorPlanEditTarget);
  const setFloorPlanIsTransforming = useStore(
    (state) => state.setFloorPlanIsTransforming,
  );
  const floorPlanIsTransforming = useStore(
    (state) => state.floorPlanIsTransforming,
  );

  const elementRefs = useRef<Record<string, THREE.Group | null>>({});
  const transformStartRef = useRef<{
    id: string;
    position: [number, number, number];
    scale: [number, number, number];
    mode: "translate" | "rotate" | "scale";
  } | null>(null);
  const [transformMode, setTransformMode] = useState<
    "translate" | "rotate" | "scale"
  >("translate");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selectedFloorPlanElementId) return;

      const selected = floorPlanElements.find(
        (el) => el.id === selectedFloorPlanElementId,
      );
      const isLockedRoom = selected?.type === "room" && Boolean(selected?.isLocked);

      if (e.key.toLowerCase() === "s") {
        setTransformMode("scale");
        return;
      }

      if (isLockedRoom) {
        return;
      }

      if (e.key.toLowerCase() === "t") setTransformMode("translate");
      if (e.key.toLowerCase() === "r") setTransformMode("rotate");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedFloorPlanElementId, floorPlanElements]);

  useEffect(() => {
    return () => setFloorPlanIsTransforming(false);
  }, [setFloorPlanIsTransforming]);

  const selectedObject = selectedFloorPlanElementId
    ? elementRefs.current[selectedFloorPlanElementId] || null
    : null;

  const roomBounds = useMemo(() => getFloorPlanRoomBounds(floorPlanElements, 120, 120), [floorPlanElements]);
  const center = useMemo(() => {
    const anchor = roomBounds.find((r) => r.isLocked) || roomBounds[0];
    if (!anchor) return { x: 0, z: 0 };
    return {
      x: (anchor.minX + anchor.maxX) / 2,
      z: (anchor.minZ + anchor.maxZ) / 2,
    };
  }, [roomBounds]);

  const autoDoors = useMemo(() => {
    // This group already applies the floor-plan center translation.
    const topology = buildWallTopology(roomBounds, 6, 0.1, { x: 0, z: 0 });
    return topology.doorOpenings;
  }, [roomBounds]);

  return (
    <group position={[-center.x, 0, -center.z]}>
      <Grid position={[0, 0, 0]} args={[120, 120]} cellSize={0.5} cellThickness={0.8} cellColor="#9ca3af" sectionSize={5} sectionThickness={1.2} sectionColor="#6b7280" fadeDistance={100} fadeStrength={1} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} visible={false} onPointerDown={() => {
        if (floorPlanIsTransforming) return;
        setSelectedFloorPlanElementId(null);
      }}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {floorPlanElements.map((element) => {
        const isSelected = selectedFloorPlanElementId === element.id;
        const isRoom = element.type === "room";
        const isEditableInCurrentMode = floorPlanEditTarget === "room" ? isRoom : !isRoom;

        return (
          <group
            key={element.id}
            ref={(node) => {
              elementRefs.current[element.id] = node;
            }}
            position={element.position}
            rotation={element.rotation}
            scale={element.scale}
            onPointerDown={(e) => {
              if (!isEditableInCurrentMode) return;
              e.stopPropagation();
              if (e.button === 2) return;
              if (element.type === "room" && element.isLocked) setTransformMode("scale");
              setSelectedFloorPlanElementId(element.id);
            }}
            onContextMenu={(e) => {
              e.stopPropagation();
              e.nativeEvent.preventDefault();
            }}
          >
            <mesh receiveShadow castShadow>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color={element.color || (isRoom ? "#dbeafe" : "#9ca3af")} transparent={isRoom} opacity={isRoom ? (isEditableInCurrentMode ? 0.7 : 0.35) : (isEditableInCurrentMode ? 1 : 0.45)} />
            </mesh>

            {(isRoom || !isRoom) && (
              <lineSegments scale={[1.02, 1.02, 1.02]}>
                <edgesGeometry args={[new THREE.BoxGeometry(1, 1, 1)]} />
                <lineBasicMaterial color="#ffffff" transparent opacity={isRoom ? 0.98 : 0.88} linewidth={2} />
              </lineSegments>
            )}

            {isSelected && isEditableInCurrentMode && (
              <mesh scale={[1.03, 1.03, 1.03]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#4f46e5" wireframe />
              </mesh>
            )}
          </group>
        );
      })}

      {autoDoors.map((door) => (
        <group key={door.id} position={door.position} rotation={[0, door.rotationY, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[door.width, 0.03, 0.14]} />
            <meshStandardMaterial color="#d97706" />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <torusGeometry args={[Math.max(0.18, door.width * 0.23), 0.07, 12, 20, Math.PI]} />
            <meshStandardMaterial color="#d97706" />
          </mesh>
        </group>
      ))}

      {selectedFloorPlanElementId && selectedObject && (
        <TransformControls
          object={selectedObject}
          mode={transformMode}
          translationSnap={GRID_SNAP_STEP}
          rotationSnap={Math.PI / 12}
          scaleSnap={GRID_SNAP_STEP}
          onMouseDown={() => {
            setFloorPlanIsTransforming(true);
            const target = floorPlanElements.find((element) => element.id === selectedFloorPlanElementId);
            if (!target) return;
            transformStartRef.current = {
              id: target.id,
              position: [...target.position] as [number, number, number],
              scale: [...target.scale] as [number, number, number],
              mode: transformMode,
            };
          }}
          onMouseUp={() => {
            setFloorPlanIsTransforming(false);
            const target = floorPlanElements.find((element) => element.id === selectedFloorPlanElementId);
            if (!target || !selectedObject) return;

            const start = transformStartRef.current;
            transformStartRef.current = null;

            const pos = selectedObject.position.toArray() as [number, number, number];
            const rot = selectedObject.rotation.toArray() as [number, number, number];
            const scl = selectedObject.scale.toArray() as [number, number, number];

            if (target.type === "room") {
              pos[0] = snapToGrid(pos[0]);
              pos[2] = snapToGrid(pos[2]);
              pos[1] = 0.02;

              const snappedScaleX = Math.max(4, snapToGrid(Math.abs(scl[0])));
              const snappedScaleZ = Math.max(4, snapToGrid(Math.abs(scl[2])));
              const snappedScale: [number, number, number] = [snappedScaleX, 0.04, snappedScaleZ];

              if (target.isLocked) {
                updateFloorPlanElement(target.id, {
                  position: target.position,
                  rotation: target.rotation,
                  scale: [Math.max(4, Math.abs(target.scale[0])), 0.04, Math.max(4, Math.abs(target.scale[2]))],
                });
                return;
              }

              const snappedPosition =
                transformMode === "translate"
                  ? snapRoomToNearbyRooms(
                      {
                        id: target.id,
                        position: pos,
                        scale: snappedScale,
                      },
                      floorPlanElements
                        .filter((element) => element.type === "room")
                        .map((room) => ({ id: room.id, position: room.position, scale: room.scale })),
                    )
                  : pos;

              const nextScale = snappedScale;
              const nextPosition: [number, number, number] = [...snappedPosition];

              if (start?.mode === "scale") {
                if (Math.abs(nextScale[0] - start.scale[0]) > Math.abs(nextScale[2] - start.scale[2])) {
                  nextPosition[0] = start.position[0] + (nextScale[0] - start.scale[0]) / 2 * Math.sign(nextPosition[0] - start.position[0] || 1);
                } else {
                  nextPosition[2] = start.position[2] + (nextScale[2] - start.scale[2]) / 2 * Math.sign(nextPosition[2] - start.position[2] || 1);
                }
              }

              updateFloorPlanElement(target.id, {
                position: nextPosition,
                rotation: [0, rot[1], 0],
                scale: nextScale,
              });
              return;
            }

            pos[0] = snapToGrid(pos[0]);
            pos[2] = snapToGrid(pos[2]);
            pos[1] = 0.1;
            scl[1] = 0.2;

            updateFloorPlanElement(target.id, {
              position: pos,
              rotation: [0, rot[1], 0],
              scale: [Math.max(0.2, snapToGrid(Math.abs(scl[0]))), scl[1], Math.max(0.2, snapToGrid(Math.abs(scl[2])))],
            });
          }}
        />
      )}
    </group>
  );
}
