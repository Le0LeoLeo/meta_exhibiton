import { motion } from 'motion/react';

const cubeColors = [
  'from-stone-200/30 to-transparent border-stone-300/40 dark:from-stone-500/15 dark:border-stone-500/20',
  'from-stone-200/25 to-transparent border-stone-300/40 dark:from-stone-500/12 dark:border-stone-500/18',
  'from-stone-200/20 to-transparent border-stone-300/40 dark:from-stone-500/10 dark:border-stone-500/16',
  'from-stone-200/18 to-transparent border-stone-300/40 dark:from-stone-500/8 dark:border-stone-500/14',
  'from-stone-200/22 to-transparent border-stone-300/40 dark:from-stone-500/12 dark:border-stone-500/18',
  'from-stone-200/16 to-transparent border-stone-300/40 dark:from-stone-500/8 dark:border-stone-500/14',
];

export function FloatingCube({ className = '', size = 60, delay = 0 }: { className?: string; size?: number; delay?: number }) {
  return (
    <motion.div
      className={`absolute pointer-events-none ${className}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, delay }}
      style={{ perspective: 400 }}
    >
      <motion.div
        animate={{ rotateX: [0, 360], rotateY: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        style={{ width: size, height: size, transformStyle: 'preserve-3d', position: 'relative' }}
      >
        {[
          { transform: `translateZ(${size / 2}px)` },
          { transform: `rotateY(180deg) translateZ(${size / 2}px)` },
          { transform: `rotateY(90deg) translateZ(${size / 2}px)` },
          { transform: `rotateY(-90deg) translateZ(${size / 2}px)` },
          { transform: `rotateX(90deg) translateZ(${size / 2}px)` },
          { transform: `rotateX(-90deg) translateZ(${size / 2}px)` },
        ].map((face, i) => (
          <div
            key={i}
            className={`absolute inset-0 bg-gradient-to-br backdrop-blur-sm rounded-sm border ${cubeColors[i]}`}
            style={{ ...face, backfaceVisibility: 'hidden' }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

export function FloatingRing({ className = '', size = 80, delay = 0, color = 'border-stone-300/40 dark:border-stone-600/30' }: { className?: string; size?: number; delay?: number; color?: string }) {
  return (
    <motion.div
      className={`absolute pointer-events-none ${className}`}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, delay }}
      style={{ perspective: 600 }}
    >
      <motion.div
        animate={{ rotateX: [30, 60, 30], rotateY: [0, 360] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        className={`rounded-full border-2 ${color}`}
        style={{ width: size, height: size }}
      />
    </motion.div>
  );
}

export function FloatingDot({ className = '', delay = 0, color = 'bg-stone-300/50 dark:bg-stone-600/30' }: { className?: string; delay?: number; color?: string }) {
  return (
    <motion.div
      className={`absolute pointer-events-none ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.6, 0] }}
      transition={{ duration: 4, repeat: Infinity, delay }}
    >
      <div className={`w-2 h-2 rounded-full ${color}`} />
    </motion.div>
  );
}

export function GridPattern({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      <div
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(128,128,128,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(128,128,128,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}

export function GradientOrb({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`absolute pointer-events-none rounded-full blur-3xl ${className}`}
      animate={{
        scale: [1, 1.15, 1],
        opacity: [0.12, 0.22, 0.12],
      }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
