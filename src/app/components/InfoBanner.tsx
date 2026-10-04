import { Button } from './ui/button';
import { Link } from 'react-router';
import { useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useI18n } from './I18nProvider';

export function InfoBanner() {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(true);

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="relative overflow-hidden bg-background py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24, transition: { duration: 0.3 } }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55 }}
              className="relative overflow-hidden rounded-md border border-border bg-card p-6 shadow-[0_24px_70px_-44px_rgba(28,28,26,0.45)] sm:p-8 lg:p-10"
            >
              <motion.button
                type="button"
                className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                onClick={() => setIsVisible(false)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={t('visitorDismissBanner')}
              >
                <X className="size-4" />
              </motion.button>

              <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="max-w-2xl pr-10">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
                    <Sparkles className="size-3.5" />
                    {t('appShort')}
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t('ctaTitle')}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{t('ctaDesc')}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <Button asChild className="h-auto min-h-12 w-full whitespace-normal rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-curator-brass">
                    <Link to="/virtual-gallery/quick-create">
                      {t('quickExhibitionCreateAction')}
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-auto min-h-12 w-full whitespace-normal rounded-md border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-secondary">
                    <Link to="/demo">{t('visitorDemoAction')}</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
