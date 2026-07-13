import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import { ChevronRight, Move3d, Sparkles } from 'lucide-react';
import type { GrowthAsset } from '../api/client';
import { useI18n } from './I18nProvider';

type FrameProps = {
  asset: GrowthAsset;
  position: [number, number, number];
  index: number;
  onSelectAsset?: (asset: GrowthAsset) => void;
};

function Frame({ asset, position, index, onSelectAsset }: FrameProps) {
  const hasUrl = Boolean(asset.contentUrl);
  const texture = useTexture(hasUrl ? (asset.contentUrl as string) : '');

  return (
    <mesh position={position} onClick={() => onSelectAsset?.(asset)}>
      <planeGeometry args={[1.2, 0.9]} />
      <meshStandardMaterial
        map={hasUrl ? texture : undefined}
        color={hasUrl ? '#ffffff' : `hsl(${index * 45}, 35%, 70%)`}
        roughness={0.95}
        metalness={0.02}
      />
    </mesh>
  );
}

function WalkControls({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  const keysRef = useRef({ w: false, a: false, s: false, d: false });

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) keysRef.current[key as 'w' | 'a' | 's' | 'd'] = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keysRef.current) keysRef.current[key as 'w' | 'a' | 's' | 'd'] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const speed = 2 * delta;
    if (keysRef.current.w) camera.position.z -= speed;
    if (keysRef.current.s) camera.position.z += speed;
    if (keysRef.current.a) camera.position.x -= speed;
    if (keysRef.current.d) camera.position.x += speed;

    camera.position.x = Math.max(-4, Math.min(4, camera.position.x));
    camera.position.z = Math.max(-0.5, Math.min(5, camera.position.z));
    camera.position.y = 1.5;
  });

  return null;
}

type GrowthGalleryPreviewProps = {
  assets: GrowthAsset[];
  immersive?: boolean;
  onSelectAsset?: (asset: GrowthAsset) => void;
};

function getDocumentVisibility() {
  return typeof document === 'undefined' ? 'visible' : document.visibilityState;
}

function useDocumentVisibility() {
  const [visibility, setVisibility] = useState(getDocumentVisibility);

  useEffect(() => {
    const handleVisibilityChange = () => setVisibility(getDocumentVisibility());

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return visibility;
}

function getIsCoarsePointer() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches;
}

function useCoarsePointer() {
  const [isCoarsePointer, setIsCoarsePointer] = useState(getIsCoarsePointer);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const media = window.matchMedia('(pointer: coarse)');
    const handleChange = () => setIsCoarsePointer(media.matches);
    media.addEventListener('change', handleChange);
    handleChange();

    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, []);

  return isCoarsePointer;
}

export function GrowthGalleryPreview({ assets, immersive = false, onSelectAsset }: GrowthGalleryPreviewProps) {
  const { t } = useI18n();
  const [walkMode, setWalkMode] = useState(immersive);
  const visibility = useDocumentVisibility();
  const isCoarsePointer = useCoarsePointer();

  useEffect(() => {
    setWalkMode(immersive);
  }, [immersive]);

  const frames = useMemo(() => {
    const imageAssets = assets.filter((asset) => asset.type === 'photo' && asset.contentUrl);
    return imageAssets.length > 0 ? imageAssets : assets.slice(0, 6);
  }, [assets]);

  const shellClass = immersive
    ? 'h-full min-h-[520px]'
    : 'min-h-[380px]';

  return (
    <div className={`group relative w-full overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.5)] ${shellClass}`}>
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-xl sm:px-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-900">{t('ggp.title')}</p>
            <p className="text-xs text-slate-500">{t('ggp.subtitle')}</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 sm:flex">
          <Move3d className="size-3.5" />
          <span>{walkMode ? t('ggp.wasd') : t('ggp.mouseRotate')}</span>
        </div>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_24%),radial-gradient(circle_at_75%_15%,rgba(99,102,241,0.08),transparent_18%)]" />

      <div className="relative h-full min-h-[inherit] pt-[72px]">
        <Canvas
          camera={{ position: [0, 1.5, 4], fov: 50 }}
          dpr={isCoarsePointer ? [0.75, 1] : [1, 1.25]}
          frameloop={visibility === 'hidden' ? 'demand' : 'always'}
        >
          <color attach="background" args={['#f8fafc']} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 5, 2]} intensity={1.25} color="#ffffff" />
          <directionalLight position={[-4, 3, 4]} intensity={0.35} color="#93c5fd" />

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
            <planeGeometry args={[12, 6]} />
            <meshStandardMaterial color="#eef2f7" />
          </mesh>

          <mesh position={[0, 1.22, -1.6]}>
            <boxGeometry args={[6, 3, 0.1]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>

          <mesh position={[-3.1, 1.2, -1.55]}>
            <boxGeometry args={[0.05, 2.8, 0.05]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
          <mesh position={[3.1, 1.2, -1.55]}>
            <boxGeometry args={[0.05, 2.8, 0.05]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>

          <Suspense fallback={null}>
            {frames.length > 0 ? (
              frames.map((asset, index) => (
                <Frame
                  key={asset.id}
                  asset={asset}
                  index={index}
                  onSelectAsset={onSelectAsset}
                  position={[-2.2 + index * 1.1, 1.2, -1.54]}
                />
              ))
            ) : (
              <mesh position={[0, 1.18, -1.54]} onClick={() => undefined}>
                <planeGeometry args={[2.8, 1.6]} />
                <meshStandardMaterial color="#f8fafc" />
              </mesh>
            )}
          </Suspense>

          <WalkControls enabled={walkMode} />
          <OrbitControls enablePan={false} minDistance={2.5} maxDistance={6} enabled={!walkMode} />
        </Canvas>

        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-end justify-between gap-4">
          <div className="pointer-events-auto max-w-sm rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-xs text-slate-600 shadow-lg backdrop-blur-xl">
            {frames.length > 0 ? t('ggp.clickHint') : t('ggp.emptyHint')}
          </div>
          <button
            type="button"
            onClick={() => setWalkMode((v) => !v)}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {t(walkMode ? 'ggp.mouseRotate' : 'ggp.wasd')}
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
