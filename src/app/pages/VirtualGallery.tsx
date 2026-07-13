import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, BarChart3, Blocks, Camera, Clock, Maximize2, Play, Scan, SlidersHorizontal, Sparkles, Trash2, Users } from 'lucide-react';
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

/** Parse a QR code / pasted value into an exhibition ID */
function extractExhibitionId(input: string): string | null {
  const s = input.trim();
  // Plain UUID (c96a39b9-85d1-4207-a71e-636338c7ba1a)
  if (/^[0-9a-fA-F-]{32,}$/.test(s) || /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}/.test(s)) return s;
  // URL: /exhibition/xxx  or  ?exhibitionId=xxx
  try {
    const u = new URL(s);
    const fromPath = u.pathname.match(/\/exhibition\/([^/?#]+)/i)?.[1];
    if (fromPath) return decodeURIComponent(fromPath);
    const fromQuery = u.searchParams.get('exhibitionId') || u.searchParams.get('id');
    if (fromQuery) return fromQuery;
  } catch { /* not a URL */ }
  // metaexpo://exhibition/xxx
  const scheme = s.match(/^metaexpo:\/\/exhibition\/([^/?#]+)/i)?.[1];
  if (scheme) return scheme;
  // Last resort: assume it's the ID
  return s || null;
}

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
  const [recentList, setRecentList] = useState<RecentEntry[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanTid = useRef<number>(0);

  // Refresh history when dialog opens
  useEffect(() => {
    if (joinOpen) setRecentList(loadRecent());
  }, [joinOpen]);

  const startScanner = useCallback(async () => {
    if (!('BarcodeDetector' in window)) {
      toast.error(t('vgQrUnsupported'));
      return;
    }
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;

      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!videoRef.current || !isScanning) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          for (const b of barcodes) {
            const id = extractExhibitionId(b.rawValue);
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
  }, [isScanning]);

  const stopScanner = useCallback(() => {
    clearTimeout(scanTid.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => stopScanner, []);

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
    '未分類': 'vgCatUncategorized',
    '藝術': 'vgCatArt',
    '商業': 'vgCatBusiness',
    '文化': 'vgCatCulture',
    '時尚': 'vgCatFashion',
  };
  const tCat = (cat: string) => catKeyMap[cat] ? t(catKeyMap[cat]) : cat;
  const tTitle = (title: string) => templateKeyMap[title] ? t(templateKeyMap[title] + 'Title') : title;
  const tDesc = (title: string) => templateKeyMap[title] ? t(templateKeyMap[title] + 'Desc') : title;

  const handleStartCreate = () => {
    navigate(isLoggedIn ? myExhibitionsTarget : `/login?returnTo=${encodeURIComponent(myExhibitionsTarget)}`);
  };

  const doJoin = async (id: string) => {
    if (!id) {
      toast.error(t('vgJoinIdRequired'));
      return;
    }
    if (!token) {
      navigate('/login?returnTo=' + encodeURIComponent(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(id)}`));
      return;
    }
    try {
      await getGalleryById(token, id);
      pushRecent(id);
      setJoinOpen(false);
      setJoinGalleryId('');
      navigate(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(id)}&roomId=${encodeURIComponent(`gallery:${id}`)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('vgGalleryNotFound');
      toast.error(t('vgJoinFail'), { description: message });
    }
  };

  const handleJoinExhibition = () => { void doJoin(joinGalleryId); };

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

      toast.success(t('vgUsingTemplate', { title: template.title }), { description: t('vgOpeningEditor') });
      navigate(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(result.gallery.id)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('vgTemplateFail');
      toast.error(t('vgTemplateCreateFail'), { description: message });
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
              {t('vgJoinBtn')}
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-20">
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-10 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('vgFeatures')}</motion.p>
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
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-10 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('vgUsageProcess')}</motion.p>
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
          <h2 className="text-2xl font-semibold text-foreground">{t('vgFeaturedTemplates')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('vgTemplateDesc')}</p>
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
              {tCat(category)}
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
                    alt={tTitle(template.title)}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute right-3 top-3 rounded border border-curator-brass/60 bg-card px-2 py-1 text-xs font-semibold uppercase tracking-wide text-curator-brass shadow-sm">
                    {tCat(template.category)}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="mb-2 text-base font-medium text-card-foreground">{tTitle(template.title)}</h3>
                  <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{tDesc(template.title)}</p>
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-curator-brass"
                    disabled={isCreatingFromTemplate}
                    onClick={() => {
                      void handleUseTemplate(template);
                    }}
                  >
                    {isCreatingFromTemplate && selectedTemplate === template.title ? t('vgCreating') : t('vgUseTemplate')}
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

      <Dialog open={joinOpen} onOpenChange={(open) => { if (!open) stopScanner(); setJoinOpen(open); }}>
        <DialogContent className="border-border bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('vgJoinTitle')}</DialogTitle>
            <DialogDescription>{t('vgJoinDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Input + QR scan row */}
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <label htmlFor="join-exhibition-id" className="text-sm font-medium text-card-foreground">{t('vgJoinIdLabel')}</label>
                <div className="relative">
                  <Input
                    id="join-exhibition-id"
                    value={joinGalleryId}
                    onChange={(event) => setJoinGalleryId(event.target.value)}
                    placeholder={t('vgJoinIdPlaceholder')}
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

            <p className="text-xs text-muted-foreground">{t('vgJoinHint')}</p>

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
