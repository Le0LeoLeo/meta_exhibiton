import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, Blocks, Camera, Clock, Play, Scan, Sparkles, Trash2, Users } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { createGallery, getGalleryById } from '../api/gallery';
import { loadAuth } from '../api/auth';
import { GALLERY_TEMPLATES } from '../constants/galleryTemplates';
import { getDefaultGalleryAtmosphere, getTemplateSceneJson, type GalleryAtmosphere } from '../constants/gallerySceneTemplates';
import { GalleryAtmosphereSelector } from '../components/GalleryAtmosphereSelector';
import { useI18n } from '../components/I18nProvider';
import { useMobileDevice } from '../hooks/useMobileDevice';
import { GalleryTemplatePreview } from '../components/GalleryTemplatePreview';
import { authPageLink, parseGalleryJoin } from '../utils/galleryEntry';

const RECENT_KEY = 'metaexpo-recent-exhibitions';
const MAX_RECENT = 8;

type RecentEntry = { id: string; label: string; joinedAt: number };

function loadRecent(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

function saveRecent(list: RecentEntry[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

function pushRecent(id: string) {
  const list = loadRecent().filter((e) => e.id !== id);
  list.unshift({ id, label: id, joinedAt: Date.now() });
  saveRecent(list.slice(0, MAX_RECENT));
}

function removeRecent(id: string) {
  saveRecent(loadRecent().filter((e) => e.id !== id));
}

function displayId(raw: string): string {
  return raw.length > 16 ? raw.slice(0, 8) + '…' + raw.slice(-4) : raw;
}

export default function VirtualGallery() {
  const isMobile = useMobileDevice();
  const navigate = useNavigate();
  const { token } = loadAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTemplate = searchParams.get('template');
  const requestedAtmosphere = searchParams.get('atmosphere');
  const [atmosphereOverride, setAtmosphereOverride] = useState<{ title: string; value: GalleryAtmosphere } | null>(null);
  const previewTemplate = GALLERY_TEMPLATES.find((template) => template.title === requestedTemplate && getTemplateSceneJson(template.title));
  const { t } = useI18n();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(() => Math.max(0, GALLERY_TEMPLATES.slice(1).findIndex((template) => template.title === requestedTemplate)));
  const reduceMotion = useReducedMotion();
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinGalleryId, setJoinGalleryId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);
  const [recentList, setRecentList] = useState<RecentEntry[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const scanningActive = useRef(false);
  const scanStream = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanTid = useRef<number>(0);

  // Refresh history when dialog opens
  useEffect(() => {
    if (joinOpen) setRecentList(loadRecent());
  }, [joinOpen]);

  const stopScanner = useCallback(() => {
    scanningActive.current = false;
    clearTimeout(scanTid.current);
    scanStream.current?.getTracks().forEach((track) => track.stop());
    scanStream.current = null;
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!('BarcodeDetector' in window)) {
      toast.error(t('vgQrUnsupported'));
      return;
    }
    scanningActive.current = true;
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (!scanningActive.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      scanStream.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const BarcodeDetectorClass = (window as Window & {
        BarcodeDetector: new (options: { formats: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
        };
      }).BarcodeDetector;
      const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
      const tick = async () => {
        if (!videoRef.current || !scanningActive.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          for (const b of barcodes) {
            const target = parseGalleryJoin(b.rawValue, window.location.origin);
            const id = target ? b.rawValue.trim() : null;
            if (id) {
              stopScanner();
              setJoinGalleryId(id);
              setIsScanning(false);
              toast.success(t('vgQrDetected', { id: displayId(id) }));
              return;
            }
          }
        } catch { /* detection frame failed, retry */ }
        scanTid.current = window.setTimeout(tick, 400);
      };
      tick();
    } catch {
      toast.error(t('vgQrDenied'));
      setIsScanning(false);
    }
  }, [t, stopScanner]);

  // Cleanup scanner on unmount
  useEffect(() => stopScanner, [stopScanner]);

  const categories = ['All', ...Array.from(new Set(GALLERY_TEMPLATES.slice(1).map((template) => template.category)))];
  const filteredTemplates =
    selectedCategory === 'All'
      ? GALLERY_TEMPLATES.filter((_, index) => index > 0)
      : GALLERY_TEMPLATES.filter((template, index) => index > 0 && template.category === selectedCategory);
  const activeTemplate = filteredTemplates[activeTemplateIndex];
  const atmosphereFor = (title: string): GalleryAtmosphere => {
    if (requestedTemplate === title && (requestedAtmosphere === 'bright' || requestedAtmosphere === 'spotlight' || requestedAtmosphere === 'warm')) return requestedAtmosphere;
    return atmosphereOverride?.title === title ? atmosphereOverride.value : getDefaultGalleryAtmosphere(title);
  };
  const atmosphere = atmosphereFor(previewTemplate?.title ?? activeTemplate?.title ?? '');
  const selectTemplate = (index: number) => {
    if (index !== activeTemplateIndex) setAtmosphereOverride(null);
    setActiveTemplateIndex(index);
  };
  const moveTemplate = (direction: number) => selectTemplate(
    (activeTemplateIndex + direction + filteredTemplates.length) % filteredTemplates.length);
  const closeTemplatePreview = () => {
    if (previewTemplate) setAtmosphereOverride({ title: previewTemplate.title, value: atmosphereFor(previewTemplate.title) });
    setSearchParams({});
  };

  const features = [
    { icon: Blocks, title: t('vgFeature1Title'), desc: t('vgFeature1Desc') },
    { icon: Users, title: t('vgFeature4Title'), desc: t('vgFeature4Desc') },
    { icon: Sparkles, title: t('vgFeature6Title'), desc: t('vgFeature6Desc') },
  ];

  const steps = [
    { step: '01', title: t('vgStep1Title'), desc: t('vgStep1Desc') },
    { step: '02', title: t('vgStep2Title'), desc: t('vgStep2Desc') },
    { step: '03', title: t('vgStep3Title'), desc: t('vgStep3Desc') },
  ];

  // Template → i18n key mapping for display translation
  const templateKeyMap: Record<string, string> = {
    '空白展覽': 'vgTemplateBlank',
    '現代藝術畫廊': 'vgTemplateModernArt',
    '科技展示廳': 'vgTemplateTech',
    '歷史博物館': 'vgTemplateMuseum',
    '時尚展示間': 'vgTemplateFashion',
    '攝影作品展': 'vgTemplatePhoto',
    '汽車展示廳': 'vgTemplateCar',
  };
  const catKeyMap: Record<string, string> = {
    'All': 'entryCategoryAll',
    '未分類': 'vgCatUncategorized',
    '藝術': 'vgCatArt',
    '商業': 'vgCatBusiness',
    '文化': 'vgCatCulture',
    '時尚': 'vgCatFashion',
  };
  const tCat = (cat: string) => catKeyMap[cat] ? t(catKeyMap[cat]) : cat;
  const tTitle = (title: string) => templateKeyMap[title] ? t(templateKeyMap[title] + 'Title') : title;
  const tDesc = (title: string) => templateKeyMap[title] ? t(templateKeyMap[title] + 'Desc') : title;

  const doJoin = async (input: string) => {
    const target = parseGalleryJoin(input, window.location.origin);
    if (!target) {
      toast.error(t('entryJoinInvalid'));
      return;
    }
    if (target.kind !== 'gallery') {
      stopScanner();
      setJoinOpen(false);
      navigate(target.path);
      return;
    }
    const { id } = target;
    const destination = `/virtual-gallery/create?exhibitionId=${encodeURIComponent(id)}&roomId=${encodeURIComponent(`gallery:${id}`)}${isMobile || target.viewOnly ? '&share=view' : ''}`;
    if (!token) {
      navigate(authPageLink('login', destination));
      return;
    }
    try {
      await getGalleryById(token, id);
      pushRecent(id);
      stopScanner();
      setJoinOpen(false);
      setJoinGalleryId('');
      navigate(destination);
    } catch {
      toast.error(t('vgJoinFail'), { description: t('entryJoinUnavailable') });
    }
  };

  const handleJoinExhibition = () => { void doJoin(joinGalleryId); };

  const handleUseTemplate = async (template: (typeof GALLERY_TEMPLATES)[number]) => {
    if (isMobile || isCreatingFromTemplate || !getTemplateSceneJson(template.title)) return;
    setSelectedTemplate(template.title);
    const atmosphere = atmosphereFor(template.title);

    if (!token) {
      navigate(authPageLink('login', `/virtual-gallery?template=${encodeURIComponent(template.title)}&atmosphere=${atmosphere}`));
      return;
    }

    setIsCreatingFromTemplate(true);
    try {
      const sceneJson = getTemplateSceneJson(template.title, atmosphere);
      const result = await createGallery(token, {
        title: tTitle(template.title),
        description: tDesc(template.title),
        templateTitle: template.title,
        templateImage: template.image,
        category: template.category,
        ...(sceneJson ? { sceneJson } : {}),
      });

      toast.success(t('vgUsingTemplate', { title: tTitle(template.title) }), { description: t('vgOpeningEditor') });
      navigate(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(result.gallery.id)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('vgTemplateFail');
      toast.error(t('vgTemplateCreateFail'), { description: message });
    } finally {
      setIsCreatingFromTemplate(false);
    }
  };

  return (
    <div className="museum-template-page min-h-screen bg-background">
      <div className="relative overflow-hidden border-b border-border bg-background">
        <div className="museum-page-heading">
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
            <Button asChild className="inline-flex min-h-11 items-center gap-2 bg-primary px-7 py-2.5 text-primary-foreground hover:bg-curator-brass">
              <Link to="/virtual-gallery/quick-create">
                {t('quickExhibitionCreateAction')}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" className="inline-flex items-center gap-2 px-7 py-2.5" onClick={() => setJoinOpen(true)}>
              <Play className="size-4" />
              {t('vgJoinBtn')}
            </Button>
            <Button asChild variant="outline" className="inline-flex items-center gap-2 px-7 py-2.5">
              <Link to="/virtual-gallery/my-exhibitions">
                <Blocks className="size-4" />
                {t('myExhibitions')}
              </Link>
            </Button>
          </motion.div>
          {!token && <p className="mt-4 text-sm text-muted-foreground">{t('entryCreateLoginHint')} <Link to="/demo" className="font-medium text-foreground underline underline-offset-4">{t('entryDemoAction')}</Link></p>}
        </div>
      </div>

      <section className="overflow-hidden py-16" aria-labelledby="template-showcase-title">
        <div className="mx-auto mb-8 max-w-3xl px-6 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('galleryTemplates')}</p>
          <h2 id="template-showcase-title" className="text-4xl text-foreground sm:text-5xl">{t('vgFeaturedTemplates')}</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('entryTemplatesDescription')}</p>
        </div>

        <div className="mb-8 flex flex-wrap justify-center gap-2 px-6">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={selectedCategory === category}
              onClick={() => { setSelectedCategory(category); setActiveTemplateIndex(0); setAtmosphereOverride(null); }}
              className={`min-h-11 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                selectedCategory === category
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              {tCat(category)}
            </button>
          ))}
        </div>

        <div className="relative mx-auto" style={{ width: 'min(84vw, 680px)', height: 'calc(min(47.25vw, 382.5px) + 84px)' }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            moveTemplate(event.key === 'ArrowLeft' ? -1 : 1);
          }}>
          {filteredTemplates.map((template, index) => {
            let offset = (index - activeTemplateIndex + filteredTemplates.length) % filteredTemplates.length;
            if (offset > filteredTemplates.length / 2) offset -= filteredTemplates.length;
            const active = index === activeTemplateIndex;
            return (
              <motion.button
                key={template.title}
                type="button"
                aria-label={tTitle(template.title)}
                aria-pressed={active}
                onClick={() => selectTemplate(index)}
                onFocus={() => selectTemplate(index)}
                className={`absolute left-0 top-0 w-full overflow-hidden rounded-lg border bg-card text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${active ? 'border-curator-brass/70' : 'border-border hover:border-curator-brass/50'}`}
                style={{ zIndex: 10 - Math.abs(offset) }}
                initial={false}
                animate={{ x: `${offset * 104}%`, opacity: Math.abs(offset) > 2 ? 0 : active ? 1 : 0.8 }}
                transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <ImageWithFallback src={template.image} alt="" className="aspect-video w-full bg-secondary object-contain" />
                <span className="flex h-[84px] items-center justify-between gap-4 px-5 py-4 text-card-foreground">
                  <span>
                    <span className="block text-xs text-muted-foreground">{tCat(template.category)}</span>
                    <span className="mt-1 block text-lg font-medium">{tTitle(template.title)}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="mx-auto max-w-xl px-6 pt-8 text-center">
          <div className="mb-5 flex items-center justify-center gap-5">
            <Button variant="outline" size="icon" className="min-h-11 min-w-11 rounded-full" aria-label={t('demoPrevious')} disabled={filteredTemplates.length < 2} onClick={() => moveTemplate(-1)}>
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Button>
            <span className="text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">{String(activeTemplateIndex + 1).padStart(2, '0')} / {String(filteredTemplates.length).padStart(2, '0')}</span>
            <Button variant="outline" size="icon" className="min-h-11 min-w-11 rounded-full" aria-label={t('demoNext')} disabled={filteredTemplates.length < 2} onClick={() => moveTemplate(1)}>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
          {activeTemplate && <div>
            <h3 className="text-2xl font-medium text-foreground">{tTitle(activeTemplate.title)}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{tDesc(activeTemplate.title)}</p>
            <p className="my-4 text-xs text-muted-foreground">{getTemplateSceneJson(activeTemplate.title) ? t('entryTemplateAvailable') : t('entryComingSoon')}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {getTemplateSceneJson(activeTemplate.title) && <Button variant="outline" className="min-h-11 px-7" onClick={() => setSearchParams({ template: activeTemplate.title, atmosphere })}>
                {t('entryPreviewTemplate')}
              </Button>}
              <Button className="min-h-11 bg-primary px-7 text-primary-foreground hover:bg-curator-brass"
                disabled={isMobile || isCreatingFromTemplate || !getTemplateSceneJson(activeTemplate.title)}
                onClick={() => { void handleUseTemplate(activeTemplate); }}>
                {!getTemplateSceneJson(activeTemplate.title) ? t('entryComingSoon') : isMobile ? t('mobileEditorDesktopRequired') : isCreatingFromTemplate && selectedTemplate === activeTemplate.title ? t('vgCreating') : t('vgUseTemplate')}
              </Button>
            </div>
          </div>}
        </div>
      </section>

      <div className="relative overflow-hidden border-t border-border bg-secondary/40">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="mb-3 text-2xl font-semibold text-foreground">{t('vgCtaTitle')}</h2>
          <p className="mb-8 text-muted-foreground">{t(token ? 'quickExhibitionSubtitle' : 'vgCtaDesc')}</p>
          <Link to={token ? '/virtual-gallery/quick-create' : '/register?returnTo=%2Fvirtual-gallery%2Fquick-create'}>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="inline-flex items-center gap-2 bg-primary px-7 py-2.5 font-medium text-primary-foreground hover:bg-curator-brass">
                {t(token ? 'quickExhibitionCreateAction' : 'registerNow')}
                <ArrowRight className="size-4" />
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-20">
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-10 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('vgFeatures')}</motion.p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div key={feature.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.4, delay: index * 0.07 }} className="museum-template-features">
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
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-10 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('vgUsageProcess')}</motion.p>
          <div className="space-y-3">
            {steps.map((item, index) => (
              <motion.div key={item.step} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: index * 0.1 }} className="relative flex items-start gap-4 rounded-md border border-border bg-card p-5 text-left transition hover:border-curator-brass/70">
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

      <Dialog open={Boolean(previewTemplate)} onOpenChange={(open) => { if (!open) closeTemplatePreview(); }}>
        <DialogContent className="max-h-[90vh] min-w-0 overflow-x-hidden overflow-y-auto border-border bg-card sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewTemplate ? tTitle(previewTemplate.title) : ''}</DialogTitle>
            <DialogDescription>{t('entryTemplateAvailable')}</DialogDescription>
          </DialogHeader>
          <GalleryAtmosphereSelector value={atmosphere} disabled={isCreatingFromTemplate} onChange={(value) => setSearchParams({ template: previewTemplate!.title, atmosphere: value }, { replace: true })} />
          {previewTemplate && <GalleryTemplatePreview key={previewTemplate.title} title={previewTemplate.title} atmosphere={atmosphere} />}
          <p className="text-sm text-muted-foreground">{t('entryTemplateLoginHint')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={closeTemplatePreview}>{t('cancel')}</Button>
            <Button disabled={isMobile || isCreatingFromTemplate} onClick={() => { if (previewTemplate) void handleUseTemplate(previewTemplate); }}>
              {isMobile ? t('mobileEditorDesktopRequired') : isCreatingFromTemplate ? t('vgCreating') : t('vgUseTemplate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={(open) => { if (!open) stopScanner(); setJoinOpen(open); }}>
        <DialogContent className="border-border bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('vgJoinTitle')}</DialogTitle>
            <DialogDescription>{t('entryJoinDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Input + QR scan row */}
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <label htmlFor="join-exhibition-id" className="text-sm font-medium text-card-foreground">{t('entryJoinLabel')}</label>
                <div className="relative">
                  <Input
                    id="join-exhibition-id"
                    value={joinGalleryId}
                    onChange={(event) => setJoinGalleryId(event.target.value)}
                    placeholder={t('entryJoinPlaceholder')}
                    className="border-border bg-background pr-10"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleJoinExhibition();
                      }
                    }}
                  />
                  {'BarcodeDetector' in window && !isScanning && (
                    <button
                      type="button"
                      onClick={() => void startScanner()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      aria-label={t('vgQrScanLabel')}
                    >
                      <Scan className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{t('entryJoinHint')}</p>

            {/* QR scanner video */}
            {isScanning && (
              <div className="relative overflow-hidden rounded-md border border-border bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="h-48 w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-32 w-32 rounded-lg border-2 border-cyan-400/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <Camera className="size-4 text-white" />
                  <span className="text-xs text-white/80">{t('vgQrHint')}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopScanner}
                  className="absolute right-2 top-2 border-white/20 bg-black/50 text-white hover:bg-black/70"
                >
                  {t('cancel')}
                </Button>
              </div>
            )}

            {/* Recent exhibitions */}
            {recentList.length > 0 && !isScanning && (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock className="size-3" />
                  <span>{t('vgRecent')}</span>
                </div>
                <div className="space-y-1">
                  {recentList.map((entry) => (
                    <div
                      key={entry.id}
                      className="group flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm transition hover:border-curator-brass/50"
                    >
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-2 text-left"
                        onClick={() => { setJoinGalleryId(entry.id); void doJoin(entry.id); }}
                      >
                        <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                        <code className="font-mono text-xs text-card-foreground">{displayId(entry.id)}</code>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeRecent(entry.id); setRecentList(loadRecent()); }}
                        className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                        aria-label={t('vgRemoveRecent')}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { stopScanner(); setJoinOpen(false); }}>
              {t('cancel')}
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-curator-brass" onClick={() => void handleJoinExhibition()}>
              {t('vgJoinConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

