import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { Room } from '@/app/modules/metaverse3d/components/Room';
import { ExhibitItem } from '../exhibits';
import type { SceneSnapshot } from '@/app/modules/metaverse3d/store/metaverseStoreTypes';
import { constrainPreviewCamera, getPreviewRoomBounds } from './previewCameraBounds';
import { GalleryLighting } from '@/app/modules/metaverse3d/components/GalleryLighting';
import { GalleryArtworkLighting } from '@/app/modules/metaverse3d/components/GalleryArtworkLighting';
import { GalleryAtmosphereContext } from '@/app/modules/metaverse3d/components/GalleryAtmosphereContext';
import { getGalleryAtmosphere } from '@/app/modules/metaverse3d/galleryAtmosphere';
import { createRenderPerformanceProfile } from '@/app/modules/metaverse3d/performanceProfile';

const previewLightingProfile = createRenderPerformanceProfile('balanced', 'balanced');

class PreviewBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function PreviewCamera({ scene, focusedIndex }: { scene: SceneSnapshot; focusedIndex: number }) {
  const controls = useRef<OrbitControlsType>(null);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const roomBounds = useMemo(() => getPreviewRoomBounds(scene), [scene]);
  // Drei updates OrbitControls at -1. Bound the final pose before the frame is drawn.
  useFrame(() => {
    if (controls.current) constrainPreviewCamera(camera, controls.current.target, roomBounds);
  }, -0.5);
  useEffect(() => {
    if (focusedIndex === -1 && controls.current) {
      const vehicleDisplay = scene.items.some((item) => item.content === '/templates/concept-car.glb');
      const compactDisplay = scene.roomSize.width <= 20;
      camera.position.set(-scene.roomSize.width * 0.04, 2.6, scene.roomSize.length * (vehicleDisplay ? 0.4 : compactDisplay ? 0.38 : 0.2));
      controls.current.target.set(0, 2.0, -scene.roomSize.length * 0.34);
      controls.current.update();
      constrainPreviewCamera(camera, controls.current.target, roomBounds);
      invalidate();
      return;
    }
    const artworks = scene.items.filter((item) => item.type === 'painting');
    const item = artworks[focusedIndex] ?? artworks[0];
    if (!item || !controls.current) return;
    const [x, y, z] = item.position;
    const angle = item.rotation[1];
    const distance = Math.max(3, (item.frameWidth ?? 2.4) * 1.8);
    camera.position.set(x + Math.sin(angle) * distance, y + 0.2, z + Math.cos(angle) * distance);
    controls.current.target.set(x, y, z);
    controls.current.update();
    constrainPreviewCamera(camera, controls.current.target, roomBounds);
    invalidate();
  }, [camera, focusedIndex, invalidate, roomBounds, scene]);
  return <OrbitControls ref={controls} makeDefault enableDamping minDistance={1} maxDistance={Math.max(scene.roomSize.width, scene.roomSize.length)} maxPolarAngle={Math.PI * 0.8} />;
}

/** Read-only canvas: scene passed as props, no studio imports, autosave or multiplayer session. */
export function GalleryScenePreview({ scene, focusedIndex, fallback }: { scene: SceneSnapshot; focusedIndex: number; fallback: ReactNode }) {
  const brightness = scene.roomSize.environmentBrightness ?? 1;
  const atmosphere = getGalleryAtmosphere(scene.roomSize.wallTextureUrl);
  return (
    <PreviewBoundary fallback={fallback}>
      <Canvas shadows="percentage" frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 1.7, 3], fov: 52, near: 0.08, far: 180 }} gl={{ antialias: true, powerPreference: 'default' }}>
        <color attach="background" args={['#f4f1eb']} />
        <GalleryAtmosphereContext.Provider value={atmosphere}>
        <GalleryLighting profile={previewLightingProfile} environmentBrightness={brightness} atmosphere={atmosphere} />
        <GalleryArtworkLighting items={scene.items} mode="balanced" environmentBrightness={brightness} atmosphere={atmosphere} />
        <Suspense fallback={null}>
          <Environment preset="warehouse" environmentIntensity={0.45 * Math.max(0.2, brightness)} />
        </Suspense>
        <Suspense fallback={null}>
          <Room sceneOverride={scene} />
          {scene.items.map((item) => <ExhibitItem key={item.id} item={item} sceneOverride={scene} readOnly />)}
        </Suspense>
        <PreviewCamera scene={scene} focusedIndex={focusedIndex} />
        </GalleryAtmosphereContext.Provider>
      </Canvas>
    </PreviewBoundary>
  );
}
