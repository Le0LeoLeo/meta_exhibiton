import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowRight, Compass, HelpCircle, LayoutGrid, Search, ShieldCheck, X } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useI18n } from '../components/I18nProvider';

const topics = ['all', 'create', 'manage', 'view'] as const;
const questions = [
  { id: 'start', topic: 'create', path: '/virtual-gallery' },
  { id: 'media', topic: 'create', path: '/virtual-gallery/my-exhibitions' },
  { id: 'save', topic: 'create', path: '/virtual-gallery/my-exhibitions' },
  { id: 'share', topic: 'manage', path: '/virtual-gallery/my-exhibitions' },
  { id: 'edit', topic: 'manage', path: '/virtual-gallery/my-exhibitions' },
  { id: 'privacy', topic: 'manage', path: '/privacy' },
  { id: 'device', topic: 'view', path: '/demo' },
  { id: 'load', topic: 'view', path: '/demo' },
  { id: 'login', topic: 'manage', path: '/login' },
] as const;

export default function Support() {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [topic, setTopic] = useState<(typeof topics)[number]>('all');
  const { hash } = useLocation();
  useEffect(() => {
    if (hash !== '#faq-section' && hash !== '#getting-started') return;
    const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  const query = searchQuery.trim().toLocaleLowerCase();
  const faqs = questions.filter((faq) => (topic === 'all' || topic === faq.topic) &&
    (!query || [t(`ssFaq_${faq.id}Q`), t(`ssFaq_${faq.id}A`)].some((text) => text.toLocaleLowerCase().includes(query))));
  const reset = () => { setSearchQuery(''); setTopic('all'); };
  const links = [
    { icon: LayoutGrid, title: 'ssStart', description: 'ssStartDesc', path: '/virtual-gallery' },
    { icon: Compass, title: 'ssDemo', description: 'ssDemoDesc', path: '/demo' },
    { icon: ShieldCheck, title: 'ssManage', description: 'ssManageDesc', path: '/virtual-gallery/my-exhibitions' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border">
        <div className="museum-page-heading">
          <p className="text-xs font-semibold tracking-wide text-curator-brass">{t('supportQuickGuide')}</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">{t('supportTitle')}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{t('ssSupportDesc')}</p>
          <form role="search" className="mt-8" onSubmit={(event) => { event.preventDefault(); document.getElementById('faq-section')?.scrollIntoView(); }}>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label={t('supportSearchPlaceholder')} placeholder={t('supportSearchPlaceholder')} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-14 bg-card pl-12 pr-14 text-base" />
              {searchQuery && <button type="button" aria-label={t('supportClearSearch')} onClick={() => setSearchQuery('')} className="absolute right-1 top-1 flex size-12 items-center justify-center rounded-md hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"><X aria-hidden="true" className="size-4" /></button>}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t('ssSearchHint')}</p>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav aria-label={t('supportQuickGuide')} className="grid gap-4 py-10 md:grid-cols-3">
          {links.map(({ icon: Icon, title, description, path }) => (
            <Link key={path} to={path} className="group rounded-md border border-border bg-card p-6 transition-colors hover:border-curator-brass focus-visible:outline-2 focus-visible:outline-ring">
              <Icon aria-hidden="true" className="mb-5 size-6 text-curator-brass" />
              <span className="flex items-center justify-between gap-3 text-lg font-semibold">{t(title)}<ArrowRight aria-hidden="true" className="size-4 shrink-0" /></span>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(description)}</p>
            </Link>
          ))}
        </nav>

        <section id="faq-section" className="scroll-mt-28 border-t border-border py-12">
          <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
            <div>
              <p className="text-xs font-semibold tracking-wide text-curator-brass">{t('supportFaqSection')}</p>
              <h2 className="mt-3 text-3xl font-semibold">{t('supportFaqTitle')}</h2>
              <div className="mt-6 flex flex-wrap gap-2 lg:flex-col" role="group" aria-label={t('ssTopics')}>
                {topics.map((item) => <Button key={item} variant={topic === item ? 'default' : 'outline'} aria-pressed={topic === item} className="min-h-11 justify-start whitespace-normal text-left" onClick={() => setTopic(item)}>{t(`ssTopic_${item}`)}</Button>)}
              </div>
            </div>
            <div className="min-w-0">
              <p role="status" className="mb-4 text-sm text-muted-foreground">{t('ssResults', { count: faqs.length })}</p>
              {faqs.length ? (
                <Accordion type="single" collapsible className="space-y-3">
                  {faqs.map((faq) => (
                    <AccordionItem key={faq.id} value={faq.id} className="rounded-md border border-border bg-card px-5">
                      <AccordionTrigger className="min-h-16 text-left text-base">{t(`ssFaq_${faq.id}Q`)}</AccordionTrigger>
                      <AccordionContent className="text-sm leading-7 text-muted-foreground">
                        <p>{t(`ssFaq_${faq.id}A`)}</p>
                        <Link to={faq.path} className="mt-3 inline-flex min-h-11 items-center gap-2 font-medium text-foreground underline underline-offset-4">{t(`ssFaq_${faq.id}Link`)}<ArrowRight className="size-4" aria-hidden="true" /></Link>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="rounded-md border border-dashed border-border p-8 text-center">
                  <HelpCircle aria-hidden="true" className="mx-auto mb-4 size-8 text-curator-brass" />
                  <h3 className="text-lg font-semibold">{t('ssNoResults')}</h3>
                  <p className="mb-5 mt-2 text-sm text-muted-foreground">{t('ssNoResultsDesc')}</p>
                  <Button variant="outline" onClick={reset}>{t('supportClearSearch')}</Button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="getting-started" className="scroll-mt-28 border-t border-border py-12">
          <h2 className="text-2xl font-semibold">{t('ssWorkflow')}</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((step) => <li key={step} className="rounded-md bg-secondary/60 p-6">
              <span className="text-sm font-semibold text-curator-brass">0{step}</span>
              <h3 className="mt-3 text-lg font-semibold">{t(`ssStep${step}`)}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{t(`ssStep${step}Desc`)}</p>
            </li>)}
          </ol>
        </section>

        <section className="mb-16 grid gap-6 rounded-md border border-border bg-card p-6 sm:p-8 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-curator-brass">{t('ssServiceLabel')}</p>
            <h2 className="mt-3 text-2xl font-semibold">{t('ssStillNeedHelp')}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{t('ssSupportEmailDesc')}</p>
            <a href="mailto:iopipoiopiopiopiop9990@gmail.com" className="mt-3 inline-flex min-h-11 max-w-full items-center break-all text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">iopipoiopiopiopiop9990@gmail.com</a>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{t('ssSupportEmailHint')}</p>
            <Button asChild variant="outline" className="mt-5"><Link to="/solutions">{t('ssViewSolutions')}<ArrowRight aria-hidden="true" className="size-4" /></Link></Button>
          </div>
          <div className="rounded-md bg-secondary/60 p-5">
            <h3 className="font-semibold">{t('ssTroubleshoot')}</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
              <li>{t('ssTrouble1')}</li><li>{t('ssTrouble2')}</li><li>{t('ssTrouble3')}</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
