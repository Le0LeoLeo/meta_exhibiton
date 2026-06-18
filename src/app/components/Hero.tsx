import { Button } from './ui/button';
import { Link } from 'react-router';
import { ArrowRight, Boxes, ImagePlus, Sparkles, UsersRound } from 'lucide-react';
import { motion } from 'motion/react';
import { Gallery3D } from './Gallery3D';
import { useI18n } from './I18nProvider';

export function Hero() {
  const { t } = useI18n();
  const quickStats = [
    { icon: ImagePlus, label: '\u4f5c\u54c1\u7d20\u6750', value: 'PDF / IMG / Video' },
    { icon: Boxes, label: '3D \u5c55\u9593', value: '\u62d6\u653e\u4f48\u7f6e' },
    { icon: UsersRound, label: '\u5206\u4eab\u53c3\u89c0', value: '\u516c\u958b\u9023\u7d50' },
  ];

  return (
    <section className="relative overflow-hidden bg-background">
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:pb-16 lg:pt-14">
        <div className="max-w-2xl text-left">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm"
          >
            <Sparkles className="size-3.5" />
            <span>{t('appShort')}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08 }}
            className="mt-6 max-w-2xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            {t('heroTitle1')}
            <span className="mt-1 block text-curator-brass">{t('heroTitle2')}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-5 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg"
          >
            {t('heroDescription')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-7 flex flex-col gap-3 sm:flex-row"
          >
            <Link to="/virtual-gallery/my-exhibitions">
              <Button className="h-12 w-full rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-curator-brass sm:w-auto">
                {t('freeStart')}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
            <Link to="/virtual-gallery">
              <Button variant="outline" className="h-12 w-full rounded-md border-border bg-card px-6 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-secondary sm:w-auto">
                {t('learnMore')}
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.42 }}
            className="mt-8 grid gap-3 sm:grid-cols-3"
          >
            {quickStats.map((item) => (
              <div key={item.label} className="rounded-md border border-border bg-card p-3 shadow-sm">
                <item.icon className="mb-2 size-4 text-curator-brass" />
                <div className="text-xs font-semibold text-foreground">{item.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{item.value}</div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 22 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18 }}
          className="relative"
        >
          <div className="absolute -left-3 top-6 hidden rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm md:block">
            Live preview
          </div>
          <div className="absolute -right-3 bottom-10 hidden rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm md:block">
            Share ready
          </div>
          <div className="rounded-md border border-border bg-secondary p-3 shadow-[0_28px_90px_-56px_rgba(28,28,26,0.65)]">
            <div className="mb-3 flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-foreground">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm bg-curator-brass/70" />
                <span className="h-2 w-2 rounded-sm bg-muted-foreground/35" />
                <span className="h-2 w-2 rounded-sm bg-tool-blue/60" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">3D Gallery Studio</span>
            </div>
            <div className="overflow-hidden rounded-md border border-border bg-[linear-gradient(135deg,#faf9f6_0%,#f4f3ee_100%)] px-3 pb-4 pt-5">
              <Gallery3D />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {['Upload', 'Arrange', 'Invite'].map((label, index) => (
                <div key={label} className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
                  <span className="mr-2 text-tool-blue">0{index + 1}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
