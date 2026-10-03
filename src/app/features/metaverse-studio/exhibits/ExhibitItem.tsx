import { useRef, useState, useEffect, useMemo, useContext } from "react";
import { useStore } from "../store";
import { useMultiplayerStore } from "../../../modules/metaverse3d/network/multiplayerStore";
import { useRuntimeInteractionStore } from "../../../modules/metaverse3d/interaction/runtimeInteractionStore";
import { ExhibitItem as ExhibitItemType } from "../types";
import { Text, useTexture, TransformControls, Edges, useGLTF } from "@react-three/drei";
import { useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { CanvasAssetBoundary } from "../../../modules/metaverse3d/components/CanvasAssetBoundary";
import { useI18n } from "@/app/components/I18nProvider";
import { GalleryAtmosphereContext } from "../../../modules/metaverse3d/components/GalleryAtmosphereContext";
import { BeveledBox } from "../../../modules/metaverse3d/components/geometry/BeveledBox";
import { getPaintingImageFit } from "@/app/modules/metaverse3d/paintingImageFit";
import { isWallMountedItem, snapExhibitToWall } from "@/app/modules/metaverse3d/items/wallPlacement";
import { getPaintingFrameAppearance } from "@/app/modules/metaverse3d/paintingFrameAppearance";
import { getTemplateDisplay } from "@/app/modules/metaverse3d/items/templateDisplay";
import { PaintingRailGeometry, PaintingRailMaterial } from "@/app/modules/metaverse3d/components/PaintingRailSurface";
import { createExhibitRegistry, type ExhibitRendererProps } from "./exhibitRegistry";
import type { SceneSnapshot } from "../../../modules/metaverse3d/store/metaverseStoreTypes";
import {
  fitObjectToExhibit,
  getExhibitModelQuality,
  optimizeExhibitModel,
  type ExhibitModelQuality,
} from "./exhibitModelOptimization";
import { LightstripExhibit, PartitionExhibit, TextExhibit } from "./components";
import {
  CabinetDecor,
  ChairDecor,
  FloorLampDecor,
  FountainDecor,
  SofaDecor,
  TurntableDecor,
} from "./AdditionalDecor";

const exhibitRegistry = createExhibitRegistry({
  painting: PaintingExhibit,
  pedestal: Pedestal,
  text: TextExhibit,
  partition: PartitionExhibit,
  lightstrip: LightstripExhibit,
  flower: FlowerDecor,
  chandelier: ChandelierDecor,
  bench: BenchDecor,
  rug: RugDecor,
  vase: VaseDecor,
  sculpture: SculptureDecor,
  spotlight: SpotlightDecor,
  plant: PlantDecor,
  column: ColumnDecor,
  neon: NeonDecor,
  chair: ChairDecor,
  sofa: SofaDecor,
  floorlamp: FloorLampDecor,
  cabinet: CabinetDecor,
  turntable: TurntableDecor,
  fountain: FountainDecor,
});

const FREE_VASE_MODEL_URL = "/models/exhibits/vase/poly-google-vase.glb";
const FREE_FLOWER_MODEL_URLS = [
  "/models/exhibits/flowers/kenney-flower-purple-b.glb",
  "/models/exhibits/flowers/kenney-flower-red-b.glb",
  "/models/exhibits/flowers/kenney-flower-yellow-b.glb",
] as const;

export function resolvePaintingImageUrl(item: ExhibitItemType, fallbackImageUrl: string) {
  const content = item.content?.trim() || "";
  const mime = item.fileMimeType || "";
  const isVideo = mime.startsWith("video/") || /^data:video\//.test(content);
  const isImage =
    mime.startsWith("image/") ||
    /^data:image\//.test(content) ||
    /^https?:\/\//.test(content) ||
    /^blob:/.test(content) ||
    content.startsWith("/");

  if (isVideo) return item.videoThumbnailUrl || fallbackImageUrl;
  if (isImage) return content;
  return fallbackImageUrl;
}

export function hasRemoteEditorFocus(
  focuses: Record<string, { itemId: string }>,
  itemId: string,
): boolean {
  return Object.values(focuses).some((focus) => focus.itemId === itemId);
}

export function ExhibitItem({ item, readOnly = false, sceneOverride }: { item: ExhibitItemType; readOnly?: boolean; sceneOverride?: SceneSnapshot | null }) {
  const mode = useStore((state) => state.mode);
  const roomSize = useStore((state) => state.roomSize);
  const selectedItemId = useStore((state) => state.selectedItemId);
  const selectedItemIds = useStore((state) => state.selectedItemIds);
  const setSelectedItemId = useStore((state) => state.setSelectedItemId);
  const toggleMultiSelectItem = useStore((state) => state.toggleMultiSelectItem);
  const updateItem = useStore((state) => state.updateItem);
  const moveSelectedItems = useStore((state) => state.moveSelectedItems);
  const canOpenViewingItem = useStore((state) => state.canOpenViewingItem);
  const openViewingItemById = useStore((state) => state.openViewingItemById);
  const remoteEditorFocuses = useMultiplayerStore((state) => state.remoteEditorFocuses);
  const effectivePerformanceMode = useStore((state) => state.effectivePerformanceMode);
  const quality = useMemo(
    () => getExhibitModelQuality(effectivePerformanceMode),
    [effectivePerformanceMode],
  );

  const isSelected = !readOnly && selectedItemIds.includes(item.id);
  const isPrimarySelected = !readOnly && selectedItemId === item.id;
  const isLockedPartition = item.type === "partition" && Boolean(item.isLocked);
  const isRemotelyFocused = mode === "edit"
    && hasRemoteEditorFocus(remoteEditorFocuses, item.id);
  const groupRef = useRef<THREE.Group>(null!);
  const { controls } = useThree();
  const orbitControlsRef = useRef<{ enabled: boolean } | null>(null);
  const [transformMode, setTransformMode] = useState<
    "translate" | "rotate" | "scale"
  >("translate");

  useEffect(() => {
    orbitControlsRef.current = (controls as { enabled: boolean } | null) ?? null;
  }, [controls]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPrimarySelected || mode !== "edit") return;
      if (e.key === "t") setTransformMode("translate");
      if (e.key === "r") setTransformMode("rotate");
      if (e.key === "s") setTransformMode("scale");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPrimarySelected, mode]);

  useEffect(() => {
    if (isPrimarySelected && isRemotelyFocused) setSelectedItemId(null);
  }, [isPrimarySelected, isRemotelyFocused, setSelectedItemId]);

  useEffect(() => {
    return () => {
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = true;
      }
    };
  }, []);

  const handlePointerDown = (e: ThreeEvent<MouseEvent>) => {
    if (readOnly) return;
    e.stopPropagation();
    if (mode === "edit") {
      if (isRemotelyFocused) return;
      if (isLockedPartition) {
        setSelectedItemId(item.id);
        return;
      }

      if (e.shiftKey) {
        toggleMultiSelectItem(item.id);
      } else {
        setSelectedItemId(item.id);
      }
      return;
    }

    if (mode === "view" && item.type === "painting") {
      if (!canOpenViewingItem()) return;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      openViewingItemById(item.id);
    }
  };

  const Renderer = exhibitRegistry[item.type];
  const renderMode = readOnly ? "view" : mode;
  const content = Renderer ? (
    <Renderer
      item={item}
      sceneOverride={sceneOverride}
      isSelected={isSelected && renderMode === "edit"}
      mode={renderMode}
      quality={quality}
      onInteract={!readOnly && renderMode === "view" ? handlePointerDown : undefined}
    />
  ) : null;

  const transformProps = {
    position: item.position,
    rotation: item.rotation,
    scale: item.scale,
  };

  const itemMesh = renderMode === "view" ? (
    <group {...transformProps} onPointerDown={readOnly ? undefined : handlePointerDown}>
      {content}
    </group>
  ) : (
    <group
      ref={groupRef}
      {...transformProps}
      onPointerDown={readOnly ? undefined : handlePointerDown}
    >
      {content}
    </group>
  );

  if (!readOnly && isPrimarySelected && mode === "edit" && !isLockedPartition && !isRemotelyFocused) {
    return (
      <>
        {itemMesh}
        <TransformControls
          object={groupRef}
          mode={transformMode}
          translationSnap={0.5}
          rotationSnap={Math.PI / 4}
          onMouseDown={() => {
            if (orbitControlsRef.current) {
              orbitControlsRef.current.enabled = false;
            }
          }}
          onMouseUp={() => {
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
            if (groupRef.current) {
              let [x, y, z] = groupRef.current.position.toArray();
              let [rx, ry, rz] = groupRef.current.rotation.toArray();

              if (selectedItemIds.length > 1 && transformMode === "translate") {
                const dx = x - item.position[0];
                const dy = y - item.position[1];
                const dz = z - item.position[2];
                moveSelectedItems([dx, dy, dz]);
                return;
              }

              if (transformMode === "translate" && isWallMountedItem(item.type)) {
                const state = useStore.getState();
                const mounted = snapExhibitToWall(item, [x, y, z], roomSize, state.floorPlanElements, state.items);
                if (mounted) {
                  [x, y, z] = mounted.position;
                  [rx, ry, rz] = mounted.rotation;
                  groupRef.current.position.set(x, y, z);
                  groupRef.current.rotation.set(rx, ry, rz);
                }
              }

              if (transformMode === "translate" && item.type !== "partition" && !isWallMountedItem(item.type)) {
                const snapDist = 1.5;
                const hw = roomSize.width / 2;
                const hl = roomSize.length / 2;
                const offset = 0.5;

                const distNorth = Math.abs(z - (-hl));
                const distSouth = Math.abs(z - hl);
                const distEast = Math.abs(x - hw);
                const distWest = Math.abs(x - (-hw));

                const minDist = Math.min(distNorth, distSouth, distEast, distWest);

                if (minDist < snapDist) {
                  if (minDist === distNorth) { z = -hl + offset; ry = 0; rx = 0; rz = 0; }
                  else if (minDist === distSouth) { z = hl - offset; ry = Math.PI; rx = 0; rz = 0; }
                  else if (minDist === distEast) { x = hw - offset; ry = -Math.PI / 2; rx = 0; rz = 0; }
                  else if (minDist === distWest) { x = -hw + offset; ry = Math.PI / 2; rx = 0; rz = 0; }
                  
                  x = Math.round(x * 2) / 2;
                  y = Math.round(y * 2) / 2;
                  z = Math.round(z * 2) / 2;
                  
                  if (minDist === distNorth) z = -hl + offset;
                  if (minDist === distSouth) z = hl - offset;
                  if (minDist === distEast) x = hw - offset;
                  if (minDist === distWest) x = -hw + offset;
                }
              }

              if (item.type === "partition") {
                rx = 0;
                rz = 0;
              }

              updateItem(item.id, {
                position: [x, y, z] as [number, number, number],
                rotation: [rx, ry, rz] as [number, number, number],
                scale: groupRef.current.scale.toArray() as [number, number, number],
              });
            }
          }}
        />
      </>
    );
  }

  return itemMesh;
}

