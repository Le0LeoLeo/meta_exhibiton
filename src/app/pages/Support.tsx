import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Book, HelpCircle, Mail, MessageCircle, Phone, Search, Users, Video } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useI18n } from '../components/I18nProvider';

export default function Support() {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', description: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const contactMethods = [
    {
      id: 'livechat',
      icon: MessageCircle,
      title: t('supportContactLiveChat'),
      description: t('supportContactLiveChatDesc'),
      availability: t('supportContactLiveChatAvail'),
      action: t('supportContactLiveChatAction'),
    },
    {
      id: 'email',
      icon: Mail,
      title: t('supportContactEmail'),
      description: t('supportContactEmailDesc'),
      availability: t('supportContactEmailAvail'),
      action: t('supportContactEmailAction'),
    },
    {
      id: 'phone',
      icon: Phone,
      title: t('supportContactPhone'),
      description: t('supportContactPhoneDesc'),
      availability: t('supportContactPhoneAvail'),
      action: t('supportContactPhoneAction'),
    },
  ];

  const faqs = [
    {
      question: t('supportFaq1Q'),
      answer: t('supportFaq1A'),
    },
    {
      question: t('supportFaq2Q'),
      answer: t('supportFaq2A'),
    },
    {
      question: t('supportFaq3Q'),
      answer: t('supportFaq3A'),
    },
    {
      question: t('supportFaq4Q'),
      answer: t('supportFaq4A'),
    },
    {
      question: t('supportFaq5Q'),
      answer: t('supportFaq5A'),
    },
    {
      question: t('supportFaq6Q'),
      answer: t('supportFaq6A'),
    },
    {
      question: t('supportFaq7Q'),
      answer: t('supportFaq7A'),
    },
  ];

  const quickLinks = [
    { icon: Book, title: t('supportQuickManual'), path: '/resources' },
    { icon: Video, title: t('supportQuickVideo'), path: '/resources' },
    { icon: HelpCircle, title: t('supportFaq'), path: '#faq' },
    { icon: Users, title: t('supportQuickForum'), path: '#' },
  ];

  const filteredFaqs = searchQuery.trim()
    ? faqs.filter((faq) => {
        const query = searchQuery.trim().toLowerCase();
        return faq.question.toLowerCase().includes(query) || faq.answer.toLowerCase().includes(query);
      })
    : faqs;

  const handleContactAction = (method: typeof contactMethods[number]) => {
    if (method.id === 'livechat') {
      toast.success(t('supportToastChatOnline'), { description: t('supportToastChatOnlineDesc') });
    } else if (method.id === 'email') {
      toast.info(t('supportToastEmailOpen'), { description: t('supportToastEmailOpenDesc') });
    } else {
      toast.info(t('supportContactPhone'), { description: t('supportToastPhoneInfoDesc') });
    }
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = t('supportErrNameRequired');
    if (!formData.email.trim()) errs.email = t('supportErrEmailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = t('supportErrEmailInvalid');
    if (!formData.subject.trim()) errs.subject = t('supportErrSubjectRequired');
    if (!formData.description.trim()) errs.description = t('supportErrDescRequired');
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setSubmitting(false);
    setFormData({ name: '', email: '', subject: '', description: '' });
    setFormErrors({});
    toast.success(t('supportToastSubmitted'), { description: t('supportToastSubmittedDesc') });
  };

  const updateFormField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="mx-auto max-w-3xl pb-12 pt-8 text-center">
          <motion.p
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {t('supportReady')}
          </motion.p>
          <motion.h1
            className="mb-5 text-4xl font-semibold leading-tight text-foreground sm:text-5xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            {t('supportTitle')}
          </motion.h1>
          <motion.p
            className="mx-auto mb-8 max-w-2xl text-lg leading-8 text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
          >
            {t('supportSubtitle')}
          </motion.p>
          <motion.div
            className="mx-auto max-w-2xl"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('supportSearchPlaceholder')}
                className="bg-card py-6 pl-12 text-lg"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </motion.div>
        </section>

        <section className="py-10">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('supportQuickGuide')}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map((link, index) => {
              const content = (
                <motion.div
                  className="group flex h-full flex-col items-center rounded-md border border-border bg-card p-6 text-center shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-colors hover:border-curator-brass/70"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  whileHover={{ y: -3 }}
                >
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-border bg-secondary text-curator-brass transition-colors group-hover:text-foreground">
                    <link.icon className="size-5" />
                  </div>
                  <div className="text-sm font-medium text-foreground">{link.title}</div>
                </motion.div>
              );

              return link.path.startsWith('/') ? (
                <Link key={link.title} to={link.path}>{content}</Link>
              ) : (
                <a
                  key={link.title}
                  href={link.path}
                  onClick={(event) => {
                    if (link.path === '#faq') {
                      event.preventDefault();
                      document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' });
                    } else if (link.path === '#') {
                      event.preventDefault();
                      toast.info(t('supportQuickForum'), { description: t('supportToastForumDesc') });
                    }
                  }}
                >
                  {content}
                </a>
              );
            })}
          </div>
        </section>

        <section className="py-14">
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('supportContactSection')}</p>
            <h2 className="text-3xl font-semibold text-foreground">{t('supportContactTitle')}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{t('supportContactDesc')}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {contactMethods.map((method, index) => (
              <motion.div
                key={method.id}
                className="rounded-md border border-border bg-card p-6 text-center shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-colors hover:border-curator-brass/70"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
                whileHover={{ y: -3 }}
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md border border-border bg-secondary text-curator-brass">
                  <method.icon className="size-7" />
                </div>
                <h3 className="mb-2 text-xl font-medium text-foreground">{method.title}</h3>
                <p className="mb-2 text-muted-foreground">{method.description}</p>
                <p className="mb-4 text-sm text-muted-foreground">{method.availability}</p>
                <Button className="w-full" onClick={() => handleContactAction(method)}>
                  {method.action}
                </Button>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="border-t border-border py-14" id="faq-section">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('supportFaqSection')}</p>
              <h2 className="text-3xl font-semibold text-foreground">{t('supportFaqTitle')}</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {searchQuery
                  ? t('supportFaqSearchResult', { query: searchQuery, count: filteredFaqs.length })
                  : t('supportFaqNoSearch')}
              </p>
            </div>
            {filteredFaqs.length > 0 ? (
              <Accordion type="single" collapsible className="space-y-3">
                {filteredFaqs.map((faq, index) => (
                  <motion.div
                    key={faq.question}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.06 }}
                  >
                    <AccordionItem
                      value={`item-${index}`}
                      className="rounded-md border border-border bg-card px-5 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-colors hover:border-curator-brass/70"
                    >
                      <AccordionTrigger className="text-left text-foreground hover:text-curator-brass">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  </motion.div>
                ))}
              </Accordion>
            ) : (
              <motion.div
                className="rounded-md border border-border bg-card p-8 text-center shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <HelpCircle className="mx-auto mb-4 size-12 text-curator-brass" />
                <p className="mb-4 text-muted-foreground">{t('supportNoMatch', { query: searchQuery })}</p>
                <Button variant="outline" onClick={() => setSearchQuery('')}>
                  {t('supportClearSearch')}
                </Button>
              </motion.div>
            )}
          </div>
        </section>

        <section className="py-14">
          <div className="mx-auto max-w-3xl">
            <div className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('supportRequestSection')}</p>
              <h2 className="text-3xl font-semibold text-foreground">{t('supportRequestTitle')}</h2>
              <p className="mt-3 text-sm text-muted-foreground">{t('supportRequestDesc')}</p>
            </div>
            <motion.form
              className="space-y-6 rounded-md border border-border bg-card p-6 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)]"
              onSubmit={handleFormSubmit}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label htmlFor="support-name" className="mb-2 block text-sm text-muted-foreground">{t('supportFormNameLabel')}</label>
                  <Input
                    id="support-name"
                    placeholder={t('supportFormNamePlaceholder')}
                    className={formErrors.name ? 'border-destructive' : ''}
                    value={formData.name}
                    onChange={(event) => updateFormField('name', event.target.value)}
                  />
                  {formErrors.name && <p className="mt-1 text-xs text-destructive">{formErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="support-email" className="mb-2 block text-sm text-muted-foreground">{t('supportFormEmailLabel')}</label>
                  <Input
                    id="support-email"
                    type="email"
                    placeholder={t('supportFormEmailPlaceholder')}
                    className={formErrors.email ? 'border-destructive' : ''}
                    value={formData.email}
                    onChange={(event) => updateFormField('email', event.target.value)}
                  />
                  {formErrors.email && <p className="mt-1 text-xs text-destructive">{formErrors.email}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="support-subject" className="mb-2 block text-sm text-muted-foreground">{t('supportFormSubjectLabel')}</label>
                <Input
                  id="support-subject"
                  placeholder={t('supportFormSubjectPlaceholder')}
                  className={formErrors.subject ? 'border-destructive' : ''}
                  value={formData.subject}
                  onChange={(event) => updateFormField('subject', event.target.value)}
                />
                {formErrors.subject && <p className="mt-1 text-xs text-destructive">{formErrors.subject}</p>}
              </div>
              <div>
                <label htmlFor="support-description" className="mb-2 block text-sm text-muted-foreground">{t('supportFormDescLabel')}</label>
                <Textarea
                  id="support-description"
                  placeholder={t('supportFormDescPlaceholder')}
                  rows={6}
                  className={formErrors.description ? 'border-destructive' : ''}
                  value={formData.description}
                  onChange={(event) => updateFormField('description', event.target.value)}
                />
                {formErrors.description && <p className="mt-1 text-xs text-destructive">{formErrors.description}</p>}
              </div>
              <Button type="submit" className="w-full py-6 text-lg" disabled={submitting}>
                {submitting ? t('supportFormSubmitting') : t('supportFormSubmit')}
              </Button>
            </motion.form>
          </div>
        </section>
      </div>
    </div>
  );
}
