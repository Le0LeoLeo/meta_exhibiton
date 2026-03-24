import { useRef, useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { ExhibitItem as ExhibitItemType } from "../types";
import { Text, useTexture, TransformControls, Edges, useGLTF } from "@react-three/drei";
import { useLoader, useThree } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";

export function ExhibitItem({ item }: { item: ExhibitItemType }) {
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

  const isSelected = selectedItemIds.includes(item.id);
  const isPrimarySelected = selectedItemId === item.id;
  const isLockedPartition = item.type === "partition" && Boolean(item.isLocked);
  const groupRef = useRef<THREE.Group>(null);
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
    return () => {
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = true;
      }
    };
  }, []);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (mode === "edit") {
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

  let content = null;

  if (item.type === "painting") {
    content = (
      <Painting
        item={item}
        isSelected={isSelected && mode === "edit"}
        onInteract={mode === "view" ? handlePointerDown : undefined}
      />
    );
  } else if (item.type === "pedestal") {
    content = <Pedestal item={item} isSelected={isSelected && mode === "edit"} />;
  } else if (item.type === "text") {
    content = (
      <Text3D
        content={item.content}
        isSelected={isSelected && mode === "edit"}
        fontFamily={item.textFontFamily || "sans"}
        color={item.textColor || "#111827"}
        fontSize={item.textFontSize ?? 0.5}
        isBold={Boolean(item.textIsBold)}
        backboardEnabled={Boolean(item.textBackboardEnabled)}
        backboardColor={item.textBackboardColor || "#ffffff"}
      />
    );
  } else if (item.type === "partition") {
    content = <Partition item={item} isSelected={isSelected && mode === "edit"} />;
  } else if (item.type === "lightstrip") {
    content = <LightStrip item={item} isSelected={isSelected && mode === "edit"} />;
  } else if (item.type === "flower") {
    content = <FlowerDecor item={item} isSelected={isSelected && mode === "edit"} />;
  } else if (item.type === "chandelier") {
    content = <ChandelierDecor item={item} isSelected={isSelected && mode === "edit"} />;
  } else if (item.type === "bench") {
    content = <BenchDecor item={item} isSelected={isSelected && mode === "edit"} />;
  } else if (item.type === "rug") {
    content = <RugDecor item={item} isSelected={isSelected && mode === "edit"} />;
  } else if (item.type === "vase") {
    content = <VaseDecor item={item} isSelected={isSelected && mode === "edit"} />;
  } else if (item.type === "sculpture") {
    content = <SculptureDecor item={item} isSelected={isSelected && mode === "edit"} />;
  } else if (item.type === "spotlight") {
    content = <SpotlightDecor item={item} isSelected={isSelected && mode === "edit"} />;
  } else if (item.type === "plant") {
    content = <PlantDecor item={item} isSelected={isSelected && mode === "edit"} />;
  } else if (item.type === "column") {
    content = <ColumnDecor item={item} isSelected={isSelected && mode === "edit"} />;
  } else if (item.type === "neon") {
    content = <NeonDecor item={item} isSelected={isSelected && mode === "edit"} />;
  }

  const transformProps = {
    position: item.position,
    rotation: item.rotation,
    scale: item.scale,
  };

  const itemMesh = mode === "view" ? (
    <group onPointerDown={handlePointerDown}>
      <RigidBody type="fixed" colliders="cuboid" {...transformProps}>
        {content}
      </RigidBody>
    </group>
  ) : (
    <group
      ref={groupRef}
      {...transformProps}
      onPointerDown={handlePointerDown}
    >
      {content}
    </group>
  );

  if (isPrimarySelected && mode === "edit" && !isLockedPartition) {
    return (
      <>
        {itemMesh}
        <TransformControls
          object={groupRef}
          mode={transformMode}
          translationSnap={0.5}
          rotationSnap={Math.PI / 4}
          onDraggingChanged={(dragging) => {
            if (orbitControlsRef.current) {
              orbitControlsRef.current.enabled = !dragging;
            }
          }}
          onMouseUp={() => {
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

              if (transformMode === "translate" && item.type !== "partition") {
                const snapDist = 1.5;
                const hw = roomSize.width / 2;
                const hl = roomSize.length / 2;
                const offset = (item.type === 'painting' || item.type === 'text') ? 0.1 : 0.5;

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

function Painting({
  item,
  isSelected,
  onInteract,
}: {
  item: ExhibitItemType;
  isSelected: boolean;
  onInteract?: (e: any) => void;
}) {
  const fallbackImageUrl =
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=800";

  const mime = item.fileMimeType || "";
  const isImage = mime.startsWith("image/") || /^data:image\//.test(item.content || "");
  const isVideo = mime.startsWith("video/") || /^data:video\//.test(item.content || "");

  const imageCandidateUrl = isImage
    ? item.content
    : isVideo
      ? item.videoThumbnailUrl || fallbackImageUrl
      : fallbackImageUrl;

  const [safeImageUrl, setSafeImageUrl] = useState<string>(fallbackImageUrl);

  useEffect(() => {
    const candidate = (imageCandidateUrl || "").trim();
    if (!candidate) {
      setSafeImageUrl(fallbackImageUrl);
      return;
    }

    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = () => setSafeImageUrl(candidate);
    probe.onerror = () => setSafeImageUrl(fallbackImageUrl);
    probe.src = candidate;
  }, [imageCandidateUrl]);

  const frameWidth = Math.max(0.8, item.frameWidth ?? 2);
  const frameHeight = Math.max(0.6, item.frameHeight ?? 1.5);
  const frameBorder = Math.max(0.08, Math.min(0.16, Math.min(frameWidth, frameHeight) * 0.08));
  const canvasWidth = Math.max(0.2, frameWidth - frameBorder * 2);
  const canvasHeight = Math.max(0.2, frameHeight - frameBorder * 2);
  const captionY = -(frameHeight / 2 + 0.35);

  const texture = useTexture(safeImageUrl);
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);

  useEffect(() => {
    if (!isVideo || !item.content) {
      setVideoTexture(null);
      return;
    }

    const video = document.createElement("video");
    video.src = item.content;
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.loop = Boolean(item.videoLoop);
    video.muted = item.videoMuted ?? true;
    video.preload = "auto";

    const nextTexture = new THREE.VideoTexture(video);
    nextTexture.minFilter = THREE.LinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.generateMipmaps = false;

    setVideoTexture(nextTexture);

    if (item.videoAutoplay) {
      void video.play().catch(() => {
        // autoplay may be blocked by browser policy when not muted
      });
    }

    return () => {
      video.pause();
      video.src = "";
      nextTexture.dispose();
      setVideoTexture(null);
    };
  }, [isVideo, item.content, item.videoAutoplay, item.videoLoop, item.videoMuted]);

  return (
    <group>
      {/* Frame */}
      <mesh position={[0, 0, -0.05]} castShadow>
        <boxGeometry args={[frameWidth + frameBorder * 2, frameHeight + frameBorder * 2, 0.1]} />
        <meshStandardMaterial color="#333" />
        {isSelected && <Edges scale={1.05} color="#4f46e5" />}
      </mesh>
      {/* Canvas */}
      <mesh
        position={[0, 0, 0.01]}
        castShadow
        onPointerDown={onInteract}
        onClick={onInteract}
        userData={{ itemId: item.id, itemType: item.type }}
      >
        <planeGeometry args={[canvasWidth, canvasHeight]} />
        <meshBasicMaterial map={isVideo && videoTexture ? videoTexture : texture} />
      </mesh>
      {!isImage && !isVideo && (
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

      {/* Artwork caption plaque */}
      <group position={[0, captionY, 0.03]}>
        <mesh>
          <boxGeometry args={[1.7, 0.32, 0.03]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.7} metalness={0.05} />
        </mesh>
        <Text
          position={[0, 0.06, 0.02]}
          color="#111827"
          fontSize={0.08}
          maxWidth={1.55}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
        >
          {item.title?.trim() || "未命名作品"}
        </Text>
        <Text
          position={[0, -0.06, 0.02]}
          color="#4b5563"
          fontSize={0.065}
          maxWidth={1.55}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
        >
          {item.artist?.trim() || "未知作者"}
        </Text>
      </group>
    </group>
  );
}

function Pedestal({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const modelUrl = item.content?.trim();
  const modelOffset = item.modelOffset ?? [0, 0, 0];

  return (
    <group>
      {/* Base */}
      <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.52, 0.6, 0.24, 32]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.58} metalness={0.12} />
      </mesh>

      {/* Stem */}
      <mesh castShadow receiveShadow position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.76, 28]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.45} metalness={0.08} />
      </mesh>

      {/* Top platform */}
      <mesh castShadow receiveShadow position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.16, 32]} />
        <meshStandardMaterial color="#f3f4f6" roughness={0.28} metalness={0.06} />
      </mesh>

      {/* Top accent plate */}
      <mesh castShadow receiveShadow position={[0, 1.17, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.03, 32]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.22} metalness={0.35} />
      </mesh>

      {modelUrl ? (
        <group position={[0, 1.42, 0]}>
          <PedestalModel
            url={modelUrl}
            mimeType={item.fileMimeType}
            manualOffset={modelOffset}
          />
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

function PedestalModel({
  url,
  mimeType,
  manualOffset,
}: {
  url: string;
  mimeType?: string;
  manualOffset: [number, number, number];
}) {
  const lowerUrl = url.toLowerCase();
  const isStl = mimeType === "model/stl" || lowerUrl.endsWith(".stl") || /^data:model\/stl/.test(url);

  if (isStl) {
    return <PedestalSTLModel url={url} manualOffset={manualOffset} />;
  }

  return <PedestalGLTFModel url={url} manualOffset={manualOffset} />;
}

function PedestalGLTFModel({
  url,
  manualOffset,
}: {
  url: string;
  manualOffset: [number, number, number];
}) {
  const gltf = useGLTF(url);
  const root = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxAxis = Math.max(size.x || 1, size.y || 1, size.z || 1);
    const normalizedScale = 0.9 / maxAxis;
    const minY = box.min.y;

    return {
      scale: normalizedScale,
      offset: [
        -center.x * normalizedScale,
        -minY * normalizedScale,
        -center.z * normalizedScale,
      ] as [number, number, number],
    };
  }, [root]);

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
}: {
  url: string;
  manualOffset: [number, number, number];
}) {
  const geometry = useLoader(STLLoader, url);

  useEffect(() => {
    geometry.computeVertexNormals();
  }, [geometry]);

  const { scale, offset } = useMemo(() => {
    const g = geometry.clone();
    g.computeBoundingBox();
    const box = g.boundingBox;
    if (!box) {
      return { scale: 0.02, offset: [0, 0, 0] as [number, number, number] };
    }

    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxAxis = Math.max(size.x || 1, size.y || 1, size.z || 1);
    const normalizedScale = 0.9 / maxAxis;
    const minY = box.min.y;

    return {
      scale: normalizedScale,
      offset: [
        -center.x * normalizedScale,
        -minY * normalizedScale,
        -center.z * normalizedScale,
      ] as [number, number, number],
    };
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
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color="#d1d5db" roughness={0.4} metalness={0.2} />
    </mesh>
  );
}

function Text3D({
  content,
  isSelected,
  fontFamily,
  color,
  fontSize,
  isBold,
  backboardEnabled,
  backboardColor,
}: {
  content: string;
  isSelected: boolean;
  fontFamily: "sans" | "serif" | "mono";
  color: string;
  fontSize: number;
  isBold: boolean;
  backboardEnabled: boolean;
  backboardColor: string;
}) {
  const normalizedContent = content || " ";
  const lines = normalizedContent.split("\n");
  const lineCount = Math.max(1, lines.length);
  const maxChars = Math.max(...lines.map((line) => line.length), 1);
  const fontWeight = isBold ? 800 : 400;
  const letterSpacing = fontFamily === "mono" ? 0.01 : 0.02;
  const charWidthFactor = isBold ? 1.02 : 0.92;
  const horizontalPadding = 0.5;
  const verticalPadding = 0.35;
  const boardWidth = maxChars * fontSize * charWidthFactor + horizontalPadding;
  const boardHeight = Math.max(0.6, lineCount * fontSize * 1.35 + verticalPadding);

  return (
    <group>
      {backboardEnabled && (
        <mesh position={[0, 0, -0.04]} castShadow receiveShadow>
          <planeGeometry args={[boardWidth, boardHeight]} />
          <meshStandardMaterial color={backboardColor} roughness={0.75} metalness={0.04} />
        </mesh>
      )}
      <Text
        color={color}
        fontSize={fontSize}
        maxWidth={Math.max(3, boardWidth * 0.9)}
        lineHeight={1}
        letterSpacing={letterSpacing}
        fontWeight={fontWeight}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
      >
        {normalizedContent}
      </Text>
      {isSelected && (
        <mesh position={[0, 0, -0.1]}>
          <planeGeometry args={[boardWidth, boardHeight]} />
          <meshBasicMaterial color="#4f46e5" wireframe />
        </mesh>
      )}
    </group>
  );
}

function Partition({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const roomSize = useStore((state) => state.roomSize);
  const partitionTexture = useTexture(roomSize.wallTextureUrl || "/textures/wall-paint.svg");

  useEffect(() => {
    partitionTexture.wrapS = THREE.RepeatWrapping;
    partitionTexture.wrapT = THREE.RepeatWrapping;
    const tiling = roomSize.wallTextureTiling ?? 3;
    partitionTexture.repeat.set(tiling, tiling);
    partitionTexture.needsUpdate = true;
  }, [partitionTexture, roomSize.wallTextureTiling]);

  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        map={partitionTexture}
        bumpMap={partitionTexture}
        color={item.content || roomSize.wallColor || "#f3f4f6"}
        roughness={roomSize.wallRoughness ?? 0.62}
        metalness={roomSize.wallMetalness ?? 0.02}
        bumpScale={roomSize.wallBumpScale ?? 0.05}
        envMapIntensity={roomSize.wallEnvIntensity ?? 0.35}
      />
      {isSelected && <Edges scale={1.001} color="#4f46e5" />}
    </mesh>
  );
}

function LightStrip({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const lightColor = item.content || "#ffe08a";
  const lightIntensity = item.lightIntensity ?? 0.5;

  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.51]}>
        <planeGeometry args={[0.88, 0.3]} />
        <meshBasicMaterial color={lightColor} transparent opacity={0.3} />
      </mesh>
      <pointLight color={lightColor} intensity={lightIntensity} distance={2.6 + lightIntensity * 1.8} decay={2.6} position={[0, 0, 0.68]} />
      {isSelected && <Edges scale={1.02} color="#f59e0b" />}
    </group>
  );
}

function FlowerDecor({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const petalColor = item.content || "#ec4899";

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.4, 24]} />
        <meshStandardMaterial color="#d6d3d1" roughness={0.65} metalness={0.05} />
      </mesh>

      <mesh castShadow position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.72, 16]} />
        <meshStandardMaterial color="#16a34a" roughness={0.75} metalness={0.02} />
      </mesh>

      {[0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3].map((angle) => (
        <mesh
          key={angle}
          castShadow
          position={[Math.cos(angle) * 0.1, 1.02, Math.sin(angle) * 0.1]}
          rotation={[0, angle, Math.PI / 2.8]}
        >
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={petalColor} roughness={0.42} metalness={0.03} />
        </mesh>
      ))}

      <mesh castShadow position={[0, 1.02, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#facc15" roughness={0.45} metalness={0.05} />
      </mesh>

      {isSelected && <Edges scale={1.08} color="#ec4899" />}
    </group>
  );
}