function PaintingFallback({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const frameWidth = Math.max(0.8, item.frameWidth ?? 2);
  const frameHeight = Math.max(0.6, item.frameHeight ?? 1.5);

  return (
    <group>
      <BeveledBox dimensions={[frameWidth, frameHeight, 0.1]} position={[0, 0, -0.05]} castShadow={false}>
        <meshStandardMaterial color="#334155" roughness={0.7} />
        {isSelected && <Edges scale={1.05} color="#4f46e5" />}
      </BeveledBox>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[Math.max(0.2, frameWidth - 0.22), Math.max(0.2, frameHeight - 0.22)]} />
        <meshBasicMaterial color="#e2e8f0" />
      </mesh>
      <Text
        position={[0, 0, 0.04]}
        color="#475569"
        fontSize={0.11}
        maxWidth={Math.max(0.6, frameWidth - 0.35)}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
      >
        Image unavailable
      </Text>
    </group>
  );
}

function PaintingExhibit({ item, isSelected, mode, onInteract, quality }: ExhibitRendererProps) {
  return (
    <CanvasAssetBoundary
      resetKey={`${item.id}:${item.content}:${item.videoThumbnailUrl ?? ""}`}
      fallback={<PaintingFallback item={item} isSelected={isSelected} />}
    >
      <Painting
        item={item}
        isSelected={isSelected}
        quality={quality}
        onInteract={mode === "view" ? onInteract : undefined}
      />
    </CanvasAssetBoundary>
  );
}

