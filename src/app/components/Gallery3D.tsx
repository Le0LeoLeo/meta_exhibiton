import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useI18n } from './I18nProvider';
import { canCreateWebGLContext } from '../modules/metaverse3d/components/webglSupport';

const artworkPalettes = [
  ['#ff6b6b', '#ffd166', '#fef3c7'],
  ['#38bdf8', '#2dd4bf', '#ecfeff'],
  ['#a78bfa', '#60a5fa', '#f5f3ff'],
  ['#34d399', '#bef264', '#fef08a'],
  ['#fb7185', '#fdba74', '#fff7ed'],
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
      <mesh castShadow receiveShadow position={[0, 0, -0.015]}>
        <boxGeometry args={[0.82, 1.08, 0.07]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.45} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.66, 0.84]} />
        <meshStandardMaterial color={palette[0]} roughness={0.38} emissive={palette[1]} emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[-0.13, 0.12, 0.04]}>
        <circleGeometry args={[0.2, 28]} />
        <meshStandardMaterial color={palette[1]} roughness={0.35} emissive={palette[1]} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0.18, -0.18, 0.05]} rotation={[0, 0, 0.45]}>
        <planeGeometry args={[0.42, 0.18]} />
        <meshStandardMaterial color={palette[2]} roughness={0.5} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function Pedestal({ position, accent }: { position: [number, number, number]; accent: string }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.36, 0.43, 0.7, 32]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.5} metalness={0.08} />
      </mesh>
      <mesh castShadow position={[0, 0.88, 0]}>
        <icosahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial color={accent} roughness={0.25} metalness={0.25} emissive={accent} emissiveIntensity={0.12} />
      </mesh>
    </group>
  );
}

function LightStrip({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[1.45, 0.035, 0.035]} />
        <meshStandardMaterial color="#fff7cc" emissive="#facc15" emissiveIntensity={1.9} toneMapped={false} />
      </mesh>
      <pointLight color="#ffe6a3" intensity={0.52} distance={3.3} />
    </group>
  );
}

function GalleryScene() {
  return (
    <>
      <color attach="background" args={['#f8fbff']} />
      <fog attach="fog" args={['#f8fbff', 8.5, 14]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#e0f2fe', '#fef3c7', 0.8]} />
      <directionalLight position={[3.8, 6, 4.2]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
      <spotLight position={[-3.2, 4.4, 2.7]} angle={0.42} penumbra={0.55} intensity={1.2} color="#fff2cc" castShadow />
      <pointLight position={[2.6, 1.8, -2.2]} intensity={0.8} color="#67e8f9" distance={5} />

      <group>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[6.4, 5.4]} />
          <meshStandardMaterial color="#e8edf3" roughness={0.62} metalness={0.05} />
        </mesh>

        <gridHelper args={[6.4, 16, '#9fb2c8', '#d6dee8']} position={[0, 0.012, 0]} />

        <mesh receiveShadow position={[0, 1.45, -2.6]}>
          <boxGeometry args={[6.4, 2.9, 0.12]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.58} metalness={0.02} />
        </mesh>
        <mesh receiveShadow position={[-3.2, 1.45, -1.15]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[2.9, 2.9, 0.12]} />
          <meshStandardMaterial color="#eef8f4" roughness={0.58} metalness={0.02} transparent opacity={0.86} />
        </mesh>
        <mesh receiveShadow position={[3.2, 1.45, -1.15]} rotation={[0, -Math.PI / 2, 0]}>
          <boxGeometry args={[2.9, 2.9, 0.12]} />
          <meshStandardMaterial color="#fff3ee" roughness={0.58} metalness={0.02} transparent opacity={0.78} />
        </mesh>

        <LightStrip position={[-1.65, 2.86, -0.85]} rotation={[0, 0, 0.04]} />
        <LightStrip position={[1.65, 2.86, -1.05]} rotation={[0, 0, -0.04]} />
        <LightStrip position={[0, 2.78, 1.15]} rotation={[0, 0, 0]} />

        <Artwork palette={artworkPalettes[0]} position={[-1.9, 1.75, -2.51]} scale={[1.04, 1.04, 1.04]} />
        <Artwork palette={artworkPalettes[1]} position={[0, 1.65, -2.5]} rotation={[0, 0, 0.03]} scale={[0.9, 0.9, 0.9]} />
        <Artwork palette={artworkPalettes[2]} position={[1.9, 1.75, -2.51]} scale={[1.04, 1.04, 1.04]} />
        <Artwork palette={artworkPalettes[3]} position={[-3.11, 1.58, -1.35]} rotation={[0, Math.PI / 2, 0]} scale={[0.82, 0.82, 0.82]} />
        <Artwork palette={artworkPalettes[4]} position={[3.11, 1.58, -1.15]} rotation={[0, -Math.PI / 2, 0]} scale={[0.82, 0.82, 0.82]} />

        <Pedestal position={[-1.25, 0, 0.35]} accent="#38bdf8" />
        <Pedestal position={[1.25, 0, 0.25]} accent="#fb7185" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 1.15]}>
          <ringGeometry args={[0.82, 0.87, 72]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.65} transparent opacity={0.78} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 1.15]}>
          <planeGeometry args={[0.12, 2.7]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.72} transparent opacity={0.62} toneMapped={false} />
        </mesh>
      </group>

      <ContactShadows position={[0, 0.02, 0]} opacity={0.25} scale={7} blur={2.7} far={4} />
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
        shadows
        dpr={[1, 1.6]}
        orthographic
        camera={{ position: [3.6, 3.05, 5.2], zoom: 72, near: 0.1, far: 40 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <GalleryScene />
        <OrbitControls
          makeDefault
          autoRotate={false}
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 4.2}
          maxPolarAngle={Math.PI / 2.08}
          target={[0, 1.15, -1.35]}
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