function ChandelierDecor({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const glowColor = item.content || "#fde68a";

  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.1, 12]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, -0.1, 0]} castShadow>
        <torusGeometry args={[0.4, 0.06, 16, 36]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.35} metalness={0.35} />
      </mesh>
      {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle) => (
        <mesh key={angle} position={[Math.cos(angle) * 0.4, -0.22, Math.sin(angle) * 0.4]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color={glowColor} />
        </mesh>
      ))}
      <pointLight color={glowColor} intensity={2.8} distance={7} decay={2} position={[0, -0.2, 0]} />
      {isSelected && <Edges scale={1.08} color="#f59e0b" />}
    </group>
  );
}

function BenchDecor({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const woodColor = item.content || "#8b5e3c";

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
        <boxGeometry args={[1, 0.16, 1]} />
        <meshStandardMaterial color={woodColor} roughness={0.72} metalness={0.06} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.74, -0.34]}>
        <boxGeometry args={[1, 0.52, 0.1]} />
        <meshStandardMaterial color={woodColor} roughness={0.72} metalness={0.06} />
      </mesh>
      {[-0.42, 0.42].map((x) =>
        [-0.42, 0.42].map((z) => (
          <mesh key={`${x}-${z}`} castShadow receiveShadow position={[x, 0.2, z]}>
            <boxGeometry args={[0.08, 0.4, 0.08]} />
            <meshStandardMaterial color="#6b7280" roughness={0.45} metalness={0.25} />
          </mesh>
        )),
      )}
      {isSelected && <Edges scale={1.08} color="#7c3aed" />}
    </group>
  );
}