function Painting({
  item,
  isSelected,
  quality,
  onInteract,
}: {
  item: ExhibitItemType;
  isSelected: boolean;
  quality: ExhibitModelQuality;
  onInteract?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const { t } = useI18n();
  const atmosphere = useContext(GalleryAtmosphereContext);
  const mode = useStore((state) => state.mode);
  const { gl } = useThree();
  const fallbackImageUrl =
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=800";

  const mime = item.fileMimeType || "";
  const content = item.content || "";
  const isVideo = mime.startsWith("video/") || /^data:video\//.test(content);
  const imageCandidateUrl = isVideo ? item.videoThumbnailUrl || "/demo/harbour.svg" : resolvePaintingImageUrl(item, fallbackImageUrl);
  const hasResolvedImage = imageCandidateUrl !== fallbackImageUrl;

  const safeImageUrl = useMemo(() => {
    const candidate = (imageCandidateUrl || "").trim();
    return candidate || fallbackImageUrl;
  }, [imageCandidateUrl]);

  const shouldLoadTexture = mode === "edit" || isSelected || hasResolvedImage || isVideo;

  const {
    frameWidth, frameHeight, frameBorder, canvasWidth, canvasHeight, imageWidth, imageHeight,
  } = getPaintingImageFit(item.frameWidth, item.frameHeight, item.imageAspectRatio,
    item.frameStyle === 'borderless' ? 0 : item.frameThickness === undefined ? undefined : item.frameThickness / 2);
  const captionY = -(frameHeight / 2 + 0.35);
  const frameAppearance = getPaintingFrameAppearance(item);
  const railThickness = frameBorder * 2;
  const outerWidth = frameWidth + frameBorder * 2;
  const outerHeight = frameHeight + frameBorder * 2;

  const texture = useTexture(shouldLoadTexture ? safeImageUrl : fallbackImageUrl);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(
      quality.textureAnisotropy,
      gl.capabilities.getMaxAnisotropy(),
    );
    texture.needsUpdate = true;
  }, [gl, quality.textureAnisotropy, texture]);
  const videoTexture = useMemo(() => {
    if (!shouldLoadTexture || !isVideo || !item.content) return null;

    const video = document.createElement("video");
    video.src = item.content;
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.loop = Boolean(item.videoLoop);
    video.muted = item.videoMuted ?? true;
    video.preload = "metadata";

    const nextTexture = new THREE.VideoTexture(video);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.minFilter = THREE.LinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.generateMipmaps = false;

    if (item.videoAutoplay) {
      void video.play().catch(() => {
        // autoplay may be blocked by browser policy when not muted
      });
    }

    return nextTexture;
  }, [isVideo, item.content, item.videoAutoplay, item.videoLoop, item.videoMuted, shouldLoadTexture]);

  useEffect(() => {
    return () => {
      if (!videoTexture) return;
      const video = videoTexture.image as HTMLVideoElement;
      video.pause();
      video.removeAttribute("src");
      video.load();
      videoTexture.dispose();
    };
  }, [videoTexture]);

  return (
    <group>
      {/* Frame */}
      <mesh
        position={[0, 0, -0.095]}
        castShadow={quality.castShadows}
      >
        <boxGeometry args={[outerWidth, outerHeight, 0.01]} />
        <meshStandardMaterial color="#24211e" roughness={0.95} />
      </mesh>
      {railThickness > 0 && ([
        { position: [0, frameHeight / 2, -0.05], length: outerWidth, rotation: 0 },
        { position: [0, -frameHeight / 2, -0.05], length: outerWidth, rotation: 0 },
        { position: [-frameWidth / 2, 0, -0.05], length: canvasHeight, rotation: Math.PI / 2 },
        { position: [frameWidth / 2, 0, -0.05], length: canvasHeight, rotation: Math.PI / 2 },
      ] as const).map((rail, index) => (
        <mesh
          key={index}
          name="painting-material-rail"
          position={[...rail.position]}
          rotation={[0, 0, rail.rotation]}
          castShadow={quality.castShadows}
          receiveShadow={quality.castShadows}
        >
          <PaintingRailGeometry args={[rail.length, railThickness, 0.1]} />
          <PaintingRailMaterial style={frameAppearance.frameStyle} color={frameAppearance.frameColor} />
          {isSelected && <Edges scale={1.01} color="#4f46e5" />}
        </mesh>
      ))}
      {/* Canvas */}
      {item.imageAspectRatio !== undefined && (
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[canvasWidth, canvasHeight]} />
          {atmosphere === "bright" ? (
            <meshBasicMaterial color={item.frameMatColor || "#f8fafc"} />
          ) : (
            <meshStandardMaterial
              color={item.frameMatColor || (atmosphere === "warm" ? "#fff7eb" : "#f8fafc")}
              roughness={0.9}
              metalness={0}
            />
          )}
        </mesh>
      )}
      <mesh
        position={[0, 0, 0.01]}
        castShadow={quality.castShadows}
        onPointerDown={onInteract}
        onClick={onInteract}
        userData={{ itemId: item.id, itemType: item.type }}
      >
        <planeGeometry args={[imageWidth, imageHeight]} />
        {atmosphere === "bright" ? (
          <meshBasicMaterial map={isVideo && videoTexture ? videoTexture : texture} />
        ) : (
          <meshStandardMaterial
            map={isVideo && videoTexture ? videoTexture : texture}
            color={atmosphere === "warm" ? "#fff7ed" : "#ffffff"}
            roughness={0.9}
            metalness={0}
            emissive="#ffffff"
            emissiveMap={isVideo && videoTexture ? videoTexture : texture}
            emissiveIntensity={0.08}
          />
        )}
      </mesh>
      {!hasResolvedImage && !isVideo && (
        <Text
          position={[0, -(frameHeight / 2 + 0.08), 0.03]}
          color="#111827"
          fontSize={0.12}
          maxWidth={1.9}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
        >
          {item.fileName || "已上傳文件（點擊查看）"}
        </Text>
      )}

      {/* Automatic artwork captions share the frame's mounting back at z = -0.1. */}
      <group position={[0, captionY, item.imageAspectRatio === undefined ? 0.03 : -0.1 + 0.03 / 2]}>
        <BeveledBox dimensions={[1.7, 0.32, 0.03]} bevelRadius={0.004}>
          <meshStandardMaterial color="#f8fafc" roughness={0.7} metalness={0.05} />
        </BeveledBox>
        <Text
          position={[0, 0.06, 0.02]}
          color="#111827"
          fontSize={0.08}
          maxWidth={1.55}
          whiteSpace={item.imageAspectRatio === undefined ? undefined : "nowrap"}
          clipRect={item.imageAspectRatio === undefined ? undefined : [-0.775, -0.05, 0.775, 0.05]}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
        >
          {item.title?.trim() || t("artworkEditUntitled")}
        </Text>
        <Text
          position={[0, -0.06, 0.02]}
          color="#4b5563"
          fontSize={0.065}
          maxWidth={1.55}
          whiteSpace={item.imageAspectRatio === undefined ? undefined : "nowrap"}
          clipRect={item.imageAspectRatio === undefined ? undefined : [-0.775, -0.04, 0.775, 0.04]}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
        >
          {item.artist?.trim() && item.artist.trim() !== "未知作者"
            ? item.artist.trim()
            : t("viewUnknownAuthor")}
        </Text>
      </group>
    </group>
  );
}

