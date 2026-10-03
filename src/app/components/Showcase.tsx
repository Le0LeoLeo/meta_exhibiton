import { Link } from 'react-router';
import { ArrowRight, Building2, GraduationCap, Palette } from 'lucide-react';
import { motion } from 'motion/react';
import { useI18n } from './I18nProvider';

export function Showcase() {
  const { t } = useI18n();
  const useCases = [
    { icon: Palette, title: t('showcaseUseCase1Title'), desc: t('showcaseUseCase1Desc') },
    { icon: GraduationCap, title: t('showcaseUseCase2Title'), desc: t('showcaseUseCase2Desc') },
    { icon: Building2, title: t('showcaseUseCase3Title'), desc: t('showcaseUseCase3Desc') },
  ];
  const [featured, ...secondary] = useCases;

  return (
    <section className="bg-secondary">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-curator-brass">{t('showcaseSectionLabel')}</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t('showcaseSectionTitle')}</h2>
          </div>
          <Link to="/exhibitions" className="inline-flex items-center gap-2 text-sm font-semibold text-tool-blue transition-colors hover:text-curator-brass">
            {t('browseGallery')}
            <ArrowRight className="size-4" />
          </Link>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Link to="/solutions">
            <motion.article
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative h-full overflow-hidden rounded-md border border-border bg-card p-6 shadow-[0_24px_70px_-48px_rgba(28,28,26,0.55)] transition-colors hover:border-curator-brass/70 sm:p-8"
            >
              <div className="relative z-10 flex h-full min-h-72 flex-col justify-between gap-8">
                <div>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-border bg-secondary text-curator-brass shadow-sm">
                    <featured.icon className="size-6" />
                  </div>
                  <h3 className="max-w-lg text-2xl font-semibold tracking-tight text-foreground">{featured.title}</h3>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{featured.desc}</p>
                </div>
                <div className="grid max-w-md grid-cols-3 gap-2">
                  {[t('showcaseUseCase1Title'), t('featureMoveTitle'), t('featureInteractTitle')].map((label) => (
                    <div key={label} className="rounded-md border border-border bg-secondary px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </motion.article>
          </Link>

          <div className="grid gap-4">
            {secondary.map((item, index) => (
              <Link to="/solutions" key={item.title}>
                <motion.article
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="group h-full rounded-md border border-border bg-card p-5 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-colors hover:border-curator-brass/70"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary text-foreground shadow-sm">
                      <item.icon className="size-5" />
                    </div>
                    <ArrowRight className="size-4 text-tool-blue transition-colors group-hover:text-curator-brass" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.desc}</p>
                </motion.article>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