function RugDecor({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const rugColor = item.content || "#1d4ed8";

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={rugColor} roughness={0.92} metalness={0.02} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.021, 0]}>
        <ringGeometry args={[0.22, 0.32, 40]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.88} metalness={0.02} />
      </mesh>
      {isSelected && <Edges scale={1.04} color="#1d4ed8" />}
    </group>
  );
}

function VaseDecor({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const accentColor = item.content || "#38bdf8";

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 0.84, 28]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.48} metalness={0.18} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.78, 0]}>
        <torusGeometry args={[0.16, 0.028, 12, 30]} />
        <meshStandardMaterial color={accentColor} roughness={0.42} metalness={0.15} />
      </mesh>
      <mesh castShadow position={[0, 1.06, 0]}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial color={accentColor} roughness={0.4} metalness={0.06} />
      </mesh>
      {isSelected && <Edges scale={1.1} color="#0ea5e9" />}
    </group>
  );
}

function SculptureDecor({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const stoneColor = item.content || "#9ca3af";

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[0.62, 0.4, 0.62]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.74} metalness={0.08} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.02, 0]} rotation={[0.3, 0.5, 0.2]}>
        <icosahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial color={stoneColor} roughness={0.58} metalness={0.12} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.18, 1.36, -0.08]} rotation={[0.2, 0.2, 0.3]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.52} metalness={0.18} />
      </mesh>
      {isSelected && <Edges scale={1.12} color="#6366f1" />}
    </group>
  );
}

