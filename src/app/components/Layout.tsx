import { useLocation, useMatches, useOutlet } from 'react-router';
import { AnimatePresence, motion, useReducedMotion, useIsPresent, type Variants } from 'motion/react';
import { useState, useEffect } from 'react';
import { Navigation } from './Navigation';
import { Footer } from './Footer';
import { PointerBackdrop } from './PointerBackdrop';
import { PageMetadata } from './PageMetadata';
import { UnsavedChangesProvider } from './UnsavedChangesProvider';
import { useI18n } from './I18nProvider';

function FrozenOutlet() {
  const currentOutlet = useOutlet();
  const [outlet] = useState(currentOutlet);
  const isPresent = useIsPresent();
  return <div className="museum-route-content" {...(!isPresent ? { inert: '' } : {})}>{outlet}</div>;
}

const pageVariants: Variants = {
  initial: (compact: boolean) => ({ opacity: 0, y: compact ? 10 : 24 }),
  enter: (compact: boolean) => ({
    opacity: 1, y: 0,
    transition: {
      y: { duration: compact ? 0.34 : 0.52, ease: [0.22, 1, 0.36, 1] },
      opacity: { duration: compact ? 0.24 : 0.36, ease: 'easeOut' },
    },
  }),
  exit: (compact: boolean) => ({
    opacity: 0, y: compact ? -4 : -10,
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
  }),
};

const opacityOnlyPageVariants = {
  initial: { opacity: 0 },
  enter: { opacity: 1 },
  exit: { opacity: 0 },
};

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
  const location = useLocation();
  const matches = useMatches();
  const shouldReduceMotion = useReducedMotion();
  const isCoarsePointer = useCoarsePointer();
  const isFullscreen = matches.some(({ handle }) =>
    (handle as { layout?: string } | undefined)?.layout === 'fullscreen',
  );
  const shouldUseSimpleTransition = Boolean(shouldReduceMotion || isFullscreen);
  const { t } = useI18n();

  return (
    <UnsavedChangesProvider>
    <div className={`flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground transition-colors duration-300 museum-shell ${isFullscreen ? 'museum-immersive' : 'museum-pages'}`}>
      <PageMetadata />
      {!isFullscreen && <PointerBackdrop />}
      {!isFullscreen && <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10001] focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg">{t('skipToContent')}</a>}
      {!isFullscreen && <Navigation />}
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <AnimatePresence mode="wait" initial={false} onExitComplete={() => {
          // Reset between pages so the outgoing content never jumps to its top.
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        }}>
          <motion.div
            key={location.pathname}
            custom={isCoarsePointer}
            variants={shouldUseSimpleTransition ? opacityOnlyPageVariants : pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={shouldUseSimpleTransition ? { duration: 0 } : undefined}
            className="min-h-[calc(100vh-3.5rem)]"
          >
            <FrozenOutlet />
          </motion.div>
        </AnimatePresence>
      </main>
      {!isFullscreen && <Footer />}
    </div>
    </UnsavedChangesProvider>
  );
}
