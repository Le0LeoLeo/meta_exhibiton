import { Button } from '../components/ui/button';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useI18n } from '../components/I18nProvider';
import EducationGuide from './EducationGuide';
import UsageGuide from './UsageGuide';

export default function Resources() {
  const { t } = useI18n();
  const { hash } = useLocation();
  // Links from Support jump straight to one guide.
  useEffect(() => {
    if (!hash.startsWith('#guide-')) return;
    const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="museum-page-heading">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('resourceTabDocs')}</p>
            <h1 className="mb-6 text-4xl font-semibold text-foreground sm:text-5xl">{t('resourcesCenter')}</h1>
          </div>
        </div>
      </div>

      <div className="py-12">
        <UsageGuide />
        <EducationGuide />
      </div>

      <section className="border-t border-border bg-secondary py-16 text-foreground">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-semibold">{t('resourceNeedMore')}</h2>
          <p className="mb-8 text-lg text-muted-foreground">{t('resourceContactSupport')}</p>
          <Button asChild className="bg-primary px-8 py-6 text-lg text-primary-foreground hover:bg-curator-brass">
            <Link to="/support#faq-section">{t('resourceContactSupportBtn')}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
