import { Text, TransformControls } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ExhibitItem } from "../types";
import { useMetaverseStudioStore } from "../store/useMetaverseStudioStore";

export function StudioExhibitItem({ item }: { item: ExhibitItem }) {
  const mode = useMetaverseStudioStore((s) => s.mode);
  const roomSize = useMetaverseStudioStore((s) => s.roomSize);
  const selectedItemId = useMetaverseStudioStore((s) => s.selectedItemId);
  const setSelectedItemId = useMetaverseStudioStore((s) => s.setSelectedItemId);
  const updateItem = useMetaverseStudioStore((s) => s.updateItem);

  const groupRef = useRef<THREE.Group>(null);
  const [transformMode, setTransformMode] = useState<"translate" | "rotate" | "scale">("translate");

  const isSelected = mode === "edit" && selectedItemId === item.id;

  useEffect(() => {
    if (!isSelected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "t") setTransformMode("translate");
      if (e.key.toLowerCase() === "r") setTransformMode("rotate");
      if (e.key.toLowerCase() === "s") setTransformMode("scale");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSelected]);

  const onPointerDown = (e: any) => {
    if (mode !== "edit") return;
    e.stopPropagation();
    setSelectedItemId(item.id);
  };

  const applySnapToWalls = (x: number, y: number, z: number, ry: number) => {
    const hw = roomSize.width / 2;
    const hl = roomSize.length / 2;
    const snapDist = 1.4;

    const dNorth = Math.abs(z + hl);
    const dSouth = Math.abs(z - hl);
    const dEast = Math.abs(x - hw);
    const dWest = Math.abs(x + hw);

    const min = Math.min(dNorth, dSouth, dEast, dWest);
    if (min > snapDist || item.type === "partition") return { x, y, z, ry };

    if (min === dNorth) return { x, y, z: -hl + 0.2, ry: 0 };
    if (min === dSouth) return { x, y, z: hl - 0.2, ry: Math.PI };
    if (min === dEast) return { x: hw - 0.2, y, z, ry: -Math.PI / 2 };
    return { x: -hw + 0.2, y, z, ry: Math.PI / 2 };
  };

  const renderContent = () => {
    if (item.type === "painting") {
      return (
        <group>
          <mesh position={[0, 0, -0.05]}>
            <boxGeometry args={[(item.frameWidth ?? 2) + 0.2, (item.frameHeight ?? 1.4) + 0.2, 0.1]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh userData={{ itemType: "painting", itemId: item.id }}>
            <planeGeometry args={[item.frameWidth ?? 2, item.frameHeight ?? 1.4]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <Text position={[0, -((item.frameHeight ?? 1.4) / 2 + 0.25), 0.02]} fontSize={0.1} color="#111827">
            {item.title || "未命名作品"}
          </Text>
        </group>
      );
    }

    if (item.type === "pedestal") {
      return (
        <group>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.45, 0.5, 1, 24]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.1, 24]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
        </group>
      );
    }

    if (item.type === "text") {
      return (
        <Text maxWidth={4} textAlign="center" fontSize={0.42} color="#111827">
          {item.content || "文字"}
        </Text>
      );
    }

    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={item.content || "#e5e7eb"} />
      </mesh>
    );
  };

  return (
    <>
      <group
        ref={groupRef}
        position={item.position}
        rotation={item.rotation}
        scale={item.scale}
        onPointerDown={onPointerDown}
      >
        {renderContent()}
      </group>

      {isSelected && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode={transformMode}
          translationSnap={0.5}
          rotationSnap={Math.PI / 12}
          onMouseUp={() => {
            if (!groupRef.current) return;
            const [x, y, z] = groupRef.current.position.toArray();
            const [rx, ry, rz] = groupRef.current.rotation.toArray();
            const [sx, sy, sz] = groupRef.current.scale.toArray();
            const snapped = applySnapToWalls(x, y, z, ry);

            updateItem(item.id, {
              position: [snapped.x, snapped.y, snapped.z],
              rotation: [rx, snapped.ry, rz],
              scale: [Math.max(0.2, sx), Math.max(0.2, sy), Math.max(0.2, sz)],
            });
          }}
        />
      )}
    </>
  );
}
