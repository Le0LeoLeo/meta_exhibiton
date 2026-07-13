import { useLocation, useOutlet } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { Navigation } from './Navigation';
import { Footer } from './Footer';
import { useI18n } from './I18nProvider';

function FrozenOutlet() {
  const currentOutlet = useOutlet();
  const [outlet] = useState(currentOutlet);
  return <>{outlet}</>;
}

const pageVariants = {
  initial: { opacity: 0, y: 20, filter: 'blur(6px)' },
  enter: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -12, filter: 'blur(4px)' },
};

const pageTransition = { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] };
const opacityOnlyPageVariants = {
  initial: { opacity: 0 },
  enter: { opacity: 1 },
  exit: { opacity: 0 },
};
const opacityOnlyPageTransition = { duration: 0.18 };

const fullscreenPrefixes = ['/exhibitions/', '/growth-memories/share/', '/virtual-gallery/create', '/virtual-gallery/upload'];

function isFullscreenPathname(pathname: string) {
  return fullscreenPrefixes.some((prefix) => pathname.startsWith(prefix));
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

export function Layout() {
  const { t } = useI18n();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const isCoarsePointer = useCoarsePointer();
  const prevPathRef = useRef(location.pathname);
  const isFullscreen = isFullscreenPathname(location.pathname);
  const shouldUseSimpleTransition = Boolean(shouldReduceMotion || isCoarsePointer);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground transition-colors duration-300">
      {!isFullscreen && <Navigation />}
      <main className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={shouldUseSimpleTransition ? opacityOnlyPageVariants : pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={shouldUseSimpleTransition ? opacityOnlyPageTransition : pageTransition}
            className="min-h-[calc(100vh-3.5rem)]"
          >
            <FrozenOutlet />
          </motion.div>
        </AnimatePresence>
      </main>
      {!isFullscreen && <Footer />}
    </div>
  );
}