function Pedestal({ item, isSelected, quality }: ExhibitRendererProps) {
  const modelUrl = item.content?.trim();
  const modelOffset = item.modelOffset ?? [0, 0, 0];
  const display = getTemplateDisplay(item);

  if (display) return (
    <group>
      <BeveledBox dimensions={display.size} bevelRadius={0.025} position={[0, display.size[1] / 2, 0]} castShadow={quality.castShadows} receiveShadow={quality.castShadows}>
        <meshStandardMaterial color={display.color} roughness={0.86} metalness={0} />
        {isSelected && <Edges color="#4f46e5" />}
      </BeveledBox>
      {display.modelSize > 0 && <group position={[0, display.size[1], 0]}>
        <CanvasAssetBoundary resetKey={modelUrl} fallback={<PedestalModelFallback />}>
          <PedestalGLTFModel url={modelUrl} manualOffset={modelOffset} quality={quality} targetSize={display.modelSize} />
        </CanvasAssetBoundary>
      </group>}
    </group>
  );

  return (
    <group>
      {/* Base */}
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.52, 0.6, 0.24, quality.radialSegments]} />
        <meshPhysicalMaterial color="#d7d9dc" roughness={0.42} metalness={0.08} clearcoat={0.28} clearcoatRoughness={0.34} />
      </mesh>

      {/* Stem */}
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.76, quality.radialSegments]} />
        <meshPhysicalMaterial color="#ece9e2" roughness={0.36} metalness={0.04} clearcoat={0.2} clearcoatRoughness={0.4} />
      </mesh>
      <mesh position={[0, 0.265, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.405, 0.025, 8, quality.ringSegments]} />
        <meshStandardMaterial color="#a88a57" roughness={0.24} metalness={0.82} />
      </mesh>

      {/* Top platform */}
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.16, quality.radialSegments]} />
        <meshPhysicalMaterial color="#f5f2eb" roughness={0.22} metalness={0.04} clearcoat={0.45} clearcoatRoughness={0.26} />
      </mesh>

      {/* Top accent plate */}
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 1.17, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.03, quality.radialSegments]} />
        <meshStandardMaterial color="#b49a6a" roughness={0.2} metalness={0.72} />
      </mesh>

      {modelUrl ? (
        <group position={[0, 1.42, 0]}>
          <CanvasAssetBoundary resetKey={modelUrl} fallback={<PedestalModelFallback />}>
            <PedestalModel
              url={modelUrl}
              mimeType={item.fileMimeType}
              manualOffset={modelOffset}
              quality={quality}
            />
          </CanvasAssetBoundary>
        </group>
      ) : (
        <Text
          position={[0, 1.45, 0]}
          color="#4b5563"
          fontSize={0.09}
          maxWidth={1.4}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
        >
          尚未設定 3D 模型
        </Text>
      )}

      {isSelected && <Edges scale={1.04} color="#4f46e5" />}
    </group>
  );
}

