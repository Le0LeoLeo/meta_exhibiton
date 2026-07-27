import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useI18n } from './I18nProvider';
import { canCreateWebGLContext } from '../modules/metaverse3d/components/webglSupport';

const artworkPalettes = [
  ['#9f4d3f', '#d9a441', '#efe4cf'],
  ['#315c6d', '#79a89c', '#e4ddd0'],
  ['#746058', '#c97b5a', '#d9c8a4'],
  ['#3e6257', '#c5a46d', '#e8dfcf'],
] as const;

function canRunDecorativeMotion() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return false;
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useDecorativeMotionAllowed() {
  const [isAllowed, setIsAllowed] = useState(canRunDecorativeMotion);

  useEffect(() => {
    const update = () => setIsAllowed(canRunDecorativeMotion());
    const media =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    document.addEventListener('visibilitychange', update);
    media?.addEventListener('change', update);
    update();

    return () => {
      document.removeEventListener('visibilitychange', update);
      media?.removeEventListener('change', update);
    };
  }, []);

  return isAllowed;
}

type ArtworkProps = {
  palette: readonly [string, string, string];
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

function Artwork({ palette, position, rotation = [0, 0, 0], scale = [1, 1, 1] }: ArtworkProps) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh castShadow position={[0, 0, -0.055]}>
        <boxGeometry args={[1.08, 1.42, 0.1]} />
        <meshStandardMaterial color="#3b332d" roughness={0.34} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[0.94, 1.28]} />
        <meshStandardMaterial color="#eee9df" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[0.78, 1.1]} />
        <meshStandardMaterial color={palette[2]} roughness={0.78} />
      </mesh>
      <mesh position={[-0.13, 0.16, 0.024]} rotation={[0, 0, -0.18]}>
        <circleGeometry args={[0.27, 48]} />
        <meshStandardMaterial color={palette[0]} roughness={0.7} />
      </mesh>
      <mesh position={[0.15, -0.12, 0.027]} rotation={[0, 0, 0.46]}>
        <planeGeometry args={[0.57, 0.19]} />
        <meshStandardMaterial color={palette[1]} roughness={0.64} />
      </mesh>
      <mesh position={[0, -0.86, 0.01]}>
        <boxGeometry args={[0.34, 0.07, 0.025]} />
        <meshStandardMaterial color="#d8d1c5" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Pedestal({ position, children }: { position: [number, number, number]; children: React.ReactNode }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[0.78, 0.9, 0.78]} />
        <meshStandardMaterial color="#d8d1c4" roughness={0.82} metalness={0.02} />
      </mesh>
      {children}
    </group>
  );
}

function TrackLight({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.25, 24]} />
        <meshStandardMaterial color="#282521" roughness={0.28} metalness={0.72} />
      </mesh>
      <mesh position={[0, -0.135, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.064, 24]} />
        <meshBasicMaterial color="#fff2cc" toneMapped={false} />
      </mesh>
    </group>
  );
}

