import { useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  Building2,
  Check,
  GraduationCap,
  Landmark,
  Palette,
  Send,
  Store,
  UsersRound,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useI18n } from '../components/I18nProvider';

export default function Solutions() {
  const { t } = useI18n();
  const [contactOpen, setContactOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', company: '', message: '' });
  const [sending, setSending] = useState(false);

  const solutionGroups = [
    {
      key: 'art',
      titleKey: 'solutionsArtTitle',
      descKey: 'solutionsArtDesc',
      icon: Palette,
      image: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=900&q=80',
      features: ['solutionsArtFeature0', 'solutionsArtFeature1', 'solutionsArtFeature2', 'solutionsArtFeature3'],
      useCases: ['solutionsArtUseCase0', 'solutionsArtUseCase1', 'solutionsArtUseCase2', 'solutionsArtUseCase3'],
    },
    {
      key: 'enterprise',
      titleKey: 'solutionsEnterpriseTitle',
      descKey: 'solutionsEnterpriseDesc',
      icon: Building2,
      image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&q=80',
      features: ['solutionsEnterpriseFeature0', 'solutionsEnterpriseFeature1', 'solutionsEnterpriseFeature2', 'solutionsEnterpriseFeature3'],
      useCases: ['solutionsEnterpriseUseCase0', 'solutionsEnterpriseUseCase1', 'solutionsEnterpriseUseCase2', 'solutionsEnterpriseUseCase3'],
    },
    {
      key: 'education',
      titleKey: 'solutionsEducationTitle',
      descKey: 'solutionsEducationDesc',
      icon: GraduationCap,
      image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=900&q=80',
      features: ['solutionsEducationFeature0', 'solutionsEducationFeature1', 'solutionsEducationFeature2', 'solutionsEducationFeature3'],
      useCases: ['solutionsEducationUseCase0', 'solutionsEducationUseCase1', 'solutionsEducationUseCase2', 'solutionsEducationUseCase3'],
    },
    {
      key: 'museum',
      titleKey: 'solutionsMuseumTitle',
      descKey: 'solutionsMuseumDesc',
      icon: Landmark,
      image: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=900&q=80',
      features: ['solutionsMuseumFeature0', 'solutionsMuseumFeature1', 'solutionsMuseumFeature2', 'solutionsMuseumFeature3'],
      useCases: ['solutionsMuseumUseCase0', 'solutionsMuseumUseCase1', 'solutionsMuseumUseCase2', 'solutionsMuseumUseCase3'],
    },
    {
      key: 'retail',
      titleKey: 'solutionsRetailTitle',
      descKey: 'solutionsRetailDesc',
      icon: Store,
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&q=80',
      features: ['solutionsRetailFeature0', 'solutionsRetailFeature1', 'solutionsRetailFeature2', 'solutionsRetailFeature3'],
      useCases: ['solutionsRetailUseCase0', 'solutionsRetailUseCase1', 'solutionsRetailUseCase2', 'solutionsRetailUseCase3'],
    },
    {
      key: 'community',
      titleKey: 'solutionsCommunityTitle',
      descKey: 'solutionsCommunityDesc',
      icon: UsersRound,
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=80',
      features: ['solutionsCommunityFeature0', 'solutionsCommunityFeature1', 'solutionsCommunityFeature2', 'solutionsCommunityFeature3'],
      useCases: ['solutionsCommunityUseCase0', 'solutionsCommunityUseCase1', 'solutionsCommunityUseCase2', 'solutionsCommunityUseCase3'],
    },
  ];

  const timeOptions = [
    { key: 'mon10', label: t('solutionsMon10') },
    { key: 'wed14', label: t('solutionsWed14') },
    { key: 'fri16', label: t('solutionsFri16') },
    { key: 'other', label: t('solutionsOtherTime') },
  ];

  const handleContactSubmit = async () => {
    if (!contactForm.name.trim() || !contactForm.email.trim()) {
      toast.error(t('solutionsContactErrorTitle'), { description: t('solutionsContactErrorDesc') });
      return;
    }

    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setSending(false);
    setContactOpen(false);
    setContactForm({ name: '', email: '', company: '', message: '' });
    toast.success(t('solutionsContactSuccessTitle'), { description: t('solutionsContactSuccessDesc') });
  };

  const handleDemoSubmit = async () => {
    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setSending(false);
    setDemoOpen(false);
    toast.success(t('solutionsDemoSuccessTitle'), { description: t('solutionsDemoSuccessDesc') });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          className="mx-auto max-w-4xl text-center"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('solutionsLabel')}</p>
          <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl">{t('solutionsHeroTitle')}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            {t('solutionsHeroDesc')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={() => setContactOpen(true)}>{t('solutionsContactBtn')}</Button>
            <Button variant="outline" onClick={() => setDemoOpen(true)}>{t('solutionsDemoBtn')}</Button>
          </div>
        </motion.div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-10">
          {solutionGroups.map((solution, index) => (
            <motion.article
              key={solution.key}
              className="grid gap-0 overflow-hidden rounded-md border border-border bg-card shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] lg:grid-cols-[0.95fr_1.05fr]"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.18 }}
              transition={{ duration: 0.45, delay: index * 0.04 }}
            >
              <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                <ImageWithFallback src={solution.image} alt={t(solution.titleKey)} className="h-full min-h-[280px] w-full object-cover" />
              </div>
              <div className="p-6 sm:p-8">
                <div className="mb-5 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-curator-brass">
                    <solution.icon className="size-6" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('solutionsUseCaseLabel', { number: String(index + 1).padStart(2, '0') })}</p>
                    <h2 className="text-2xl font-semibold text-foreground">{t(solution.titleKey)}</h2>
                  </div>
                </div>
                <p className="text-base leading-7 text-muted-foreground">{t(solution.descKey)}</p>

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-foreground">{t('solutionsCoreCapabilities')}</h3>
                    <ul className="space-y-2">
                      {solution.features.map((featureKey) => (
                        <li key={featureKey} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                          <Check className="mt-1 size-4 shrink-0 text-curator-brass" />
                          <span>{t(featureKey)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-foreground">{t('solutionsSuitableScenarios')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {solution.useCases.map((useCaseKey) => (
                        <button
                          key={useCaseKey}
                          type="button"
                          className="rounded-md border border-curator-brass/50 px-3 py-1 text-sm text-curator-brass transition-colors hover:bg-secondary"
                          onClick={() => toast.info(t(useCaseKey), { description: t('solutionsUseCaseToast', { solutionTitle: t(solution.titleKey) }) })}
                        >
                          {t(useCaseKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-secondary px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('solutionsNextStepLabel')}</p>
          <h2 className="text-3xl font-semibold text-foreground">{t('solutionsNextStepTitle')}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            {t('solutionsNextStepDesc')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={() => setContactOpen(true)}>{t('solutionsContactBtn')}</Button>
            <Button variant="outline" onClick={() => setDemoOpen(true)}>{t('solutionsDemoBtn')}</Button>
          </div>
        </div>
      </section>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('solutionsContactTitle')}</DialogTitle>
            <DialogDescription>{t('solutionsContactDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label htmlFor="solution-name" className="mb-1 block text-sm text-muted-foreground">{t('solutionsContactNameLabel')}</label>
              <Input id="solution-name" value={contactForm.name} onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={t('solutionsContactNamePlaceholder')} />
            </div>
            <div>
              <label htmlFor="solution-email" className="mb-1 block text-sm text-muted-foreground">{t('solutionsContactEmailLabel')}</label>
              <Input id="solution-email" type="email" value={contactForm.email} onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))} placeholder={t('solutionsContactEmailPlaceholder')} />
            </div>
            <div>
              <label htmlFor="solution-company" className="mb-1 block text-sm text-muted-foreground">{t('solutionsContactCompanyLabel')}</label>
              <Input id="solution-company" value={contactForm.company} onChange={(e) => setContactForm((prev) => ({ ...prev, company: e.target.value }))} placeholder={t('solutionsContactCompanyPlaceholder')} />
            </div>
            <div>
              <label htmlFor="solution-message" className="mb-1 block text-sm text-muted-foreground">{t('solutionsContactMessageLabel')}</label>
              <Textarea id="solution-message" rows={4} value={contactForm.message} onChange={(e) => setContactForm((prev) => ({ ...prev, message: e.target.value }))} placeholder={t('solutionsContactMessagePlaceholder')} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setContactOpen(false)}>{t('solutionsContactCancelBtn')}</Button>
            <Button onClick={handleContactSubmit} disabled={sending}>
              {sending ? t('solutionsContactSendingBtn') : <><Send className="size-4" />{t('solutionsContactSubmitBtn')}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('solutionsDemoTitle')}</DialogTitle>
            <DialogDescription>{t('solutionsDemoDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2 sm:grid-cols-2">
            {timeOptions.map((time) => (
              <Button key={time.key} variant="outline" onClick={() => toast.info(t('solutionsDemoTimeSelected', { time: time.label }))}>
                {time.label}
              </Button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDemoOpen(false)}>{t('solutionsDemoCancelBtn')}</Button>
            <Button onClick={handleDemoSubmit} disabled={sending}>{sending ? t('solutionsDemoBookingBtn') : t('solutionsDemoConfirmBtn')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