function PedestalModelFallback() {
  return (
    <group>
      <BeveledBox
        dimensions={[0.58, 0.56, 0.58]}
        bevelRadius={0.015}
        castShadow={false}
        receiveShadow={false}
        position={[0, 0.28, 0]}
      >
        <meshStandardMaterial color="#cbd5e1" roughness={0.72} metalness={0.05} />
      </BeveledBox>
      <BeveledBox dimensions={[0.68, 0.04, 0.68]} bevelRadius={0.008} position={[0, 0.61, 0]}>
        <meshBasicMaterial color="#64748b" transparent opacity={0.28} />
      </BeveledBox>
      <Text
        position={[0, 0.98, 0]}
        color="#475569"
        fontSize={0.08}
        maxWidth={1.1}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
      >
        Model unavailable
      </Text>
    </group>
  );
}

function PedestalModel({
  url,
  mimeType,
  manualOffset,
  quality,
}: {
  url: string;
  mimeType?: string;
  manualOffset: [number, number, number];
  quality: ExhibitModelQuality;
}) {
  const lowerUrl = url.toLowerCase();
  const isStl = mimeType === "model/stl" || lowerUrl.endsWith(".stl") || /^data:model\/stl/.test(url);

  if (isStl) {
    return <PedestalSTLModel url={url} manualOffset={manualOffset} quality={quality} />;
  }

  return <PedestalGLTFModel url={url} manualOffset={manualOffset} quality={quality} />;
}

function PedestalGLTFModel({
  url,
  manualOffset,
  quality,
  targetSize = 0.9,
}: {
  url: string;
  manualOffset: [number, number, number];
  quality: ExhibitModelQuality;
  targetSize?: number;
}) {
  const { gl } = useThree();
  const gltf = useGLTF(url);
  const root = useMemo(() => cloneSkeleton(gltf.scene), [gltf.scene]);
  const rendererMaxAnisotropy = gl.capabilities.getMaxAnisotropy();
  const { scale, offset } = useMemo(() => {
    optimizeExhibitModel(root, quality, rendererMaxAnisotropy);
    return fitObjectToExhibit(root, targetSize);
  }, [quality, rendererMaxAnisotropy, root, targetSize]);

  return (
    <primitive
      object={root}
      scale={[scale, scale, scale]}
      position={[
        offset[0] + manualOffset[0],
        offset[1] + manualOffset[1],
        offset[2] + manualOffset[2],
      ]}
    />
  );
}

function PedestalSTLModel({
  url,
  manualOffset,
  quality,
}: {
  url: string;
  manualOffset: [number, number, number];
  quality: ExhibitModelQuality;
}) {
  const geometry = useLoader(STLLoader, url);

  useEffect(() => {
    geometry.computeVertexNormals();
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  }, [geometry]);

  const { scale, offset } = useMemo(() => {
    const model = new THREE.Mesh(geometry);
    return fitObjectToExhibit(model);
  }, [geometry]);

  return (
    <mesh
      geometry={geometry}
      scale={[scale, scale, scale]}
      position={[
        offset[0] + manualOffset[0],
        offset[1] + manualOffset[1],
        offset[2] + manualOffset[2],
      ]}
      castShadow={quality.castShadows}
      receiveShadow={quality.castShadows}
    >
      <meshStandardMaterial color="#d1d5db" roughness={0.4} metalness={0.2} />
    </mesh>
  );
}

function FlowerDecor({ item, isSelected, quality }: ExhibitRendererProps) {
  const petalColor = item.content || "#ec4899";

  return (
    <group>
      <CanvasAssetBoundary
        resetKey={`${FREE_VASE_MODEL_URL}:flower`}
        fallback={
          <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.22, 0.28, 0.4, quality.radialSegments]} />
            <meshStandardMaterial color="#d6d3d1" roughness={0.65} metalness={0.05} />
          </mesh>
        }
      >
        <FreeVaseModel
          accentColor="#ded8ce"
          quality={quality}
          targetSize={0.44}
        />
      </CanvasAssetBoundary>

      <CanvasAssetBoundary
        resetKey={FREE_FLOWER_MODEL_URLS.join(":")}
        fallback={<ProceduralFlowerTop color={petalColor} quality={quality} />}
      >
        <FreeFlowerBouquet quality={quality} color={petalColor} />
      </CanvasAssetBoundary>

      {isSelected && <Edges scale={1.08} color="#ec4899" />}
    </group>
  );
}

function ChandelierDecor({ item, isSelected, quality }: ExhibitRendererProps) {
  const glowColor = item.content || "#fde68a";
  const runtimeValue = useRuntimeInteractionStore(
    (state) => state.activeByItemId[item.id],
  );
  const isOn = runtimeValue ?? true;

  return (
    <group>
      <mesh position={[0, 1.1, 0]} castShadow={quality.castShadows}>
        <cylinderGeometry args={[0.16, 0.16, 0.07, quality.radialSegments]} />
        <meshStandardMaterial color="#b99a62" roughness={0.3} metalness={0.72} />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow={quality.castShadows}>
        <cylinderGeometry args={[0.03, 0.03, 1.1, quality.radialSegments]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, -0.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={quality.castShadows}>
        <torusGeometry args={[0.4, 0.06, Math.max(8, quality.radialSegments / 2), quality.ringSegments]} />
        <meshStandardMaterial color="#b99a62" roughness={0.22} metalness={0.82} />
      </mesh>
      <mesh position={[0, -0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.24, 0.025, 8, quality.ringSegments]} />
        <meshStandardMaterial color="#d7c39a" roughness={0.24} metalness={0.7} />
      </mesh>
      {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle) => (
        <mesh key={angle} position={[Math.cos(angle) * 0.4, -0.22, Math.sin(angle) * 0.4]}>
          <sphereGeometry args={[0.08, quality.sphereSegments, quality.sphereSegments]} />
          <meshStandardMaterial
            color={isOn ? glowColor : "#78716c"}
            emissive={isOn ? glowColor : "#000000"}
            emissiveIntensity={isOn ? 2.4 : 0}
            roughness={0.18}
          />
        </mesh>
      ))}
      {quality.decorativeLights && isOn && (
        <pointLight color={glowColor} intensity={2.8} distance={7} decay={2} position={[0, -0.2, 0]} />
      )}
      {isSelected && <Edges scale={1.08} color="#f59e0b" />}
    </group>
  );
}

