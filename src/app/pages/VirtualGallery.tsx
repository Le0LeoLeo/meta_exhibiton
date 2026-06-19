import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, BarChart3, Blocks, Maximize2, Play, SlidersHorizontal, Sparkles, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { createGallery, getGalleryById } from '../api/gallery';
import { loadAuth } from '../api/auth';
import { GALLERY_TEMPLATES } from '../constants/galleryTemplates';
import { getTemplateSceneJson } from '../constants/gallerySceneTemplates';
import { useI18n } from '../components/I18nProvider';

export default function VirtualGallery() {
  const navigate = useNavigate();
  const { token } = loadAuth();
  const isLoggedIn = !!token;
  const myExhibitionsTarget = '/virtual-gallery/my-exhibitions';
  const { t } = useI18n();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinGalleryId, setJoinGalleryId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);

  const categories = ['All', ...Array.from(new Set(GALLERY_TEMPLATES.map((template) => template.category)))];
  const filteredTemplates =
    selectedCategory === 'All'
      ? GALLERY_TEMPLATES.filter((_, index) => index > 0)
      : GALLERY_TEMPLATES.filter((template, index) => index > 0 && template.category === selectedCategory);

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

  const handleStartCreate = () => {
    navigate(isLoggedIn ? myExhibitionsTarget : `/login?returnTo=${encodeURIComponent(myExhibitionsTarget)}`);
  };

  const handleJoinExhibition = async () => {
    const id = joinGalleryId.trim();
    if (!id) {
      toast.error('Please enter an exhibition ID');
      return;
    }

    if (!token) {
      navigate('/login?returnTo=' + encodeURIComponent(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(id)}`));
      return;
    }

    try {
      await getGalleryById(token, id);
      setJoinOpen(false);
      navigate(
        `/virtual-gallery/create?exhibitionId=${encodeURIComponent(id)}&roomId=${encodeURIComponent(`gallery:${id}`)}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gallery not found';
      toast.error('Unable to join exhibition', { description: message });
    }
  };

  const handleUseTemplate = async (template: (typeof GALLERY_TEMPLATES)[number]) => {
    setSelectedTemplate(template.title);

    if (!token) {
      navigate('/login?returnTo=' + encodeURIComponent(myExhibitionsTarget));
      return;
    }

    setIsCreatingFromTemplate(true);
    try {
      const sceneJson = getTemplateSceneJson(template.title);
      const result = await createGallery(token, {
        title: template.title,
        description: template.description,
        templateTitle: template.title,
        templateImage: template.image,
        category: template.category,
        ...(sceneJson ? { sceneJson } : {}),
      });

      toast.success(`Using "${template.title}" template`, { description: 'Opening editor...' });
      navigate(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(result.gallery.id)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to use template';
      toast.error('Failed to create template exhibition', { description: message });
    } finally {
      setIsCreatingFromTemplate(false);
    }
  };

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
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }} className="flex flex-wrap justify-center gap-3">
            <Button className="inline-flex items-center gap-2 bg-primary px-7 py-2.5 text-primary-foreground hover:bg-curator-brass" onClick={handleStartCreate}>
              {t('startCreatingGallery')}
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" className="inline-flex items-center gap-2 px-7 py-2.5" onClick={() => setJoinOpen(true)}>
              <Play className="size-4" />
              Join
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-20">
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-10 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('features')}</motion.p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div key={feature.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.4, delay: index * 0.07 }} className="group cursor-default rounded-md border border-border bg-card p-5 text-left shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition hover:-translate-y-0.5 hover:border-curator-brass/70">
              <motion.div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary text-curator-brass" whileHover={{ scale: 1.05 }}>
                <feature.icon className="size-4.5" />
              </motion.div>
              <h3 className="mb-1 text-sm font-medium text-card-foreground">{feature.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="border-y border-border bg-secondary/30">
        <div className="mx-auto max-w-2xl px-6 py-20">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-10 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('process')}</motion.p>
          <div className="space-y-3">
            {steps.map((item, index) => (
              <motion.div key={item.step} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: index * 0.1 }} className="relative flex items-start gap-4 rounded-md border border-border bg-card p-5 text-left shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition hover:-translate-y-0.5 hover:border-curator-brass/70">
                {index < steps.length - 1 && <span className="absolute left-[1.95rem] top-[3.2rem] h-[calc(100%+0.75rem)] border-l border-dashed border-border" />}
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

      <div className="mx-auto max-w-5xl px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mb-8 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('galleryTemplates')}</p>
          <h2 className="text-2xl font-semibold text-foreground">Featured gallery templates</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose a template to quickly start a virtual exhibition.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }} className="mb-8 flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                selectedCategory === category
                  ? 'border-curator-brass bg-card text-curator-brass'
                  : 'border-border bg-secondary text-muted-foreground hover:border-curator-brass/70 hover:text-foreground'
              }`}
            >
              {category}
            </button>
          ))}
        </motion.div>

        <motion.div layout className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredTemplates.map((template) => (
              <motion.article
                key={template.title}
                layout
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.35 }}
                className="group overflow-hidden rounded-md border border-border bg-card text-left shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition hover:-translate-y-0.5 hover:border-curator-brass/70"
              >
                <div className="relative h-48 overflow-hidden border-b border-border bg-secondary">
                  <ImageWithFallback
                    src={template.image}
                    alt={template.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute right-3 top-3 rounded border border-curator-brass/60 bg-card px-2 py-1 text-xs font-semibold uppercase tracking-wide text-curator-brass shadow-sm">
                    {template.category}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="mb-2 text-base font-medium text-card-foreground">{template.title}</h3>
                  <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-curator-brass"
                    disabled={isCreatingFromTemplate}
                    onClick={() => {
                      void handleUseTemplate(template);
                    }}
                  >
                    {isCreatingFromTemplate && selectedTemplate === template.title ? 'Creating...' : 'Use this template'}
                  </Button>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

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

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="border-border bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Join an exhibition</DialogTitle>
            <DialogDescription>Enter the exhibition ID shared with you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="join-exhibition-id" className="text-sm font-medium text-card-foreground">Exhibition ID</label>
            <Input
              id="join-exhibition-id"
              value={joinGalleryId}
              onChange={(event) => setJoinGalleryId(event.target.value)}
              placeholder="Example: c96a39b9-85d1-4207-a71e-636338c7ba1a"
              className="border-border bg-background"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleJoinExhibition();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">After validation, you will enter the shared exhibition room.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-curator-brass" onClick={() => void handleJoinExhibition()}>
              Join exhibition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
