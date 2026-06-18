import { Button } from '../components/ui/button';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Blocks, SlidersHorizontal, Maximize2, Users, BarChart3, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { loadAuth } from '../api/auth';
import { useI18n } from '../components/I18nProvider';

export default function VirtualGallery() {
  const navigate = useNavigate();
  const isLoggedIn = !!loadAuth().token;
  const myExhibitionsTarget = '/virtual-gallery/my-exhibitions';
  const { t } = useI18n();

  const features = [
    { icon: Blocks, title: t('vgFeature1Title'), desc: t('vgFeature1Desc') },
    { icon: SlidersHorizontal, title: t('vgFeature2Title'), desc: t('vgFeature2Desc') },
    { icon: Maximize2, title: t('vgFeature3Title'), desc: t('vgFeature3Desc') },
    { icon: Users, title: t('vgFeature4Title'), desc: t('vgFeature4Desc') },
    { icon: BarChart3, title: t('vgFeature5Title'), desc: t('vgFeature5Desc') },
    { icon: Sparkles, title: t('vgFeature6Title'), desc: t('vgFeature6Desc') },
  ];

  const steps = [
    { step: '01', title: t('vgStep1Title'), desc: t('vgStep1Desc') },
    { step: '02', title: t('vgStep2Title'), desc: t('vgStep2Desc') },
    { step: '03', title: t('vgStep3Title'), desc: t('vgStep3Desc') },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden border-b border-border bg-background">
        <div className="relative mx-auto max-w-4xl px-6 pb-14 pt-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6 inline-flex items-center rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('vgBadge')}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="mb-5 text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            {t('virtualGalleryTitle')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="mx-auto mb-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {t('virtualGallerySubtitle')}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
            <Button className="inline-flex items-center gap-2 bg-primary px-7 py-2.5 text-primary-foreground hover:bg-curator-brass" onClick={() => navigate(isLoggedIn ? myExhibitionsTarget : `/login?returnTo=${encodeURIComponent(myExhibitionsTarget)}`)}>
              {t('startCreatingGallery')}
              <ArrowRight className="size-4" />
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-20">
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-10 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('features')}</motion.p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.4, delay: i * 0.07 }} className="group cursor-default rounded-md border border-border bg-card p-5 text-left shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition hover:-translate-y-0.5 hover:border-curator-brass/70">
              <motion.div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary text-curator-brass" whileHover={{ scale: 1.05 }}>
                <f.icon className="size-4.5" />
              </motion.div>
              <h3 className="mb-1 text-sm font-medium text-card-foreground">{f.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="border-y border-border bg-secondary/30">
        <div className="mx-auto max-w-2xl px-6 py-20">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-10 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('process')}</motion.p>
          <div className="space-y-3">
            {steps.map((item, i) => (
              <motion.div key={item.step} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.1 }} className="relative flex items-start gap-4 rounded-md border border-border bg-card p-5 text-left shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition hover:-translate-y-0.5 hover:border-curator-brass/70">
                {i < steps.length - 1 && <span className="absolute left-[1.95rem] top-[3.2rem] h-[calc(100%+0.75rem)] border-l border-dashed border-border" />}
                <div className="relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded border border-curator-brass/60 bg-card px-2 py-1 font-mono text-xs font-semibold uppercase tracking-wide text-curator-brass">
                  {item.step}
                </div>
                <div className="flex-1 pt-0.5">
                  <h3 className="mb-0.5 text-sm font-medium text-card-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mx-auto max-w-3xl px-6 py-16">
        <div className="relative overflow-hidden rounded-md border border-border bg-card text-left shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition hover:-translate-y-0.5 hover:border-curator-brass/70">
          <div className="relative h-24 overflow-hidden border-b border-border bg-secondary/40">
            <div className="absolute inset-0 flex items-center justify-center gap-5 opacity-20">
              {[...Array(4)].map((_, i) => <motion.div key={i} className="h-18 w-14 rounded border border-border bg-card" animate={{ y: [0, -3, 0] }} transition={{ duration: 3.5, delay: i * 0.4, repeat: Infinity }} />)}
            </div>
          </div>
          <div className="relative -mt-4 px-8 pb-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-curator-brass shadow-sm">
              <Blocks className="size-4" />
            </div>
            <h2 className="mb-1 text-base font-semibold text-card-foreground">{t('galleryTemplates')}</h2>
            <p className="text-sm text-muted-foreground">{t('templatesComingSoon')}</p>
          </div>
        </div>
      </motion.div>

      <div className="relative overflow-hidden border-t border-border bg-secondary/40">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="mb-3 text-2xl font-semibold text-foreground">{t('vgCtaTitle')}</h2>
          <p className="mb-8 text-muted-foreground">{t('vgCtaDesc')}</p>
          <Link to="/register">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="inline-flex items-center gap-2 bg-primary px-7 py-2.5 font-medium text-primary-foreground hover:bg-curator-brass">
                {t('registerNow')}
                <ArrowRight className="size-4" />
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