function BenchDecor({ item, isSelected, quality }: ExhibitRendererProps) {
  const woodColor = item.content || "#8b5e3c";

  return (
    <group>
      {[-0.7, 0.7].map((x) => (
        <BeveledBox bevelSegments={quality.castShadows ? 2 : 1} key={`support:${x}`} dimensions={[0.055, 0.55, 0.055]} position={[x, 0.67, -0.27]}>
          <meshStandardMaterial color="#4b5055" roughness={0.5} metalness={0.35} />
        </BeveledBox>
      ))}
      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1} dimensions={[1.8, 0.16, 0.58]} bevelRadius={0.035} castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 0.46, 0]}>
        <meshPhysicalMaterial color={woodColor} roughness={0.48} metalness={0.02} clearcoat={0.36} clearcoatRoughness={0.42} />
      </BeveledBox>
      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1} dimensions={[1.8, 0.52, 0.1]} bevelRadius={0.025} castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 0.77, -0.24]}>
        <meshPhysicalMaterial color={woodColor} roughness={0.5} metalness={0.02} clearcoat={0.3} clearcoatRoughness={0.45} />
      </BeveledBox>
      {[-0.72, 0.72].map((x) =>
        [-0.2, 0.2].map((z) => (
          <BeveledBox bevelSegments={quality.castShadows ? 2 : 1} key={`${x}-${z}`} dimensions={[0.08, 0.4, 0.08]} bevelRadius={0.008} castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[x, 0.2, z]}>
            <meshStandardMaterial color="#6b7280" roughness={0.45} metalness={0.25} />
          </BeveledBox>
        )),
      )}
      {isSelected && <Edges scale={1.08} color="#7c3aed" />}
    </group>
  );
}

function RugDecor({ item, isSelected, quality }: ExhibitRendererProps) {
  const rugColor = item.content || "#1d4ed8";

  return (
    <group>
      {[-0.76, 0.76].map((x) => (
        <mesh key={x} position={[x, 0.037, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.035, 0.94]} />
          <meshStandardMaterial color="#e2cfaa" roughness={1} />
        </mesh>
      ))}
      {[-0.46, 0.46].map((z) => (
        <mesh key={z} position={[0, 0.037, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.55, 0.035]} />
          <meshStandardMaterial color="#e2cfaa" roughness={1} />
        </mesh>
      ))}
      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1}
        dimensions={[1.75, 0.035, 1.12]}
        bevelRadius={0.045}
        receiveShadow={quality.castShadows}
        position={[0, 0.018, 0]}
      >
        <meshStandardMaterial color={rugColor} roughness={0.96} metalness={0} />
      </BeveledBox>
      <mesh receiveShadow={quality.castShadows} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.038, 0]}>
        <ringGeometry args={[0.22, 0.32, quality.ringSegments]} />
        <meshStandardMaterial color="#f4dfad" roughness={0.9} metalness={0} />
      </mesh>
      {isSelected && <Edges scale={1.04} color="#1d4ed8" />}
    </group>
  );
}

function VaseDecor({ item, isSelected, quality }: ExhibitRendererProps) {
  const accentColor = item.content || "#38bdf8";

  return (
    <group>
      <mesh position={[0, 0.015, 0]} receiveShadow={quality.castShadows}>
        <cylinderGeometry args={[0.18, 0.17, 0.03, quality.radialSegments]} />
        <meshStandardMaterial color={accentColor} roughness={0.32} metalness={0.15} />
      </mesh>
      <CanvasAssetBoundary
        resetKey={FREE_VASE_MODEL_URL}
        fallback={<ProceduralVase accentColor={accentColor} quality={quality} />}
      >
        <FreeVaseModel accentColor={accentColor} quality={quality} />
      </CanvasAssetBoundary>
      {isSelected && <Edges scale={1.1} color="#0ea5e9" />}
    </group>
  );
}

function ProceduralVase({
  accentColor,
  quality,
}: {
  accentColor: string;
  quality: ExhibitModelQuality;
}) {
  return (
    <group>
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 0.38, 0]} scale={[0.82, 1.15, 0.82]}>
        <sphereGeometry args={[0.32, quality.sphereSegments, quality.sphereSegments]} />
        <meshPhysicalMaterial color="#e8edf0" roughness={0.2} metalness={0.04} clearcoat={0.72} clearcoatRoughness={0.18} />
      </mesh>
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.12, 0.2, 0.38, quality.radialSegments]} />
        <meshPhysicalMaterial color={accentColor} roughness={0.24} metalness={0.08} clearcoat={0.65} clearcoatRoughness={0.2} />
      </mesh>
      <mesh castShadow={quality.castShadows} position={[0, 0.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.13, 0.025, Math.max(8, quality.radialSegments / 2), quality.ringSegments]} />
        <meshStandardMaterial color="#b99a62" roughness={0.2} metalness={0.78} />
      </mesh>
    </group>
  );
}