function GalleryScene() {
  return (
    <>
      <color attach="background" args={['#e8e4dc']} />
      <fog attach="fog" args={['#e8e4dc', 10, 18]} />
      <ambientLight intensity={0.26} color="#fff7ea" />
      <hemisphereLight args={['#f7f4ed', '#7d7368', 0.78]} />
      <directionalLight
        position={[4.5, 7, 5.2]}
        intensity={1.75}
        color="#fff4df"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-normalBias={0.025}
      />
      <spotLight position={[-2.25, 3.45, 0.7]} intensity={22} distance={7} angle={0.3} penumbra={0.72} decay={2} color="#ffe7bd" />
      <spotLight position={[0, 3.45, 0.65]} intensity={26} distance={7} angle={0.28} penumbra={0.75} decay={2} color="#fff0d3" />
      <spotLight position={[2.25, 3.45, 0.7]} intensity={22} distance={7} angle={0.3} penumbra={0.72} decay={2} color="#ffe7bd" />

      <group>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[8, 7.2]} />
          <meshStandardMaterial color="#d5cfc4" roughness={0.72} metalness={0.04} />
        </mesh>

        <mesh receiveShadow position={[0, 1.8, -3.55]}>
          <boxGeometry args={[8, 3.6, 0.18]} />
          <meshStandardMaterial color="#f1eee7" roughness={0.84} metalness={0.01} />
        </mesh>
        <mesh receiveShadow position={[-4, 1.8, -1.1]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[5.1, 3.6, 0.18]} />
          <meshStandardMaterial color="#e9e5dc" roughness={0.86} />
        </mesh>
        <mesh receiveShadow position={[4, 1.8, -1.1]} rotation={[0, -Math.PI / 2, 0]}>
          <boxGeometry args={[5.1, 3.6, 0.18]} />
          <meshStandardMaterial color="#e9e5dc" roughness={0.86} />
        </mesh>

        <mesh receiveShadow position={[-2.8, 1.67, -3.42]}>
          <boxGeometry args={[1.65, 3.12, 0.12]} />
          <meshStandardMaterial color="#b8afa1" roughness={0.9} />
        </mesh>
        <mesh receiveShadow position={[3.1, 1.25, -3.39]}>
          <boxGeometry args={[1.28, 2.5, 0.14]} />
          <meshStandardMaterial color="#8c6654" roughness={0.82} />
        </mesh>

        <mesh castShadow position={[0, 3.54, -0.55]}>
          <boxGeometry args={[7.55, 0.12, 0.12]} />
          <meshStandardMaterial color="#2e2b27" roughness={0.32} metalness={0.62} />
        </mesh>
        <TrackLight position={[-2.25, 3.37, 0.55]} rotation={[0.15, 0, 0.22]} />
        <TrackLight position={[0, 3.37, 0.55]} rotation={[0.15, 0, 0]} />
        <TrackLight position={[2.25, 3.37, 0.55]} rotation={[0.15, 0, -0.22]} />

        <mesh position={[-1.9, 3.47, -1.95]}>
          <boxGeometry args={[2.3, 0.07, 0.7]} />
          <meshStandardMaterial color="#faf7ef" emissive="#fff2d7" emissiveIntensity={0.65} roughness={0.75} />
        </mesh>
        <mesh position={[1.25, 3.47, -1.95]}>
          <boxGeometry args={[2.8, 0.07, 0.7]} />
          <meshStandardMaterial color="#faf7ef" emissive="#fff2d7" emissiveIntensity={0.65} roughness={0.75} />
        </mesh>

        <Artwork palette={artworkPalettes[0]} position={[-2.8, 1.78, -3.24]} scale={[0.82, 0.82, 0.82]} />
        <Artwork palette={artworkPalettes[1]} position={[-0.75, 1.84, -3.34]} scale={[0.98, 0.98, 0.98]} />
        <Artwork palette={artworkPalettes[2]} position={[1.15, 1.84, -3.34]} scale={[0.98, 0.98, 0.98]} />
        <Artwork palette={artworkPalettes[3]} position={[-3.8, 1.76, -0.65]} rotation={[0, Math.PI / 2, 0]} scale={[0.86, 0.86, 0.86]} />

        <Pedestal position={[-1.35, 0, -0.45]}>
          <mesh castShadow position={[0, 1.2, 0]} rotation={[0.18, 0.2, -0.12]}>
            <torusKnotGeometry args={[0.34, 0.095, 96, 12, 2, 3]} />
            <meshStandardMaterial color="#403c36" roughness={0.2} metalness={0.82} />
          </mesh>
        </Pedestal>
        <Pedestal position={[1.4, 0, -0.75]}>
          <group position={[0, 1.18, 0]} rotation={[0.08, 0.35, -0.08]}>
            <mesh castShadow>
              <icosahedronGeometry args={[0.38, 2]} />
              <meshStandardMaterial color="#9c604b" roughness={0.46} metalness={0.08} />
            </mesh>
            <mesh castShadow position={[0.22, 0.22, 0.12]}>
              <sphereGeometry args={[0.15, 28, 20]} />
              <meshStandardMaterial color="#d7b77d" roughness={0.38} metalness={0.12} />
            </mesh>
          </group>
        </Pedestal>

        <group position={[0.25, 0, 2.12]}>
          <mesh castShadow receiveShadow position={[0, 0.29, 0]}>
            <boxGeometry args={[2.15, 0.18, 0.68]} />
            <meshStandardMaterial color="#5a4638" roughness={0.58} metalness={0.04} />
          </mesh>
          <mesh castShadow position={[-0.82, 0.14, 0]}>
            <boxGeometry args={[0.11, 0.28, 0.5]} />
            <meshStandardMaterial color="#2f2b27" roughness={0.35} metalness={0.55} />
          </mesh>
          <mesh castShadow position={[0.82, 0.14, 0]}>
            <boxGeometry args={[0.11, 0.28, 0.5]} />
            <meshStandardMaterial color="#2f2b27" roughness={0.35} metalness={0.55} />
          </mesh>
        </group>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.2]}>
          <planeGeometry args={[1.5, 4.8]} />
          <meshStandardMaterial color="#c2b6a7" roughness={0.88} />
        </mesh>
        <mesh position={[3.78, 1.5, -2.65]} rotation={[0, -Math.PI / 2, 0]}>
          <boxGeometry args={[1.25, 2.65, 0.08]} />
          <meshStandardMaterial color="#413d38" roughness={0.42} metalness={0.18} />
        </mesh>
      </group>

      <ContactShadows position={[0, 0.018, 0]} opacity={0.38} scale={8} blur={2.4} far={4.5} color="#4f463d" />
    </>
  );
}

