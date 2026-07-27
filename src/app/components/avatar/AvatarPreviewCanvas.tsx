import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { AVATAR_MANIFEST } from "@/app/modules/metaverse3d/avatar/avatarManifest";
import type { AvatarAppearanceV1 } from "@/app/modules/metaverse3d/avatar/avatarAppearance";
import { AvatarModel } from "@/app/modules/metaverse3d/avatar/AvatarModel";
import { AvatarModelBoundary } from "@/app/modules/metaverse3d/avatar/AvatarModelBoundary";
import { ProceduralAvatarFallback } from "@/app/modules/metaverse3d/avatar/ProceduralAvatarFallback";

type AvatarPreviewCanvasProps = {
  appearance: AvatarAppearanceV1;
  unavailableLabel: string;
};

function PreviewFallback({ appearance }: { appearance: AvatarAppearanceV1 }) {
  const skin = AVATAR_MANIFEST.colors.skin[appearance.colors.skin];
  const hair = AVATAR_MANIFEST.colors.hair[appearance.colors.hair];
  const top = AVATAR_MANIFEST.colors.top[appearance.colors.top];
  const bottom = AVATAR_MANIFEST.colors.bottom[appearance.colors.bottom];
  const shoes = AVATAR_MANIFEST.colors.shoes[appearance.colors.shoes];

  return (
    <ProceduralAvatarFallback
      palette={{
        jacket: top,
        shirt: "#f5f5f4",
        trousers: bottom,
        shoes,
        accent: top,
        hair,
        skin,
      }}
    />
  );
}

export function AvatarPreviewCanvas({
  appearance,
  unavailableLabel,
}: AvatarPreviewCanvasProps) {
  const resetKey = JSON.stringify(appearance);
  const fallback = <PreviewFallback appearance={appearance} />;

  return (
    <div
      className="h-full min-h-80 overflow-hidden rounded-2xl border border-border bg-secondary"
      role="img"
      aria-label={unavailableLabel}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.3, 3.35], fov: 35, near: 0.1, far: 20 }}
        fallback={
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {unavailableLabel}
          </div>
        }
      >
        <color attach="background" args={["#d9d6cf"]} />
        <ambientLight intensity={1.15} />
        <directionalLight
          position={[3, 5, 4]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-3, 2, 1]} intensity={0.65} />
        {AVATAR_MANIFEST.assetReady ? (
          <AvatarModelBoundary fallback={fallback} resetKey={resetKey}>
            <Suspense fallback={fallback}>
              <AvatarModel
                appearance={appearance}
                speed={0}
                playerSeed="avatar-preview"
                castShadow
              />
            </Suspense>
          </AvatarModelBoundary>
        ) : fallback}
        <mesh
          position={[0, -0.005, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <circleGeometry args={[1.25, 48]} />
          <meshStandardMaterial color="#c5c0b5" roughness={0.9} />
        </mesh>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          target={[0, 1, 0]}
          minDistance={2.25}
          maxDistance={4.2}
          minPolarAngle={Math.PI * 0.32}
          maxPolarAngle={Math.PI * 0.58}
        />
      </Canvas>
    </div>
  );
}
