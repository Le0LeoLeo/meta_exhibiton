import { Text, TransformControls, useGLTF } from "@react-three/drei";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ExhibitItem } from "../types";
import { useMetaverseStudioStore } from "../store/useMetaverseStudioStore";
import flowerModelUrl from "../../../../../flower.glb?url";

function StudioExhibitItemImpl({ item }: { item: ExhibitItem }) {
  const mode = useMetaverseStudioStore((s) => s.mode);
  const roomSize = useMetaverseStudioStore((s) => s.roomSize);
  const selectedItemId = useMetaverseStudioStore((s) => s.selectedItemId);
  const setSelectedItemId = useMetaverseStudioStore((s) => s.setSelectedItemId);
  const updateItem = useMetaverseStudioStore((s) => s.updateItem);

  const groupRef = useRef<THREE.Group>(null);
  const [transformMode, setTransformMode] = useState<"translate" | "rotate" | "scale">("translate");

  const isSelected = mode === "edit" && selectedItemId === item.id;
  const hw = roomSize.width / 2;
  const hl = roomSize.length / 2;

  const onPointerDown = useCallback(
    (e: any) => {
      if (mode !== "edit") return;
      if (typeof e.button === "number" && e.button !== 0) return;
      e.stopPropagation();
      setSelectedItemId(item.id);
    },
    [mode, item.id, setSelectedItemId],
  );

  const applySnapToWalls = useCallback(
    (x: number, y: number, z: number, ry: number) => {
      const snapDist = item.type === "painting" ? 2.2 : 1.4;
      const wallOffset = 0.2;

      const dNorth = Math.abs(z + hl);
      const dSouth = Math.abs(z - hl);
      const dEast = Math.abs(x - hw);
      const dWest = Math.abs(x + hw);

      const min = Math.min(dNorth, dSouth, dEast, dWest);
      if (item.type === "partition" || min > snapDist) return { x, y, z, ry };

      if (min === dNorth) return { x, y, z: -hl + wallOffset, ry: 0 };
      if (min === dSouth) return { x, y, z: hl - wallOffset, ry: Math.PI };
      if (min === dEast) return { x: hw - wallOffset, y, z, ry: -Math.PI / 2 };
      return { x: -hw + wallOffset, y, z, ry: Math.PI / 2 };
    },
    [hl, hw, item.type],
  );

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

  const flowerScene = useGLTF(flowerModelUrl) as any;

  const content = useMemo(() => {
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

    if (item.type === "plant") {
      return (
        <group>
          <primitive object={flowerScene.scene.clone(true)} />
        </group>
      );
    }

    if (item.type === "text") {
      const normalizedContent = item.content || " ";
      const lines = normalizedContent.split("\n");
      const lineCount = Math.max(1, lines.length);
      const maxChars = Math.max(...lines.map((line) => Array.from(line).length), 1);
      const fontSize = item.textFontSize ?? 0.42;
      const boardWidth = Math.max(1.4, maxChars * fontSize * 0.78 + 0.5);
      const boardHeight = Math.max(0.5, lineCount * fontSize * 1.35 + 0.32);
      return (
        <group>
          {item.textBackboardEnabled && (
            <mesh data-testid="studio-text-backboard" data-color={item.textBackboardColor || "#ffffff"} position={[0, 0, -0.04]}>
              <planeGeometry args={[boardWidth, boardHeight]} />
              <meshStandardMaterial color={item.textBackboardColor || "#ffffff"} roughness={0.75} metalness={0.04} />
            </mesh>
          )}
        <Text maxWidth={Math.max(1.2, boardWidth * 0.9)} textAlign="center" fontSize={fontSize} color={item.textColor || "#111827"} anchorX="center" anchorY="middle" lineHeight={1} fontWeight={item.textIsBold ? 800 : 400}>
          {normalizedContent}
        </Text>
        </group>
      );
    }

    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={item.content || "#e5e7eb"} />
      </mesh>
    );
  }, [flowerScene.scene, item]);

  return (
    <>
      <group ref={groupRef} position={item.position} rotation={item.rotation} scale={item.scale} onPointerDown={onPointerDown}>
        {content}
      </group>

      {isSelected && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode={transformMode}
          translationSnap={0.5}
          rotationSnap={Math.PI / 12}
          onMouseUp={(e: any) => {
            if (typeof e.button === "number" && e.button !== 0) return;
            if (!groupRef.current) return;
            const [x, y, z] = groupRef.current.position.toArray();
            const [rx, ry, rz] = groupRef.current.rotation.toArray();
            const [sx, sy, sz] = groupRef.current.scale.toArray();
            const snapped = applySnapToWalls(x, y, z, ry);

            if (item.type === "painting") {
              const halfWidth = Math.max(0.05, (item.frameWidth ?? 2) / 2);
              const halfHeight = Math.max(0.05, (item.frameHeight ?? 1.4) / 2);
              const depthOffset = 0.06;
              const safeX = Math.min(hw - halfWidth - 0.12, Math.max(-hw + halfWidth + 0.12, snapped.x));
              const safeZ = Math.min(hl - halfHeight - 0.12, Math.max(-hl + halfHeight + 0.12, snapped.z));
              updateItem(item.id, {
                position: [safeX, Math.max(0.2, snapped.y), safeZ],
                rotation: [rx, snapped.ry, rz],
                scale: [Math.max(0.2, sx), Math.max(0.2, sy), Math.max(0.2, sz)],
                modelOffset: [0, 0, depthOffset],
              });
              return;
            }

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

export const StudioExhibitItem = memo(StudioExhibitItemImpl);
