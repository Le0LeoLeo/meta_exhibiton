import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { PCFShadowMap } from "three";
import { Room } from "./Room";
import { ExhibitItem } from "./ExhibitItem";
import { Player } from "./Player";
import { useStore } from "../store/useStore";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { FloorPlanScene } from "./FloorPlanScene";
import { RemotePlayers } from "./Multiplayer/RemotePlayers";

export function CanvasContainer() {
  const mode = useStore((state) => state.mode);
  const roomSize = useStore((state) => state.roomSize);
  const items = useStore((state) => state.items);
  const setSelectedItemId = useStore((state) => state.setSelectedItemId);
  const setSelectedWallFace = useStore((state) => state.setSelectedWallFace);
  const setSelectedWallAnchor = useStore((state) => state.setSelectedWallAnchor);
  const setSelectedFloorPlanElementId = useStore(
    (state) => state.setSelectedFloorPlanElementId,
  );
  const floorPlanIsTransforming = useStore(
    (state) => state.floorPlanIsTransforming,
  );
  const selectedFloorPlanElementId = useStore(
    (state) => state.selectedFloorPlanElementId,
  );
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);

  const isFloorPlan = mode === "floor-plan";

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;

      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTyping =
        tagName === "input" || tagName === "textarea" || target?.isContentEditable;

      if (isTyping) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    };

    window.addEventListener("keydown", onGlobalKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onGlobalKeyDown, { capture: true });
  }, [undo, redo]);

  useEffect(() => {
    if (mode === "edit" && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [mode]);

  return (
    <div id="view-canvas-container" className="w-full h-full absolute inset-0">
      <Canvas
        key={isFloorPlan ? "floor-plan-canvas" : `main-3d-canvas-${mode}`}
        shadows={!isFloorPlan && mode === "view"}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.physicallyCorrectLights = true;
          gl.shadowMap.type = PCFShadowMap;
        }}
        orthographic={isFloorPlan}
        camera={
          isFloorPlan
            ? { position: [0, 40, 0], zoom: 28, near: 0.1, far: 500 }
            : { position: [0, 5, 10], fov: 55 }
        }
        onPointerMissed={() => {
          if (mode === "edit") {
            setSelectedItemId(null);
            setSelectedWallFace(null);
            setSelectedWallAnchor(null);
          }
          if (mode === "floor-plan") {
            setSelectedFloorPlanElementId(null);
          }
        }}
      >
        <Suspense fallback={null}>
          {!isFloorPlan && (
            <Environment
              preset="warehouse"
              background={false}
              blur={0.15}
            />
          )}
          <ambientLight
            intensity={isFloorPlan ? 0.42 : 0.045 * (roomSize.environmentBrightness ?? 1)}
            color={isFloorPlan ? "#ffffff" : "#9db4ff"}
          />
          {!isFloorPlan && (
            <hemisphereLight
              skyColor="#bcd3ff"
              groundColor="#0b1020"
              intensity={0.055 * (roomSize.environmentBrightness ?? 1)}
            />
          )}
          {!isFloorPlan && (
            <spotLight
              castShadow
              position={[0, 6, 0]}
              angle={0.45}
              penumbra={0.55}
              intensity={0.72 * (roomSize.environmentBrightness ?? 1)}
              distance={36}
              color="#7dd3fc"
              shadow-mapSize={[1024, 1024]}
              shadow-bias={-0.00012}
            />
          )}
          {!isFloorPlan && (
            <pointLight
              position={[0, 2.2, -9.4]}
              intensity={0.07 * (roomSize.environmentBrightness ?? 1)}
              distance={6.6}
              decay={2}
              color="#93c5fd"
            />
          )}
          <directionalLight
            castShadow={!isFloorPlan && mode === "view"}
            position={[8, 12, 6]}
            intensity={isFloorPlan ? 0.58 : 0.52 * (roomSize.environmentBrightness ?? 1)}
            color={isFloorPlan ? "#ffffff" : "#ffffff"}
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.00015}
          />
          {!isFloorPlan && (
            <ContactShadows
              position={[0, 0.01, 0]}
              opacity={0.35}
              scale={70}
              blur={1.8}
              far={32}
              resolution={512}
              color="#000000"
            />
          )}

          {isFloorPlan ? (
            <>
              <FloorPlanScene />
              <OrbitControls
                makeDefault
                enabled={!floorPlanIsTransforming && !selectedFloorPlanElementId}
                target={[0, 0, 0]}
                enableRotate={false}
                enablePan={!floorPlanIsTransforming && !selectedFloorPlanElementId}
                enableZoom={!floorPlanIsTransforming && !selectedFloorPlanElementId}
                minPolarAngle={0}
                maxPolarAngle={0}
              />
            </>
          ) : (
            <>
              <Physics updateLoop="independent">
                <Room />

                {items.map((item) => (
                  <ExhibitItem key={item.id} item={item} />
                ))}

                <RemotePlayers />
                <Player />
              </Physics>

              {mode === "edit" && <OrbitControls makeDefault />}

              {mode === "view" && (
                <EffectComposer multisampling={0}>
                  <Bloom
                    intensity={0.1}
                    luminanceThreshold={0.95}
                    luminanceSmoothing={0.15}
                    mipmapBlur
                  />
                  <Vignette eskil={false} offset={0.2} darkness={0.32} />
                </EffectComposer>
              )}
            </>
          )}
        </Suspense>
      </Canvas>

      {mode === "view" && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
          <div className="w-1.5 h-1.5 bg-white rounded-full opacity-70 mix-blend-difference" />
        </div>
      )}
    </div>
  );
}