function FreeVaseModel({
  accentColor,
  quality,
  targetSize = 0.95,
}: {
  accentColor: string;
  quality: ExhibitModelQuality;
  targetSize?: number;
}) {
  const { gl } = useThree();
  const gltf = useGLTF(FREE_VASE_MODEL_URL);
  const rendererMaxAnisotropy = gl.capabilities.getMaxAnisotropy();
  const root = useMemo(() => {
    const clone = cloneSkeleton(gltf.scene);
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const recolor = (material: THREE.Material) => {
        const cloned = material.clone();
        if (
          cloned instanceof THREE.MeshStandardMaterial ||
          cloned instanceof THREE.MeshPhysicalMaterial
        ) {
          cloned.color.lerp(new THREE.Color(accentColor), 0.32);
        }
        return cloned;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(recolor)
        : recolor(object.material);
    });
    optimizeExhibitModel(clone, quality, rendererMaxAnisotropy);
    return clone;
  }, [accentColor, gltf.scene, quality, rendererMaxAnisotropy]);
  const { scale, offset } = useMemo(
    () => fitObjectToExhibit(root, targetSize),
    [root, targetSize],
  );

  useEffect(() => {
    return () => {
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      });
    };
  }, [root]);

  return (
    <primitive
      object={root}
      scale={[scale, scale, scale]}
      position={offset}
    />
  );
}

function FreeFlowerBouquet({
  quality,
  color,
}: {
  quality: ExhibitModelQuality;
  color: string;
}) {
  const flowers = [
    {
      modelUrl: FREE_FLOWER_MODEL_URLS[0],
      position: [-0.08, 0.43, 0.01] as const,
      rotation: [0.05, -0.35, -0.1] as const,
      scale: 0.92,
    },
    {
      modelUrl: FREE_FLOWER_MODEL_URLS[1],
      position: [0.08, 0.42, 0.035] as const,
      rotation: [-0.04, 0.45, 0.11] as const,
      scale: 0.86,
    },
    {
      modelUrl: FREE_FLOWER_MODEL_URLS[2],
      position: [0, 0.41, -0.055] as const,
      rotation: [0.02, 0.1, 0] as const,
      scale: 1,
    },
  ];

  return (
    <group>
      {flowers.map(({ modelUrl, position, rotation, scale }) => (
        <group
          key={modelUrl}
          position={position}
          rotation={[...rotation]}
          scale={scale}
        >
          <FreeFlowerModel
            modelUrl={modelUrl}
            color={color}
            quality={quality}
            targetSize={0.7}
          />
        </group>
      ))}
    </group>
  );
}

function FreeFlowerModel({
  modelUrl,
  color,
  quality,
  targetSize,
}: {
  modelUrl: string;
  color: string;
  quality: ExhibitModelQuality;
  targetSize: number;
}) {
  const { gl } = useThree();
  const gltf = useGLTF(modelUrl);
  const rendererMaxAnisotropy = gl.capabilities.getMaxAnisotropy();
  const root = useMemo(() => {
    const clone = cloneSkeleton(gltf.scene);
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone();
    });
    optimizeExhibitModel(clone, quality, rendererMaxAnisotropy);
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        const hsl = material.color.getHSL({ h: 0, s: 0, l: 0 });
        // Preserve green stems and neutral parts; recolor the existing petals.
        if (hsl.s > 0.2 && !(hsl.h > 0.18 && hsl.h < 0.48)) material.color.set(color);
      }
    });
    return clone;
  }, [gltf.scene, quality, rendererMaxAnisotropy, color]);
  const { scale, offset } = useMemo(
    () => fitObjectToExhibit(root, targetSize),
    [root, targetSize],
  );

  useEffect(() => {
    return () => {
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      });
    };
  }, [root]);

  return (
    <primitive
      object={root}
      scale={[scale, scale, scale]}
      position={offset}
    />
  );
}

function ProceduralFlowerTop({
  color,
  quality,
}: {
  color: string;
  quality: ExhibitModelQuality;
}) {
  return (
    <group>
      <mesh castShadow={quality.castShadows} position={[0, 0.76, 0]}>
        <cylinderGeometry args={[0.03, 0.035, 0.7, quality.radialSegments]} />
        <meshStandardMaterial color="#16a34a" roughness={0.75} metalness={0.02} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((angle) => (
        <mesh
          key={angle}
          castShadow={quality.castShadows}
          position={[Math.cos(angle) * 0.12, 1.05, Math.sin(angle) * 0.12]}
          rotation={[0, angle, Math.PI / 2.8]}
          scale={[1.5, 0.62, 1]}
        >
          <sphereGeometry args={[0.1, quality.sphereSegments, quality.sphereSegments]} />
          <meshStandardMaterial color={color} roughness={0.46} metalness={0.02} />
        </mesh>
      ))}
    </group>
  );
}

function SculptureDecor({ item, isSelected, quality }: ExhibitRendererProps) {
  const stoneColor = item.content || "#9ca3af";

  return (
    <group>
      <mesh position={[0, 0.59, 0]} castShadow={quality.castShadows}>
        <cylinderGeometry args={[0.055, 0.085, 0.38, quality.radialSegments]} />
        <meshStandardMaterial color="#aa8c54" roughness={0.3} metalness={0.7} />
      </mesh>
      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1} dimensions={[0.62, 0.4, 0.62]} bevelRadius={0.018} castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 0.2, 0]}>
        <meshStandardMaterial color="#d1d5db" roughness={0.74} metalness={0.08} />
      </BeveledBox>
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 1.02, 0]} rotation={[0.3, 0.5, 0.2]}>
        <icosahedronGeometry args={[0.38, 0]} />
        <meshPhysicalMaterial color={stoneColor} roughness={0.34} metalness={0.18} clearcoat={0.25} clearcoatRoughness={0.35} />
      </mesh>
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0.18, 1.36, -0.08]} rotation={[0.2, 0.2, 0.3]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.52} metalness={0.18} />
      </mesh>
      {isSelected && <Edges scale={1.12} color="#6366f1" />}
    </group>
  );
}

