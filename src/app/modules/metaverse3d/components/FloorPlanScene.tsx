import { Grid, TransformControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useStore } from "../store/useStore";

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

  const autoDoors = useMemo(() => {
    const rooms = floorPlanElements.filter((el) => el.type === "room");
    const doors: Array<{ id: string; position: [number, number, number]; rotationY: number }> = [];

    const triggerGap = 0.8;
    const minOverlap = 1.2;

    const getBounds = (room: (typeof rooms)[number]) => {
      const [x, , z] = room.position;
      const [sx, , sz] = room.scale;
      const halfW = Math.abs(sx) / 2;
      const halfL = Math.abs(sz) / 2;
      return {
        minX: x - halfW,
        maxX: x + halfW,
        minZ: z - halfL,
        maxZ: z + halfL,
      };
    };

    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i];
        const b = rooms[j];
        const ba = getBounds(a);
        const bb = getBounds(b);

        const overlapZ = Math.min(ba.maxZ, bb.maxZ) - Math.max(ba.minZ, bb.minZ);
        const overlapX = Math.min(ba.maxX, bb.maxX) - Math.max(ba.minX, bb.minX);

        const gapAXtoB = bb.minX - ba.maxX;
        if (gapAXtoB >= 0 && gapAXtoB <= triggerGap && overlapZ >= minOverlap) {
          const z = (Math.max(ba.minZ, bb.minZ) + Math.min(ba.maxZ, bb.maxZ)) / 2;
          doors.push({ id: `${a.id}-${b.id}-x+`, position: [(ba.maxX + bb.minX) / 2, 0.06, z], rotationY: 0 });
          continue;
        }

        const gapBXtoA = ba.minX - bb.maxX;
        if (gapBXtoA >= 0 && gapBXtoA <= triggerGap && overlapZ >= minOverlap) {
          const z = (Math.max(ba.minZ, bb.minZ) + Math.min(ba.maxZ, bb.maxZ)) / 2;
          doors.push({ id: `${a.id}-${b.id}-x-`, position: [(bb.maxX + ba.minX) / 2, 0.06, z], rotationY: 0 });
          continue;
        }

        const gapAZtoB = bb.minZ - ba.maxZ;
        if (gapAZtoB >= 0 && gapAZtoB <= triggerGap && overlapX >= minOverlap) {
          const x = (Math.max(ba.minX, bb.minX) + Math.min(ba.maxX, bb.maxX)) / 2;
          doors.push({ id: `${a.id}-${b.id}-z+`, position: [x, 0.06, (ba.maxZ + bb.minZ) / 2], rotationY: Math.PI / 2 });
          continue;
        }

        const gapBZtoA = ba.minZ - bb.maxZ;
        if (gapBZtoA >= 0 && gapBZtoA <= triggerGap && overlapX >= minOverlap) {
          const x = (Math.max(ba.minX, bb.minX) + Math.min(ba.maxX, bb.maxX)) / 2;
          doors.push({ id: `${a.id}-${b.id}-z-`, position: [x, 0.06, (bb.maxZ + ba.minZ) / 2], rotationY: Math.PI / 2 });
        }
      }
    }

    return doors;
  }, [floorPlanElements]);

  return (
    <group>
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
              if (element.type === "room" && element.isLocked) setTransformMode("scale");
              setSelectedFloorPlanElementId(element.id);
            }}
          >
            <mesh receiveShadow castShadow>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color={element.color || (isRoom ? "#dbeafe" : "#9ca3af")} transparent={isRoom} opacity={isRoom ? (isEditableInCurrentMode ? 0.8 : 0.45) : (isEditableInCurrentMode ? 1 : 0.45)} />
            </mesh>

            {isSelected && isEditableInCurrentMode && (
              <mesh>
                <boxGeometry args={[1.03, 1.03, 1.03]} />
                <meshBasicMaterial color="#4f46e5" wireframe />
              </mesh>
            )}
          </group>
        );
      })}

      {autoDoors.map((door) => (
        <group key={door.id} position={door.position} rotation={[0, door.rotationY, 0]}>
          <mesh>
            <boxGeometry args={[1.6, 0.03, 0.14]} />
            <meshStandardMaterial color="#d97706" />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <torusGeometry args={[0.38, 0.07, 12, 20, Math.PI]} />
            <meshStandardMaterial color="#d97706" />
          </mesh>
        </group>
      ))}

      {selectedFloorPlanElementId && selectedObject && (
        <TransformControls
          object={selectedObject}
          mode={transformMode}
          translationSnap={0.5}
          rotationSnap={Math.PI / 12}
          onMouseDown={() => setFloorPlanIsTransforming(true)}
          onMouseUp={() => {
            setFloorPlanIsTransforming(false);
            const target = floorPlanElements.find((element) => element.id === selectedFloorPlanElementId);
            if (!target || !selectedObject) return;

            const pos = selectedObject.position.toArray() as [number, number, number];
            const rot = selectedObject.rotation.toArray() as [number, number, number];
            const scl = selectedObject.scale.toArray() as [number, number, number];

            if (target.type === "room") {
              pos[1] = 0.02;
              scl[1] = 0.04;

              if (target.isLocked) {
                updateFloorPlanElement(target.id, {
                  position: target.position,
                  rotation: target.rotation,
                  scale: [Math.max(4, Math.abs(scl[0])), 0.04, Math.max(4, Math.abs(scl[2]))],
                });
                return;
              }
            } else {
              pos[1] = 0.1;
              scl[1] = 0.2;
            }

            updateFloorPlanElement(target.id, {
              position: pos,
              rotation: [0, rot[1], 0],
              scale: [Math.max(0.2, Math.abs(scl[0])), scl[1], Math.max(0.2, Math.abs(scl[2]))],
            });
          }}
        />
      )}
    </group>
  );
}