function SpotlightDecor({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const beamColor = item.content || "#fff3b0";

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.22, 24]} />
        <meshStandardMaterial color="#334155" roughness={0.46} metalness={0.42} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.52, 0]} rotation={[-Math.PI / 4.2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.16, 0.48, 24]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.52} />
      </mesh>
      <mesh position={[0, 0.72, 0.2]} rotation={[-Math.PI / 3.4, 0, 0]}>
        <coneGeometry args={[0.26, 0.9, 20, 1, true]} />
        <meshBasicMaterial color={beamColor} transparent opacity={0.26} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight color={beamColor} intensity={1.3} distance={4.2} decay={2.2} position={[0, 0.78, 0.34]} />
      {isSelected && <Edges scale={1.1} color="#facc15" />}
    </group>
  );
}

function PlantDecor({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const leafColor = item.content || "#22c55e";

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.24, 0.3, 0.44, 24]} />
        <meshStandardMaterial color="#d6d3d1" roughness={0.7} metalness={0.06} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.62, 16]} />
        <meshStandardMaterial color="#15803d" roughness={0.78} metalness={0.02} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((angle) => (
        <mesh key={angle} position={[Math.cos(angle) * 0.14, 1.02, Math.sin(angle) * 0.14]} rotation={[0, angle, Math.PI / 2.6]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial color={leafColor} roughness={0.5} metalness={0.04} />
        </mesh>
      ))}
      {isSelected && <Edges scale={1.1} color="#22c55e" />}
    </group>
  );
}

function ColumnDecor({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const columnColor = item.content || "#cbd5e1";

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.3, 20]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.6} metalness={0.12} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 2.6, 20]} />
        <meshStandardMaterial color={columnColor} roughness={0.64} metalness={0.1} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 2.88, 0]}>
        <cylinderGeometry args={[0.34, 0.28, 0.28, 20]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.55} metalness={0.1} />
      </mesh>
      {isSelected && <Edges scale={1.08} color="#64748b" />}
    </group>
  );
}

function NeonDecor({ item, isSelected }: { item: ExhibitItemType; isSelected: boolean }) {
  const neonColor = item.content || "#22d3ee";

  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 0.25, 0.12]} />
        <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.32} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[0.82, 0.12, 0.04]} />
        <meshBasicMaterial color={neonColor} />
      </mesh>
      <pointLight color={neonColor} intensity={1.2} distance={3.5} decay={2.5} position={[0, 0, 0.22]} />
      {isSelected && <Edges scale={1.1} color="#22d3ee" />}
    </group>
  );
}