export function Gallery3D() {
  const { t } = useI18n();
  const [webglSupported] = useState(() =>
    canCreateWebGLContext(
      document,
      () =>
        new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }),
    ),
  );

  if (!webglSupported) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.25 }}
        className="relative mx-auto flex h-72 w-full max-w-xl items-center justify-center overflow-hidden rounded-md bg-[linear-gradient(135deg,#f8fbff_0%,#eef4f8_100%)] sm:h-80"
        data-testid="gallery3d-webgl-fallback"
      >
        <MiniGallery3D className="scale-150" />
        <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-center justify-between rounded-md border border-white/70 bg-white/72 px-3 py-2 text-[11px] font-semibold text-stone-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-stone-950/58 dark:text-stone-300">
          <span>{t('gallery3d.previewLabel')}</span>
          <span className="text-[#10b981]">{t('gallery3d.dragHint')}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.25 }}
      className="relative mx-auto h-72 w-full max-w-xl overflow-hidden rounded-md sm:h-80"
    >
      <Canvas
        shadows={THREE.PCFShadowMap}
        dpr={[1, 1.6]}
        camera={{ position: [5.65, 3.75, 7.4], fov: 34, near: 0.1, far: 40 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <GalleryScene />
        <OrbitControls
          makeDefault
          autoRotate={false}
          enablePan={false}
          enableZoom={false}
          rotateSpeed={0.45}
          minPolarAngle={Math.PI / 3.35}
          maxPolarAngle={Math.PI / 2.18}
          minAzimuthAngle={Math.PI / 18}
          maxAzimuthAngle={Math.PI / 4.5}
          target={[0, 1.35, -0.75]}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-center justify-between rounded-md border border-white/70 bg-white/72 px-3 py-2 text-[11px] font-semibold text-stone-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-stone-950/58 dark:text-stone-300">
        <span>{t('gallery3d.previewLabel')}</span>
        <span className="text-[#10b981]">{t('gallery3d.dragHint')}</span>
      </div>
    </motion.div>
  );
}

export function MiniGallery3D({ className = '' }: { className?: string }) {
  const isDecorativeMotionAllowed = useDecorativeMotionAllowed();
  const sceneRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isDecorativeMotionAllowed) return;
    let angle = 0;
    const tick = () => {
      angle += 0.06;
      if (sceneRef.current) {
        sceneRef.current.style.transform = `rotateX(20deg) rotateY(${angle}deg)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isDecorativeMotionAllowed]);

  const mW = 140, mH = 90, mD = 110;

  const miniFace = (w: number, h: number, transform: string): React.CSSProperties => ({
    position: 'absolute',
    width: w,
    height: h,
    left: '50%',
    top: '50%',
    marginLeft: -w / 2,
    marginTop: -h / 2,
    transform,
    backfaceVisibility: 'hidden',
  });

  return (
    <div className={`pointer-events-none ${className}`} style={{ perspective: 500 }}>
      <div
        ref={sceneRef}
        style={{
          width: mW + 40,
          height: mH + 40,
          transformStyle: 'preserve-3d',
          transform: 'rotateX(20deg) rotateY(0deg)',
          position: 'relative',
        }}
      >
        <div
          className="rounded-sm border border-stone-200/15 bg-white/30 backdrop-blur-sm dark:border-stone-700/12 dark:bg-white/8"
          style={miniFace(mW, mH, `translateZ(${-mD / 2}px)`)}
        >
          <div className="flex h-full items-center justify-center gap-2 px-3">
            <div className="h-7 w-5 rounded-sm bg-rose-200/40 dark:bg-rose-400/20" />
            <div className="h-4 w-6 rounded-sm bg-sky-200/40 dark:bg-sky-400/20" />
            <div className="h-7 w-5 rounded-sm bg-amber-200/40 dark:bg-amber-400/20" />
          </div>
        </div>
        <div
          className="rounded-sm border border-stone-200/10 bg-stone-100/25 backdrop-blur-sm dark:border-stone-700/8 dark:bg-stone-800/15"
          style={miniFace(mD, mH, `rotateY(-90deg) translateZ(${mW / 2}px)`)}
        />
        <div
          className="rounded-sm border border-stone-200/10 bg-stone-100/25 backdrop-blur-sm dark:border-stone-700/8 dark:bg-stone-800/15"
          style={miniFace(mD, mH, `rotateY(90deg) translateZ(${mW / 2}px)`)}
        />
        <div
          className="bg-stone-200/15 backdrop-blur-sm dark:bg-stone-700/12"
          style={miniFace(mW, mD, `rotateX(-90deg) translateZ(${mH / 2}px)`)}
        />
      </div>
    </div>
  );
}
