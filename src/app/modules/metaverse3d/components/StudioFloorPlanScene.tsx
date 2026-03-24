import { Grid, TransformControls } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useMetaverseStudioStore } from "../store/useMetaverseStudioStore";

export function StudioFloorPlanScene() {
  const floorPlanElements = useMetaverseStudioStore((s) => s.floorPlanElements);
  const selectedFloorPlanElementId = useMetaverseStudioStore((s) => s.selectedFloorPlanElementId);
  const setSelectedFloorPlanElementId = useMetaverseStudioStore((s) => s.setSelectedFloorPlanElementId);
  const updateFloorPlanElement = useMetaverseStudioStore((s) => s.updateFloorPlanElement);
  const floorPlanEditTarget = useMetaverseStudioStore((s) => s.floorPlanEditTarget);

  const refs = useRef<Record<string, THREE.Group | null>>({});
  const { camera, gl } = useThree();
  const selectedObj = selectedFloorPlanElementId ? refs.current[selectedFloorPlanElementId] : null;
  const selectedEl = useMemo(
    () => floorPlanElements.find((el) => el.id === selectedFloorPlanElementId) ?? null,
    [floorPlanElements, selectedFloorPlanElementId],
  );

  const [edgeDrag, setEdgeDrag] = useState<{
    edge: "left" | "right" | "up" | "down";
    startPoint: THREE.Vector3;
    startPosition: [number, number, number];
    startScale: [number, number, number];
  } | null>(null);

  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const dragRaycaster = useMemo(() => new THREE.Raycaster(), []);

  const getGroundPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      dragRaycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      const ok = dragRaycaster.ray.intersectPlane(dragPlane, hit);
      return ok ? hit : null;
    },
    [camera, dragPlane, dragRaycaster, gl.domElement],
  );

  useEffect(() => {
    if (!edgeDrag || !selectedEl) return;

    const minSize = selectedEl.type === "room" ? 4 : 0.2;

    const onPointerMove = (event: PointerEvent) => {
      const currentPoint = getGroundPoint(event.clientX, event.clientY);
      if (!currentPoint) return;

      const deltaX = currentPoint.x - edgeDrag.startPoint.x;
      const deltaZ = currentPoint.z - edgeDrag.startPoint.z;

      let nextPos = [...edgeDrag.startPosition] as [number, number, number];
      let nextScale = [...edgeDrag.startScale] as [number, number, number];

      if (edgeDrag.edge === "left") {
        const width = Math.max(minSize, edgeDrag.startScale[0] - deltaX);
        const applied = width - edgeDrag.startScale[0];
        nextScale[0] = width;
        nextPos[0] = edgeDrag.startPosition[0] + applied / 2;
      } else if (edgeDrag.edge === "right") {
        const width = Math.max(minSize, edgeDrag.startScale[0] + deltaX);
        const applied = width - edgeDrag.startScale[0];
        nextScale[0] = width;
        nextPos[0] = edgeDrag.startPosition[0] + applied / 2;
      } else if (edgeDrag.edge === "up") {
        const depth = Math.max(minSize, edgeDrag.startScale[2] - deltaZ);
        const applied = depth - edgeDrag.startScale[2];
        nextScale[2] = depth;
        nextPos[2] = edgeDrag.startPosition[2] + applied / 2;
      } else if (edgeDrag.edge === "down") {
        const depth = Math.max(minSize, edgeDrag.startScale[2] + deltaZ);
        const applied = depth - edgeDrag.startScale[2];
        nextScale[2] = depth;
        nextPos[2] = edgeDrag.startPosition[2] + applied / 2;
      }

      updateFloorPlanElement(selectedEl.id, {
        position: [nextPos[0], selectedEl.type === "room" ? 0.02 : 0.1, nextPos[2]],
        scale: [Math.abs(nextScale[0]), selectedEl.type === "room" ? 0.04 : 0.2, Math.abs(nextScale[2])],
      });
    };

    const onPointerUp = () => setEdgeDrag(null);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [edgeDrag, getGroundPoint, selectedEl, updateFloorPlanElement]);

  return (
    <group>
      <Grid position={[0, 0, 0]} args={[120, 120]} cellSize={0.5} sectionSize={5} fadeDistance={80} />

      {floorPlanElements.map((el) => {
        const isSelected = selectedFloorPlanElementId === el.id;
        const editable = floorPlanEditTarget === "room" ? el.type === "room" : el.type === "wall";

        return (
          <group
            key={el.id}
            ref={(node) => {
              refs.current[el.id] = node;
            }}
            position={el.position}
            rotation={el.rotation}
            scale={el.scale}
            onPointerDown={(e) => {
              if (!editable) return;
              e.stopPropagation();
              setSelectedFloorPlanElementId(el.id);
            }}
          >
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial
                color={el.color || (el.type === "room" ? "#dbeafe" : "#94a3b8")}
                transparent={el.type === "room"}
                opacity={el.type === "room" ? 0.7 : 1}
              />
            </mesh>
            {isSelected && <mesh><boxGeometry args={[1.05, 1.05, 1.05]} /><meshBasicMaterial color="#4f46e5" wireframe /></mesh>}

            {isSelected && editable && (
              <group
                position={[0, 0.04, 0]}
                scale={[1 / Math.max(Math.abs(el.scale[0]), 0.001), 1, 1 / Math.max(Math.abs(el.scale[2]), 0.001)]}
              >
                <mesh>
                  <boxGeometry args={[0.95, 0.02, 0.02]} />
                  <meshBasicMaterial color="#ef4444" />
                </mesh>
                <mesh>
                  <boxGeometry args={[0.02, 0.02, 0.95]} />
                  <meshBasicMaterial color="#2563eb" />
                </mesh>

                <mesh
                  position={[-0.5, 0, 0]}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const p = getGroundPoint(e.clientX, e.clientY);
                    if (!p) return;
                    setEdgeDrag({
                      edge: "left",
                      startPoint: p,
                      startPosition: [...el.position] as [number, number, number],
                      startScale: [Math.abs(el.scale[0]), el.scale[1], Math.abs(el.scale[2])] as [number, number, number],
                    });
                  }}
                >
                  <boxGeometry args={[0.12, 0.12, 0.12]} />
                  <meshBasicMaterial color="#ef4444" />
                </mesh>
                <mesh
                  position={[0.5, 0, 0]}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const p = getGroundPoint(e.clientX, e.clientY);
                    if (!p) return;
                    setEdgeDrag({
                      edge: "right",
                      startPoint: p,
                      startPosition: [...el.position] as [number, number, number],
                      startScale: [Math.abs(el.scale[0]), el.scale[1], Math.abs(el.scale[2])] as [number, number, number],
                    });
                  }}
                >
                  <boxGeometry args={[0.12, 0.12, 0.12]} />
                  <meshBasicMaterial color="#ef4444" />
                </mesh>
                <mesh
                  position={[0, 0, -0.5]}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const p = getGroundPoint(e.clientX, e.clientY);
                    if (!p) return;
                    setEdgeDrag({
                      edge: "up",
                      startPoint: p,
                      startPosition: [...el.position] as [number, number, number],
                      startScale: [Math.abs(el.scale[0]), el.scale[1], Math.abs(el.scale[2])] as [number, number, number],
                    });
                  }}
                >
                  <boxGeometry args={[0.12, 0.12, 0.12]} />
                  <meshBasicMaterial color="#2563eb" />
                </mesh>
                <mesh
                  position={[0, 0, 0.5]}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const p = getGroundPoint(e.clientX, e.clientY);
                    if (!p) return;
                    setEdgeDrag({
                      edge: "down",
                      startPoint: p,
                      startPosition: [...el.position] as [number, number, number],
                      startScale: [Math.abs(el.scale[0]), el.scale[1], Math.abs(el.scale[2])] as [number, number, number],
                    });
                  }}
                >
                  <boxGeometry args={[0.12, 0.12, 0.12]} />
                  <meshBasicMaterial color="#2563eb" />
                </mesh>
              </group>
            )}
          </group>
        );
      })}

      {selectedFloorPlanElementId && selectedObj && (
        <TransformControls
          object={selectedObj}
          mode="translate"
          translationSnap={0.5}
          onMouseUp={() => {
            const target = floorPlanElements.find((el) => el.id === selectedFloorPlanElementId);
            if (!target || !selectedObj) return;
            const pos = selectedObj.position.toArray() as [number, number, number];
            const rot = selectedObj.rotation.toArray() as [number, number, number];
            const scl = selectedObj.scale.toArray() as [number, number, number];

            updateFloorPlanElement(target.id, {
              position: [pos[0], target.type === "room" ? 0.02 : 0.1, pos[2]],
              rotation: [0, rot[1], 0],
              scale: [Math.max(1, Math.abs(scl[0])), target.type === "room" ? 0.04 : 0.2, Math.max(1, Math.abs(scl[2]))],
            });
          }}
        />
      )}
    </group>
  );
}
