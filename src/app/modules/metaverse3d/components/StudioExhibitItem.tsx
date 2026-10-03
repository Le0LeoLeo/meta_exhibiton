import { Text, TransformControls, useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ExhibitItem } from "../types";
import {
  getExhibitModelQuality,
  optimizeExhibitModel,
  type ExhibitModelQuality,
} from "../../../features/metaverse-studio/exhibits/exhibitModelOptimization";
import {
  getPaintingFrameAppearance,
} from "../paintingFrameAppearance";
import { PaintingRailGeometry, PaintingRailMaterial } from "./PaintingRailSurface";
import { useMetaverseStudioStore } from "../store/useMetaverseStudioStore";
import { useI18n } from "../../../components/I18nProvider";
import flowerModelUrl from "../../../../../flower.glb?url";

function PaintingFrame({
  item,
  quality,
}: {
  item: ExhibitItem;
  quality: ExhibitModelQuality;
}) {
  const artworkWidth = item.frameWidth ?? 2;
  const artworkHeight = item.frameHeight ?? 1.4;
  const appearance = getPaintingFrameAppearance(item);
  const hasFrame = appearance.frameStyle !== "borderless";
  const revealWidth = appearance.frameStyle === "floating"
    ? Math.max(0.04, appearance.frameMatWidth)
    : appearance.frameMatEnabled
      ? appearance.frameMatWidth
      : 0;
  const frameThickness = hasFrame ? appearance.frameThickness : 0;
  const innerWidth = artworkWidth + revealWidth * 2;
  const innerHeight = artworkHeight + revealWidth * 2;
  const outerWidth = innerWidth + frameThickness * 2;
  const outerHeight = innerHeight + frameThickness * 2;
  const frameDepth = appearance.frameDepth;
  const accentSize = Math.min(Math.max(frameThickness * 0.16, 0.012), 0.028);
  const showAccent = hasFrame &&
    (appearance.frameStyle === "classic" || appearance.frameStyle === "metal");

  const railMaterial = (
    <PaintingRailMaterial
      style={appearance.frameStyle}
      color={appearance.frameColor}
    />
  );
  const accentMaterial = (
    <meshStandardMaterial
      color={appearance.frameInnerColor}
      roughness={0.24}
      metalness={0.68}
    />
  );

  return (
    <group name="painting-frame" userData={{ frameStyle: appearance.frameStyle }}>
      <mesh
        name="painting-frame-backboard"
        position={[0, 0, -frameDepth * 0.58]}
        castShadow={quality.castShadows}
        receiveShadow={quality.castShadows}
      >
        <boxGeometry
          args={[
            Math.max(artworkWidth, innerWidth),
            Math.max(artworkHeight, innerHeight),
            Math.max(0.025, frameDepth * 0.38),
          ]}
        />
        <meshStandardMaterial
          color={appearance.frameStyle === "floating" ? appearance.frameInnerColor : "#202226"}
          roughness={0.78}
          metalness={0.04}
        />
      </mesh>

      {appearance.frameMatEnabled && appearance.frameStyle !== "floating" && (
        <mesh
          name="painting-frame-mat"
          position={[0, 0, -0.012]}
          receiveShadow={quality.castShadows}
        >
          <planeGeometry args={[innerWidth, innerHeight]} />
          <meshStandardMaterial color={appearance.frameMatColor} roughness={0.92} metalness={0} />
        </mesh>
      )}

      {hasFrame && (
        <group name="painting-frame-rails">
          <mesh
            name="painting-frame-rail"
            position={[0, outerHeight / 2 - frameThickness / 2, -frameDepth / 2]}
            castShadow={quality.castShadows}
            receiveShadow={quality.castShadows}
          >
            <PaintingRailGeometry args={[outerWidth, frameThickness, frameDepth]} />
            {railMaterial}
          </mesh>
          <mesh
            name="painting-frame-rail"
            position={[0, -outerHeight / 2 + frameThickness / 2, -frameDepth / 2]}
            castShadow={quality.castShadows}
            receiveShadow={quality.castShadows}
          >
            <PaintingRailGeometry args={[outerWidth, frameThickness, frameDepth]} />
            {railMaterial}
          </mesh>
          <mesh
            name="painting-frame-rail"
            position={[-outerWidth / 2 + frameThickness / 2, 0, -frameDepth / 2]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow={quality.castShadows}
            receiveShadow={quality.castShadows}
          >
            <PaintingRailGeometry args={[Math.max(0.01, innerHeight), frameThickness, frameDepth]} />
            {railMaterial}
          </mesh>
          <mesh
            name="painting-frame-rail"
            position={[outerWidth / 2 - frameThickness / 2, 0, -frameDepth / 2]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow={quality.castShadows}
            receiveShadow={quality.castShadows}
          >
            <PaintingRailGeometry args={[Math.max(0.01, innerHeight), frameThickness, frameDepth]} />
            {railMaterial}
          </mesh>
        </group>
      )}

      {showAccent && (
        <group name="painting-frame-accent">
          <mesh position={[0, innerHeight / 2 + accentSize / 2, 0.008]}>
            <boxGeometry args={[innerWidth + accentSize * 2, accentSize, accentSize]} />
            {accentMaterial}
          </mesh>
          <mesh position={[0, -innerHeight / 2 - accentSize / 2, 0.008]}>
            <boxGeometry args={[innerWidth + accentSize * 2, accentSize, accentSize]} />
            {accentMaterial}
          </mesh>
          <mesh position={[-innerWidth / 2 - accentSize / 2, 0, 0.008]}>
            <boxGeometry args={[accentSize, innerHeight, accentSize]} />
            {accentMaterial}
          </mesh>
          <mesh position={[innerWidth / 2 + accentSize / 2, 0, 0.008]}>
            <boxGeometry args={[accentSize, innerHeight, accentSize]} />
            {accentMaterial}
          </mesh>
        </group>
      )}

      <mesh
        userData={{ itemType: "painting", itemId: item.id }}
        position={[0, 0, 0.018]}
      >
        <planeGeometry args={[artworkWidth, artworkHeight]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {appearance.frameGlassEnabled && (
        <mesh name="painting-frame-glass" position={[0, 0, 0.032]} renderOrder={2}>
          <planeGeometry args={[artworkWidth, artworkHeight]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transparent
            opacity={0.055}
            roughness={0.06}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.04}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

function StudioExhibitItemImpl({ item }: { item: ExhibitItem }) {
  const { t } = useI18n();
  const mode = useMetaverseStudioStore((s) => s.mode);
  const roomSize = useMetaverseStudioStore((s) => s.roomSize);
  const selectedItemId = useMetaverseStudioStore((s) => s.selectedItemId);
  const setSelectedItemId = useMetaverseStudioStore((s) => s.setSelectedItemId);
  const updateItem = useMetaverseStudioStore((s) => s.updateItem);
  const effectivePerformanceMode = useMetaverseStudioStore(
    (s) => s.effectivePerformanceMode,
  );
  const quality = useMemo(
    () => getExhibitModelQuality(effectivePerformanceMode),
    [effectivePerformanceMode],
  );

  const groupRef = useRef<THREE.Group>(null);
  const [transformMode, setTransformMode] = useState<"translate" | "rotate" | "scale">("translate");

  const isSelected = mode === "edit" && selectedItemId === item.id;
  const hw = roomSize.width / 2;
  const hl = roomSize.length / 2;

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
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

  const flowerScene = useGLTF(flowerModelUrl);
  const optimizedFlower = useMemo(() => {
    if (item.type !== "plant") return null;
    const root = cloneSkeleton(flowerScene.scene);
    optimizeExhibitModel(root, quality, quality.textureAnisotropy);
    return root;
  }, [flowerScene.scene, item.type, quality]);

  const content = useMemo(() => {
    if (item.type === "painting") {
      const appearance = getPaintingFrameAppearance(item);
      const revealWidth = appearance.frameStyle === "floating"
        ? Math.max(0.04, appearance.frameMatWidth)
        : appearance.frameMatEnabled
          ? appearance.frameMatWidth
          : 0;
      const frameThickness = appearance.frameStyle === "borderless"
        ? 0
        : appearance.frameThickness;
      const labelY = -(
        (item.frameHeight ?? 1.4) / 2 +
        revealWidth +
        frameThickness +
        0.16
      );
      return (
        <group>
          <PaintingFrame item={item} quality={quality} />
          <Text position={[0, labelY, 0.02]} fontSize={0.1} color="#111827">
            {item.title || t("artworkEditUntitled")}
          </Text>
        </group>
      );
    }

    if (item.type === "pedestal") {
      return (
        <group>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.45, 0.5, 1, quality.radialSegments]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.1, quality.radialSegments]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
        </group>
      );
    }

    if (item.type === "plant") {
      return (
        <group>
          {optimizedFlower && <primitive object={optimizedFlower} />}
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
            <mesh name="studio-text-backboard" position={[0, 0, -0.04]}>
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
  }, [item, optimizedFlower, quality, t]);

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
          onMouseUp={(e) => {
            if (e && "button" in e && typeof e.button === "number" && e.button !== 0) return;
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
