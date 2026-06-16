import { motion } from 'motion/react';
import { useState, useEffect, useRef, useCallback } from 'react';

/*
 * CSS 3D Room — all faces placed from a single origin using correct transform math.
 *
 * Room dimensions:  W (width / X), H (height / Y), D (depth / Z)
 * Origin = exact centre of the room.
 *
 * Face formula (each div centred with margin then transformed):
 *   Back:    translateZ(-D/2)                     size W × H
 *   Left:    rotateY(-90deg) translateZ(W/2)      size D × H
 *   Right:   rotateY(90deg)  translateZ(W/2)      size D × H
 *   Floor:   rotateX(-90deg) translateZ(H/2)      size W × D
 *   Ceiling: rotateX(90deg)  translateZ(H/2)      size W × D
 */

const W = 260;
const H = 150;
const D = 200;

const paintingColors = [
  'from-rose-200 to-rose-300 dark:from-rose-400/40 dark:to-rose-500/40',
  'from-sky-200 to-sky-300 dark:from-sky-400/40 dark:to-sky-500/40',
  'from-amber-200 to-amber-300 dark:from-amber-400/40 dark:to-amber-500/40',
  'from-emerald-200 to-emerald-300 dark:from-emerald-400/40 dark:to-emerald-500/40',
  'from-violet-200 to-violet-300 dark:from-violet-400/40 dark:to-violet-500/40',
  'from-pink-200 to-pink-300 dark:from-pink-400/40 dark:to-pink-500/40',
  'from-teal-200 to-teal-300 dark:from-teal-400/40 dark:to-teal-500/40',
];

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

