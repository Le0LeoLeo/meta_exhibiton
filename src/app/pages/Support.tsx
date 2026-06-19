import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, HelpCircle, Book, Video, Home } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { useI18n } from '../components/I18nProvider';

export default function Support() {
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useI18n();

  const quickLinks = [
    { icon: Book, title: t('navVirtualGallery'), desc: t('supportVirtualGalleryDesc'), path: '/virtual-gallery', iconBg: 'bg-secondary', iconColor: 'text-curator-brass group-hover:text-foreground' },
    { icon: Video, title: t('navExhibitions'), desc: t('supportExhibitionsDesc'), path: '/exhibitions', iconBg: 'bg-secondary', iconColor: 'text-tool-blue group-hover:text-foreground' },
    { icon: HelpCircle, title: t('supportFaq'), desc: t('supportFaqDesc'), path: '#faq', iconBg: 'bg-secondary', iconColor: 'text-curator-brass group-hover:text-foreground' },
    { icon: Home, title: t('navHome'), desc: t('supportHomeDesc'), path: '/', iconBg: 'bg-secondary', iconColor: 'text-success-quiet group-hover:text-foreground' },
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-3xl pb-12 pt-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6 inline-flex items-center gap-2 rounded-md border border-curator-brass/60 bg-secondary px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-curator-brass">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-success-quiet"></span>
            {t('supportReady')}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="mb-5 text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            {t('supportTitle')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="mb-8 text-lg text-muted-foreground">
            {t('supportSubtitle')}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }} className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t('supportSearchPlaceholder')} className="rounded-md border-border bg-card py-2.5 pl-11 shadow-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </motion.div>
        </div>

        <div className="py-10">
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-8 text-center text-xs uppercase tracking-wide text-curator-brass">
          {t('quickGuide')}
        </motion.p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((link, i) => {
            const content = (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} whileHover={{ y: -3, transition: { duration: 0.2 } }} className="group flex h-full cursor-default flex-col items-center rounded-md border border-border bg-card p-5 text-center text-foreground shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-colors hover:border-curator-brass/70">
                <div className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-md border border-border ${link.iconBg} transition-colors`}>
                  <link.icon className={`size-4 ${link.iconColor} transition-colors`} />
                </div>
                <span className="mb-0.5 text-sm font-medium text-foreground">{link.title}</span>
                <span className="text-xs text-muted-foreground">{link.desc}</span>
              </motion.div>
            );

            return link.path.startsWith('/') ? (
              <Link key={link.title} to={link.path}>{content}</Link>
            ) : (
              <a key={link.title} href={link.path} onClick={(e) => { if (link.path === '#faq') { e.preventDefault(); document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' }); } }}>
                {content}
              </a>
            );
          })}
        </div>
        </div>

        <div className="border-t border-border py-12" id="faq-section">
        <div className="mx-auto max-w-2xl">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-8 text-center text-xs uppercase tracking-wide text-curator-brass">
            {t('faqTitle')}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="rounded-md border border-border bg-card p-10 text-center shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)]">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary text-curator-brass">
              <HelpCircle className="size-5" />
            </div>
            <div className="mx-auto mb-5 max-w-sm">
              <p className="mb-1 text-sm font-medium text-foreground">{searchQuery ? t('supportNoMatch').replace('{query}', searchQuery) : t('supportFaqPlaceholder')}</p>
              <p className="text-xs text-muted-foreground">{t('supportComingSoon')}</p>
            </div>
            {searchQuery && (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                  {t('clearSearch')}
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      </div>
    </div>
  );
}
