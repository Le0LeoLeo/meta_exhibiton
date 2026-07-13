import { Button } from './ui/button';
import { Link } from 'react-router';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { ArrowRight, Boxes, ImagePlus, Play, Sparkles, UsersRound } from 'lucide-react';
import { motion } from 'motion/react';
import { Gallery3D } from './Gallery3D';
import { useI18n } from './I18nProvider';

export function Hero() {
  const { t } = useI18n();
  const [videoOpen, setVideoOpen] = useState(false);
  const quickStats = [
    { icon: ImagePlus, label: t('heroQuickWork'), value: t('heroQuickWorkFormat') },
    { icon: Boxes, label: t('heroQuickRoom'), value: t('heroQuickRoomAction') },
    { icon: UsersRound, label: t('featureInteractTitle'), value: t('heroQuickShareAction') },
  ];
  const workflowChips = [t('featureSceneTitle'), t('featureMoveTitle'), t('featureInteractTitle')];

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
            <Link to="/register">
              <Button className="h-12 w-full rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-curator-brass sm:w-auto">
                {t('freeStart')}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              className="h-12 w-full rounded-md border-border bg-card px-6 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-secondary sm:w-auto"
              onClick={() => setVideoOpen(true)}
            >
              <Play className="mr-2 size-4" />
              {t('videoTutorial')}
            </Button>
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
          <div className="rounded-md border border-border bg-secondary p-3 shadow-[0_28px_90px_-56px_rgba(28,28,26,0.65)]">
            <div className="mb-3 flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-foreground">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm bg-curator-brass/70" />
                <span className="h-2 w-2 rounded-sm bg-muted-foreground/35" />
                <span className="h-2 w-2 rounded-sm bg-tool-blue/60" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">{t('vgBadge')}</span>
            </div>
            <div className="overflow-hidden rounded-md border border-border bg-[linear-gradient(135deg,#faf9f6_0%,#f4f3ee_100%)] px-3 pb-4 pt-5">
              <Gallery3D />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {workflowChips.map((label, index) => (
                <div key={label} className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
                  <span className="mr-2 text-tool-blue">0{index + 1}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="rounded-md border border-border bg-card text-foreground shadow-[0_24px_70px_-36px_rgba(28,28,26,0.5)] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('videoTutorial')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('heroDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex aspect-video items-center justify-center rounded-md border border-border bg-secondary">
            <div className="text-center text-muted-foreground">
              <Play className="mx-auto mb-4 size-16 text-curator-brass" />
              <p className="text-lg font-semibold text-foreground">{t('videoTutorial')}</p>
              <p className="mt-2 text-sm">{t('ctaDesc')}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