function SpotlightDecor({ item, isSelected, quality }: ExhibitRendererProps) {
  const beamColor = item.content || "#fff3b0";
  const runtimeValue = useRuntimeInteractionStore(
    (state) => state.activeByItemId[item.id],
  );
  const isOn = runtimeValue ?? true;

  return (
    <group>
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 0.11, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.22, quality.radialSegments]} />
        <meshStandardMaterial color="#334155" roughness={0.46} metalness={0.42} />
      </mesh>
      <group position={[0, 0.38, 0]} rotation={[Math.PI / 4.2, 0, 0]}>
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows}>
        <cylinderGeometry args={[0.08, 0.16, 0.48, quality.radialSegments]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.52} />
      </mesh>
      <mesh position={[0, 0.242, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.075, quality.radialSegments]} />
        <meshStandardMaterial
          color={isOn ? beamColor : "#64748b"}
          emissive={isOn ? beamColor : "#000000"}
          emissiveIntensity={isOn ? 2.6 : 0}
          roughness={0.12}
          toneMapped={!isOn}
        />
      </mesh>
      <mesh visible={isOn && quality.decorativeLights} position={[0, 0.7, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.26, 0.9, quality.radialSegments, 1, true]} />
        <meshBasicMaterial color={beamColor} transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      </group>
      {quality.decorativeLights && isOn && (
        <pointLight color={beamColor} intensity={1.3} distance={4.2} decay={2.2} position={[0, 0.78, 0.34]} />
      )}
      {isSelected && <Edges scale={1.1} color="#facc15" />}
    </group>
  );
}

function PlantDecor({ item, isSelected, quality }: ExhibitRendererProps) {
  const leafColor = item.content || "#22c55e";

  return (
    <group>
      <CanvasAssetBoundary
        resetKey={`${FREE_VASE_MODEL_URL}:plant`}
        fallback={
          <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.24, 0.3, 0.44, quality.radialSegments]} />
            <meshStandardMaterial color="#d6d3d1" roughness={0.7} metalness={0.06} />
          </mesh>
        }
      >
        <FreeVaseModel
          accentColor="#e2ddd3"
          quality={quality}
          targetSize={0.5}
        />
      </CanvasAssetBoundary>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.025, quality.radialSegments]} />
        <meshStandardMaterial color="#3f3026" roughness={1} />
      </mesh>
      <mesh position={[0, 0.76, 0]} castShadow={quality.castShadows}>
        <cylinderGeometry args={[0.018, 0.035, 0.78, 8]} />
        <meshStandardMaterial color="#526b35" roughness={0.85} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => {
        const angle = i * 2.4;
        return (
          <group key={i} position={[0, 0.58 + i * 0.065, 0]} rotation={[0, angle, 0]}>
            <mesh position={[0.13, 0.035, 0]} rotation={[0, 0, 0.35]} scale={[0.23, 0.025, 0.095]} castShadow={quality.castShadows}>
              <sphereGeometry args={[1, quality.sphereSegments, 8]} />
              <meshStandardMaterial color={leafColor} roughness={0.72} />
            </mesh>
          </group>
        );
      })}
      {isSelected && <Edges scale={1.1} color="#22c55e" />}
    </group>
  );
}

function ColumnDecor({ item, isSelected, quality }: ExhibitRendererProps) {
  const columnColor = item.content || "#cbd5e1";

  return (
    <group>
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.3, quality.radialSegments]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.6} metalness={0.12} />
      </mesh>
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.19, 0.23, 2.6, quality.radialSegments]} />
        <meshPhysicalMaterial color={columnColor} roughness={0.5} metalness={0.05} clearcoat={0.18} clearcoatRoughness={0.42} />
      </mesh>
      {[0.34, 2.66].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.245, 0.035, 8, quality.ringSegments]} />
          <meshStandardMaterial color="#b49a6a" roughness={0.24} metalness={0.72} />
        </mesh>
      ))}
      <mesh castShadow={quality.castShadows} receiveShadow={quality.castShadows} position={[0, 2.88, 0]}>
        <cylinderGeometry args={[0.34, 0.28, 0.28, quality.radialSegments]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.55} metalness={0.1} />
      </mesh>
      {isSelected && <Edges scale={1.08} color="#64748b" />}
    </group>
  );
}

function NeonDecor({ item, isSelected, quality }: ExhibitRendererProps) {
  const neonColor = item.content || "#22d3ee";
  const runtimeValue = useRuntimeInteractionStore(
    (state) => state.activeByItemId[item.id],
  );
  const isOn = runtimeValue ?? true;

  return (
    <group>
      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1} dimensions={[1, 0.25, 0.12]} bevelRadius={0.012} castShadow={quality.castShadows} receiveShadow={quality.castShadows}>
        <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.32} />
      </BeveledBox>
      {[-0.075, 0.075].map((y) => (
      <BeveledBox bevelSegments={quality.castShadows ? 2 : 1} key={y} dimensions={[0.82, 0.025, 0.025]} bevelRadius={0.012} position={[0, y, 0.08]}>
        <meshStandardMaterial
          color={isOn ? neonColor : "#475569"}
          emissive={isOn ? neonColor : "#000000"}
          emissiveIntensity={isOn ? 3.2 : 0}
          roughness={0.16}
          toneMapped={!isOn}
        />
      </BeveledBox>
      ))}
      {quality.decorativeLights && isOn && (
        <pointLight color={neonColor} intensity={1.2} distance={3.5} decay={2.5} position={[0, 0, 0.22]} />
      )}
      {isSelected && <Edges scale={1.1} color="#22d3ee" />}
    </group>
  );
}
