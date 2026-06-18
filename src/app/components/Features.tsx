import { Eye, ImagePlus, Move3D, Share2, Smartphone, WandSparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useI18n } from './I18nProvider';

export function Features() {
  const { t } = useI18n();
  const features = [
    { icon: ImagePlus, title: t('featureSceneTitle'), desc: t('featureSceneDesc') },
    { icon: Move3D, title: t('featureMoveTitle'), desc: t('featureMoveDesc') },
    { icon: WandSparkles, title: t('featureLightTitle'), desc: t('featureLightDesc') },
    { icon: Eye, title: t('featurePreviewTitle'), desc: t('featurePreviewDesc') },
    { icon: Share2, title: t('featureInteractTitle'), desc: t('featureInteractDesc') },
    { icon: Smartphone, title: t('featureDeviceTitle'), desc: t('featureDeviceDesc') },
  ];

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-curator-brass">{t('featureSectionLabel')}</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t('featureSectionTitle')}</h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            {t('featureSectionDesc')}
          </p>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative min-h-44 overflow-hidden rounded-md border border-border bg-card p-5 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-colors hover:border-curator-brass/70"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary text-foreground">
                  <feature.icon className="size-5" />
                </div>
                <span className="text-xs font-bold text-muted-foreground transition-colors group-hover:text-curator-brass">
                  0{index + 1}
                </span>
              </div>
              <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.desc}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