export function Gallery3D() {
  const [isHovering, setIsHovering] = useState(false);
  const isDecorativeMotionAllowed = useDecorativeMotionAllowed();
  const rotateRef = useRef({ x: 18, y: -30 });
  const sceneRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (isHovering || !isDecorativeMotionAllowed) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      rotateRef.current.y += dt * 0.004;
      if (sceneRef.current) {
        sceneRef.current.style.transform =
          `rotateX(${rotateRef.current.x}deg) rotateY(${rotateRef.current.y}deg)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isDecorativeMotionAllowed, isHovering]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    rotateRef.current.y = -30 + nx * 50;
    rotateRef.current.x = 18 - ny * 25;
    if (sceneRef.current) {
      sceneRef.current.style.transform =
        `rotateX(${rotateRef.current.x}deg) rotateY(${rotateRef.current.y}deg)`;
    }
  }, []);

  /* shared absolute-centred style for every room face */
  const face = (
    w: number, h: number, transform: string, extra?: React.CSSProperties,
  ): React.CSSProperties => ({
    position: 'absolute',
    width: w,
    height: h,
    left: '50%',
    top: '50%',
    marginLeft: -w / 2,
    marginTop: -h / 2,
    transform,
    backfaceVisibility: 'hidden',
    ...extra,
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className="relative w-full max-w-xl mx-auto select-none"
      style={{ perspective: 900 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        rotateRef.current.x = 18;
      }}
    >
      {/* Soft glow underneath */}
      <div className="absolute inset-x-12 bottom-2 h-14 bg-gradient-to-t from-stone-300/20 dark:from-stone-600/15 to-transparent blur-2xl rounded-full" />

      {/* 3D scene container */}
      <div
        ref={sceneRef}
        className="relative w-full h-64 sm:h-72 cursor-grab active:cursor-grabbing"
        style={{
          transformStyle: 'preserve-3d',
          transform: 'rotateX(18deg) rotateY(-30deg)',
          transition: isHovering ? 'transform 0.06s ease-out' : 'none',
        }}
      >
        {/* ─── Back Wall ─── */}
        <div
          className="bg-gradient-to-b from-white via-stone-50 to-stone-100 dark:from-stone-800 dark:via-stone-850 dark:to-stone-900 border border-stone-200/30 dark:border-stone-700/25"
          style={face(W, H, `translateZ(${-D / 2}px)`, {
            boxShadow: 'inset 0 0 50px rgba(0,0,0,0.03)',
          })}
        >
          {/* Paintings on back wall */}
          <div className="absolute inset-0 flex items-center justify-center gap-5 px-8">
            <div className={`w-11 h-16 rounded bg-gradient-to-br ${paintingColors[0]} shadow-md ring-1 ring-white/30 dark:ring-white/10`} />
            <div className={`w-14 h-10 rounded bg-gradient-to-br ${paintingColors[1]} shadow-md ring-1 ring-white/30 dark:ring-white/10`} />
            <div className={`w-11 h-16 rounded bg-gradient-to-br ${paintingColors[2]} shadow-md ring-1 ring-white/30 dark:ring-white/10`} />
          </div>
        </div>

        {/* ─── Left Wall ─── */}
        <div
          className="bg-gradient-to-r from-stone-100 via-stone-50 to-white dark:from-stone-900 dark:via-stone-850 dark:to-stone-800 border border-stone-200/25 dark:border-stone-700/20"
          style={face(D, H, `rotateY(-90deg) translateZ(${W / 2}px)`, {
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.04)',
          })}
        >
          <div className="absolute inset-0 flex items-center justify-center gap-4 px-6">
            <div className={`w-14 h-10 rounded bg-gradient-to-br ${paintingColors[3]} shadow-md ring-1 ring-white/30 dark:ring-white/10`} />
            <div className={`w-11 h-14 rounded bg-gradient-to-br ${paintingColors[4]} shadow-md ring-1 ring-white/30 dark:ring-white/10`} />
          </div>
        </div>

        {/* ─── Right Wall ─── */}
        <div
          className="bg-gradient-to-l from-stone-100 via-stone-50 to-white dark:from-stone-900 dark:via-stone-850 dark:to-stone-800 border border-stone-200/25 dark:border-stone-700/20"
          style={face(D, H, `rotateY(90deg) translateZ(${W / 2}px)`, {
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.04)',
          })}
        >
          <div className="absolute inset-0 flex items-center justify-center gap-4 px-6">
            <div className={`w-11 h-14 rounded bg-gradient-to-br ${paintingColors[5]} shadow-md ring-1 ring-white/30 dark:ring-white/10`} />
            <div className={`w-14 h-10 rounded bg-gradient-to-br ${paintingColors[6]} shadow-md ring-1 ring-white/30 dark:ring-white/10`} />
          </div>
        </div>

        {/* ─── Floor ─── */}
        <div
          className="bg-gradient-to-b from-stone-100 to-stone-200/90 dark:from-stone-800 dark:to-stone-900/90"
          style={face(W, D, `rotateX(-90deg) translateZ(${H / 2}px)`)}
        >
          {/* Subtle tile pattern */}
          <div
            className="absolute inset-0 opacity-[0.06] dark:opacity-[0.08]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(0,0,0,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.15) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Pedestals on the floor — positioned via absolute within the floor plane */}
          <div className="absolute" style={{ left: '30%', top: '40%', transform: 'translate(-50%, -50%)' }}>
            <div className="w-7 h-4 bg-gradient-to-t from-stone-300 to-stone-200 dark:from-stone-600 dark:to-stone-500 rounded-sm shadow-sm" />
            <div className={`w-4 h-4 bg-gradient-to-br ${paintingColors[0]} rounded-full mx-auto -mt-3 shadow-md`} />
          </div>
          <div className="absolute" style={{ left: '70%', top: '40%', transform: 'translate(-50%, -50%)' }}>
            <div className="w-7 h-4 bg-gradient-to-t from-stone-300 to-stone-200 dark:from-stone-600 dark:to-stone-500 rounded-sm shadow-sm" />
            <div className={`w-4 h-4 bg-gradient-to-br ${paintingColors[1]} rounded-full mx-auto -mt-3 shadow-md`} />
          </div>
        </div>

        {/* ─── Ceiling ─── */}
        <div
          className="bg-gradient-to-b from-white to-stone-50/80 dark:from-stone-800 dark:to-stone-800/80"
          style={face(W, D, `rotateX(90deg) translateZ(${H / 2}px)`)}
        >
          {/* Light strips */}
          <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-transparent via-amber-200/50 dark:via-amber-400/20 to-transparent rounded-full" />
          <div className="absolute inset-x-20 top-[40%] h-0.5 bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent rounded-full" />
        </div>
      </div>

      {/* Hint text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="text-center text-xs text-stone-400 dark:text-stone-600 mt-4"
      >
        移動滑鼠探索展廳
      </motion.p>
    </motion.div>
  );
}

/* ─── Mini version for auth page backgrounds ─── */
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
        {/* Back */}
        <div
          className="bg-white/30 dark:bg-white/8 border border-stone-200/15 dark:border-stone-700/12 backdrop-blur-sm rounded-sm"
          style={miniFace(mW, mH, `translateZ(${-mD / 2}px)`)}
        >
          <div className="flex items-center justify-center gap-2 h-full px-3">
            <div className="w-5 h-7 rounded-sm bg-rose-200/40 dark:bg-rose-400/20" />
            <div className="w-6 h-4 rounded-sm bg-sky-200/40 dark:bg-sky-400/20" />
            <div className="w-5 h-7 rounded-sm bg-amber-200/40 dark:bg-amber-400/20" />
          </div>
        </div>
        {/* Left */}
        <div
          className="bg-stone-100/25 dark:bg-stone-800/15 border border-stone-200/10 dark:border-stone-700/8 backdrop-blur-sm rounded-sm"
          style={miniFace(mD, mH, `rotateY(-90deg) translateZ(${mW / 2}px)`)}
        />
        {/* Right */}
        <div
          className="bg-stone-100/25 dark:bg-stone-800/15 border border-stone-200/10 dark:border-stone-700/8 backdrop-blur-sm rounded-sm"
          style={miniFace(mD, mH, `rotateY(90deg) translateZ(${mW / 2}px)`)}
        />
        {/* Floor */}
        <div
          className="bg-stone-200/15 dark:bg-stone-700/12 backdrop-blur-sm"
          style={miniFace(mW, mD, `rotateX(-90deg) translateZ(${mH / 2}px)`)}
        />
      </div>
    </div>
  );
}
