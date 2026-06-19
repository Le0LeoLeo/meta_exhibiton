import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Plus, Pencil, Calendar, ArrowRight, Loader2, RefreshCw, Share2, Trash2, Globe, Eye, Trophy, BarChart3 } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  createCompetition,
  createGallery,
  deleteGalleryById,
  getMyCompetitionEntries,
  getMyHostedCompetitions,
  getMyGalleries,
  loadAuth,
  publishGalleryById,
  unpublishGalleryById,
  updateGalleryById,
  type Competition,
  type CompetitionEntry,
  type GallerySummary,
} from '../api/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { CREATE_GALLERY_TEMPLATE_TITLES, GALLERY_TEMPLATES } from '../constants/galleryTemplates';
import { getTemplateSceneJson } from '../constants/gallerySceneTemplates';
import { useI18n } from '../components/I18nProvider';

export default function MyExhibitions() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [items, setItems] = useState<GallerySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareGalleryId, setShareGalleryId] = useState<string | null>(null);
  const [editingGalleryId, setEditingGalleryId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteGallery, setDeleteGallery] = useState<GallerySummary | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [selectedTemplateTitle, setSelectedTemplateTitle] = useState(t('blankExhibition'));
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishGallery, setPublishGallery] = useState<GallerySummary | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [myCompetitionEntries, setMyCompetitionEntries] = useState<CompetitionEntry[]>([]);
  const [hostCompetitionEnabled, setHostCompetitionEnabled] = useState(false);
  const [competitionTitle, setCompetitionTitle] = useState('');
  const [competitionDescription, setCompetitionDescription] = useState('');
  const [competitionRules, setCompetitionRules] = useState('');
  const [competitionIsPublic, setCompetitionIsPublic] = useState(true);
  const [competitionRegistrationDeadline, setCompetitionRegistrationDeadline] = useState('');
  const [competitionVotingDeadline, setCompetitionVotingDeadline] = useState('');

  const createTemplates = GALLERY_TEMPLATES.filter((template) => CREATE_GALLERY_TEMPLATE_TITLES.includes(template.title as (typeof CREATE_GALLERY_TEMPLATE_TITLES)[number]));
  const sortedItems = useMemo(() => [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [items]);

  const fetchMyExhibitions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { token } = loadAuth();
      if (!token) {
        navigate('/login?returnTo=' + encodeURIComponent('/virtual-gallery/my-exhibitions'));
        return;
      }
      const [galleryResult, hostedCompetitionResult, myEntriesResult] = await Promise.all([getMyGalleries(token), getMyHostedCompetitions(token), getMyCompetitionEntries(token)]);
      setItems(Array.isArray(galleryResult.galleries) ? galleryResult.galleries : []);
      setCompetitions(Array.isArray(hostedCompetitionResult.competitions) ? hostedCompetitionResult.competitions : []);
      setMyCompetitionEntries(Array.isArray(myEntriesResult.entries) ? myEntriesResult.entries : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('loadMyExhibitionsFailed');
      setError(message);
      toast.error(t('cannotLoadMyExhibitions'), { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void fetchMyExhibitions(); }, []);

  const handleCreateNew = () => { setNewTitle(''); setSelectedTemplateTitle(t('blankExhibition')); setCreateOpen(true); };
  const handleConfirmCreate = async () => {
    const title = newTitle.trim();
    if (!title) return toast.error(t('pleaseEnterExhibitionName'));
    const selectedTemplate = createTemplates.find((t2) => t2.title === selectedTemplateTitle) ?? createTemplates[0];
    setIsCreating(true);
    try {
      const { token } = loadAuth();
      if (!token) return navigate('/login?returnTo=' + encodeURIComponent('/virtual-gallery/my-exhibitions'));
      const sceneJson = getTemplateSceneJson(selectedTemplate.title);
      const result = await createGallery(token, { title, description: selectedTemplate.description, templateTitle: selectedTemplate.title, templateImage: selectedTemplate.image, category: selectedTemplate.category, ...(sceneJson ? { sceneJson } : {}) });
      setCreateOpen(false);
      toast.success(t('createdNewExhibition'), { description: `「${title}」${t('addedToMyList')}` });
      navigate(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(result.gallery.id)}`);
    } catch (err) {
      toast.error(t('createExhibitionFailed'), { description: err instanceof Error ? err.message : t('tryAgainLater') });
    } finally { setIsCreating(false); }
  };

  const handleStartInlineEdit = (gallery: GallerySummary) => { setEditingGalleryId(gallery.id); setEditTitle(gallery.title); setEditDescription(gallery.description || ''); };
  const handleCancelInlineEdit = () => { setEditingGalleryId(null); setEditTitle(''); setEditDescription(''); setSavingEditId(null); };
  const handleSaveInlineEdit = async (gallery: GallerySummary) => {
    const title = editTitle.trim();
    const description = editDescription.trim();
    if (!title) return toast.error(t('pleaseEnterExhibitionName'));
    const { token } = loadAuth();
    if (!token) return navigate('/login?returnTo=' + encodeURIComponent('/virtual-gallery/my-exhibitions'));
    setSavingEditId(gallery.id);
    try {
      const result = await updateGalleryById(token, gallery.id, { title, description });
      setItems((prev) => prev.map((item) => (item.id === gallery.id ? result.gallery : item)));
      toast.success(t('updatedExhibitionInfo'), { description: `「${title}」` });
      handleCancelInlineEdit();
    } catch (err) { toast.error(t('updateExhibitionInfoFailed'), { description: err instanceof Error ? err.message : t('tryAgainLater') }); } finally { setSavingEditId(null); }
  };
  const handleOpenDelete = (gallery: GallerySummary) => { setDeleteGallery(gallery); setDeleteOpen(true); };
  const handleConfirmDelete = async () => {
    if (!deleteGallery) return; setIsDeleting(true);
    try { const { token } = loadAuth(); if (!token) return navigate('/login?returnTo=' + encodeURIComponent('/virtual-gallery/my-exhibitions')); await deleteGalleryById(token, deleteGallery.id); setItems((prev) => prev.filter((g) => g.id !== deleteGallery.id)); setDeleteOpen(false); toast.success(t('deletedExhibition'), { description: `「${deleteGallery.title}」` }); setDeleteGallery(null); } catch (err) { toast.error(t('deleteExhibitionFailed'), { description: err instanceof Error ? err.message : t('tryAgainLater') }); } finally { setIsDeleting(false); }
  };

  const handleTogglePublish = async (gallery: GallerySummary) => {
    if (gallery.isPublished) {
      const { token } = loadAuth(); if (!token) return navigate('/login?returnTo=' + encodeURIComponent('/virtual-gallery/my-exhibitions'));
      setPublishingId(gallery.id);
      try { const result = await unpublishGalleryById(token, gallery.id); setItems((prev) => prev.map((item) => (item.id === gallery.id ? result.gallery : item))); toast.success(t('unpublishedExhibition'), { description: `「${gallery.title}」${t('removedFromPublicExhibitions')}` }); } catch (err) { toast.error(t('unpublishFailed'), { description: err instanceof Error ? err.message : t('tryAgainLater') }); } finally { setPublishingId(null); }
      return;
    }
    setPublishGallery(gallery);
    const existingHostedCompetition = competitions.find((competition) => competition.hostGalleryId === gallery.id);
    setHostCompetitionEnabled(Boolean(existingHostedCompetition));
    setCompetitionTitle(existingHostedCompetition?.title || `${gallery.title} ${t('competitionSuffix')}`);
    setCompetitionDescription(existingHostedCompetition?.description || gallery.description || '');
    setCompetitionRules(existingHostedCompetition?.rules || t('defaultCompetitionRules'));
    setCompetitionIsPublic(existingHostedCompetition?.isPublic ?? true);
    setCompetitionRegistrationDeadline(existingHostedCompetition ? existingHostedCompetition.registrationDeadline.slice(0, 16) : '');
    setCompetitionVotingDeadline(existingHostedCompetition?.votingDeadline ? existingHostedCompetition.votingDeadline.slice(0, 16) : '');
    setPublishOpen(true);
  };

  const copy = async (text: string, ok: string) => { try { await navigator.clipboard.writeText(text); toast.success(ok); } catch { toast.error(t('copyFailed'), { description: t('pleaseCopyManually') }); } };
  const handleCopyEditShare = async () => {
    if (!shareGalleryId) return;
    await copy(
      `${window.location.origin}/virtual-gallery/create?exhibitionId=${encodeURIComponent(shareGalleryId)}`,
      t('copiedEditShareLink'),
    );
  };
  const handleCopyViewShare = async () => {
    if (!shareGalleryId) return;
    await copy(
      `${window.location.origin}/virtual-gallery/create?exhibitionId=${encodeURIComponent(shareGalleryId)}&share=view`,
      t('copiedViewShareLink'),
    );
  };

  const handleConfirmPublish = async () => {
    if (!publishGallery) return;
    const { token } = loadAuth(); if (!token) return navigate('/login?returnTo=' + encodeURIComponent('/virtual-gallery/my-exhibitions'));
    setPublishingId(publishGallery.id);
    try {
      const result = await publishGalleryById(token, publishGallery.id);
      setItems((prev) => prev.map((item) => (item.id === publishGallery.id ? result.gallery : item)));
      let hosted = false;
      const existingHostedCompetition = competitions.find((competition) => competition.hostGalleryId === publishGallery.id);
      if (hostCompetitionEnabled && !existingHostedCompetition) {
        if (!competitionTitle.trim() || !competitionDescription.trim() || !competitionRules.trim() || !competitionRegistrationDeadline.trim()) throw new Error(t('completeCompetitionInfo'));
        const created = await createCompetition(token, { hostGalleryId: publishGallery.id, title: competitionTitle.trim(), description: competitionDescription.trim(), rules: competitionRules.trim(), coverImage: publishGallery.templateImage || null, isPublic: competitionIsPublic, registrationDeadline: new Date(competitionRegistrationDeadline).toISOString(), votingDeadline: competitionVotingDeadline.trim() ? new Date(competitionVotingDeadline).toISOString() : null, status: 'open' });
        setCompetitions((prev) => [created.competition, ...prev]); hosted = true;
      }
      setPublishOpen(false);
      toast.success(t('publishedExhibition'), { description: hosted ? `「${publishGallery.title}」${t('publishedAndHostedCompetition')}` : `「${publishGallery.title}」${t('nowPubliclyViewable')}` });
    } catch (err) { toast.error(t('publishFailed'), { description: err instanceof Error ? err.message : t('tryAgainLater') }); } finally { setPublishingId(null); }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground transition-colors duration-300 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-10 text-balance">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('manageExhibitions')}</p>
          <h1 className="text-3xl font-semibold text-foreground">{t('myExhibitionsTitle')}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{t('myExhibitionsSubtitle')}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mb-8 rounded-md border border-border bg-card p-6 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="mb-1 text-2xl font-semibold text-foreground">{t('createNewExhibition')}</h2>
              <p className="text-muted-foreground">{t('createNewExhibitionDesc')}</p>
            </div>
            <Button onClick={handleCreateNew}><Plus className="mr-2 size-4" />{t('newExhibition')}</Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="rounded-md border border-border bg-card shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-6">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">{t('manageExhibitions')}</h2>
              <p className="mt-1 text-muted-foreground">{t('manageExhibitionsDesc')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate('/admin/exhibitions')}><BarChart3 className="mr-2 size-4" />數據後台</Button>
              <Button variant="outline" onClick={fetchMyExhibitions} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}{t('refresh')}</Button>
            </div>
          </div>

          {isLoading ? <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t('loadingExhibitions')}</div> : error ? <div className="p-8 text-destructive">{error}</div> : sortedItems.length === 0 ? <div className="p-6 text-muted-foreground">{t('noExhibitionsYet')}</div> : <div className="divide-y divide-border">{sortedItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="h-20 w-28 flex-shrink-0 overflow-hidden rounded-md border border-border bg-secondary"><ImageWithFallback src={item.templateImage || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80'} alt={item.title} className="h-full w-full object-cover" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">{editingGalleryId === item.id ? <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={t('enterExhibitionName')} className="h-9 max-w-md" maxLength={120} disabled={savingEditId === item.id} /> : <p className="truncate text-lg font-medium text-foreground">{item.title}</p>}<span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${item.isPublished ? 'border-curator-brass/60 text-curator-brass' : 'border-border text-muted-foreground'}`}>{item.isPublished ? t('published') : t('unpublished')}</span></div>
                    {editingGalleryId === item.id ? <div className="mt-3 max-w-2xl space-y-2"><label className="block text-xs font-medium text-muted-foreground">{t('exhibitionDescription')}</label><textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder={t('enterExhibitionDescription')} className="min-h-[84px] w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-curator-brass focus:ring-2 focus:ring-curator-brass/30" disabled={savingEditId === item.id} /><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void handleSaveInlineEdit(item)} disabled={savingEditId === item.id}>{savingEditId === item.id ? t('saving') : t('saveInfo')}</Button><Button size="sm" variant="outline" onClick={handleCancelInlineEdit} disabled={savingEditId === item.id}>{t('cancel')}</Button></div></div> : item.description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{item.description}</p> : <p className="mt-2 text-sm text-muted-foreground">{t('noDescriptionYet')}</p>}
                    <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground"><Calendar className="size-4" />{t('lastUpdated')}：{new Date(item.updatedAt).toLocaleString('zh-Hant')}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">{/* actions */}
                  <Button variant={item.isPublished ? 'outline' : 'default'} className={item.isPublished ? '' : 'bg-success-quiet text-white hover:bg-curator-brass'} onClick={() => void handleTogglePublish(item)} disabled={publishingId === item.id}><Globe className="mr-2 size-4" />{publishingId === item.id ? t('processing') : item.isPublished ? t('unpublish') : t('publishEvent')}</Button>
                  {item.isPublished ? <Button variant="outline" onClick={() => navigate(`/exhibitions/${encodeURIComponent(item.id)}`)}><Eye className="mr-2 size-4" />{t('viewPage')}</Button> : null}
                  {competitions.some((competition) => competition.hostGalleryId === item.id) ? <Button variant="outline" className="border-tool-blue/50 text-tool-blue hover:bg-secondary" onClick={() => navigate('/admin/competitions')}><Trophy className="mr-2 size-4" />{t('hostBackend')}</Button> : null}
                  <Button variant="outline" onClick={() => { setShareGalleryId(item.id); setShareOpen(true); }}><Share2 className="mr-2 size-4" />{t('share')}</Button>
                  {editingGalleryId === item.id ? null : <Button variant="outline" onClick={() => handleStartInlineEdit(item)}><Pencil className="mr-2 size-4" />{t('editInfo')}</Button>}
                  <Button variant="outline" onClick={() => navigate(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(item.id)}`)}><ArrowRight className="mr-2 size-4" />{t('backToEditor')}</Button>
                  <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-secondary" onClick={() => handleOpenDelete(item)}><Trash2 className="mr-2 size-4" />{t('delete')}</Button>
                </div>
              </div>
            </div>
          ))}</div>}
        </motion.div>

        <Dialog open={shareOpen} onOpenChange={setShareOpen}><DialogContent><DialogHeader><DialogTitle>{t('shareExhibition')}</DialogTitle><DialogDescription>{t('shareExhibitionDesc')}</DialogDescription></DialogHeader><div className="space-y-3"><Button className="w-full justify-start" variant="outline" onClick={() => void handleCopyEditShare()}>{t('copyEditShareLink')}</Button><Button className="w-full justify-start" variant="outline" onClick={() => void handleCopyViewShare()}>{t('copyViewShareLink')}</Button></div><DialogFooter><Button variant="outline" onClick={() => setShareOpen(false)}>{t('close')}</Button></DialogFooter></DialogContent></Dialog>

        <Dialog open={publishOpen} onOpenChange={setPublishOpen}><DialogContent className="sm:max-w-3xl overflow-hidden rounded-md border border-border bg-card p-0 shadow-[0_24px_70px_-36px_rgba(28,28,26,0.5)]"><div className="border-b border-border bg-secondary px-6 py-5"><DialogHeader><DialogTitle className="text-xl text-foreground">{t('publishExhibition')}</DialogTitle><DialogDescription className="mt-1 text-sm text-muted-foreground">{t('publishExhibitionDesc')}</DialogDescription></DialogHeader></div><div className="space-y-5 px-6 py-6"><div className="rounded-md border border-border bg-secondary p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-curator-brass">{t('toBePublished')}</p><p className="mt-1 text-lg font-medium text-foreground">{publishGallery?.title || t('untitledExhibition')}</p></div><span className="rounded border border-curator-brass/60 px-3 py-1 text-xs font-medium text-curator-brass">Publish</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{t('publishInfo')}</p></div><label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-4 transition hover:border-curator-brass/70 hover:shadow-sm"><input type="checkbox" className="mt-1 size-4 rounded border-border text-curator-brass focus:ring-curator-brass" checked={hostCompetitionEnabled} onChange={(e) => setHostCompetitionEnabled(e.target.checked)} /><div><p className="text-sm font-medium text-foreground">{t('publishAsCompetition')}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{t('publishAsCompetitionDesc')}</p></div></label>{hostCompetitionEnabled ? <div className="space-y-5 rounded-md border border-curator-brass/40 bg-secondary p-5"><div className="space-y-2"><label className="text-sm font-medium text-foreground">{t('competitionName')}</label><Input value={competitionTitle} onChange={(e) => setCompetitionTitle(e.target.value)} placeholder={t('competitionNamePlaceholder')} className="h-11" /></div><div className="space-y-2"><label className="text-sm font-medium text-foreground">{t('competitionDescription')}</label><textarea value={competitionDescription} onChange={(e) => setCompetitionDescription(e.target.value)} className="min-h-[110px] w-full rounded-md border border-border bg-input-background px-3 py-3 text-sm text-foreground outline-none transition focus:border-curator-brass focus:ring-2 focus:ring-curator-brass/30" placeholder={t('competitionDescriptionPlaceholder')} /></div><div className="space-y-2"><label className="text-sm font-medium text-foreground">{t('competitionRules')}</label><textarea value={competitionRules} onChange={(e) => setCompetitionRules(e.target.value)} className="min-h-[130px] w-full rounded-md border border-border bg-input-background px-3 py-3 text-sm text-foreground outline-none transition focus:border-curator-brass focus:ring-2 focus:ring-curator-brass/30" placeholder={t('competitionRulesPlaceholder')} /></div><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2"><span className="text-sm font-medium text-foreground">{t('registrationDeadline')}</span><input type="datetime-local" value={competitionRegistrationDeadline} onChange={(e) => setCompetitionRegistrationDeadline(e.target.value)} className="h-11 w-full rounded-md border border-border bg-input-background px-3 text-sm text-foreground outline-none transition focus:border-curator-brass focus:ring-2 focus:ring-curator-brass/30" /></label><label className="space-y-2"><span className="text-sm font-medium text-foreground">{t('votingDeadlineOptional')}</span><input type="datetime-local" value={competitionVotingDeadline} onChange={(e) => setCompetitionVotingDeadline(e.target.value)} className="h-11 w-full rounded-md border border-border bg-input-background px-3 text-sm text-foreground outline-none transition focus:border-curator-brass focus:ring-2 focus:ring-curator-brass/30" /></label></div><label className="inline-flex items-center gap-3 text-sm text-muted-foreground"><input type="checkbox" checked={competitionIsPublic} onChange={(e) => setCompetitionIsPublic(e.target.checked)} className="size-4 rounded border-border text-curator-brass focus:ring-curator-brass" /><span>{t('publicCompetition')}</span></label></div> : null}</div><div className="flex items-center justify-between gap-3 border-t border-border bg-secondary px-6 py-4"><p className="text-xs text-muted-foreground">{t('publishNotice')}</p><DialogFooter className="m-0 gap-2 sm:gap-2"><Button variant="outline" onClick={() => setPublishOpen(false)} disabled={publishingId === publishGallery?.id} className="px-4">{t('cancel')}</Button><Button onClick={() => void handleConfirmPublish()} disabled={publishingId === publishGallery?.id || (hostCompetitionEnabled && (!competitionTitle.trim() || !competitionDescription.trim() || !competitionRules.trim() || !competitionRegistrationDeadline.trim()))} className="bg-primary px-4 text-primary-foreground hover:bg-curator-brass">{publishingId === publishGallery?.id ? t('publishing') : t('confirmPublish')}</Button></DialogFooter></div></DialogContent></Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle>{t('deleteExhibition')}</DialogTitle><DialogDescription>{t('deleteExhibitionConfirm')}「{deleteGallery?.title || t('thisExhibition')}」{t('cannotUndo')}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>{t('cancel')}</Button><Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>{isDeleting ? t('deleting') : t('confirmDelete')}</Button></DialogFooter></DialogContent></Dialog>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{t('createNewExhibition')}</DialogTitle><DialogDescription>{t('createNewExhibitionHint')}</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><label className="text-sm text-muted-foreground">{t('exhibitionName')}</label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('exampleExhibitionName')} maxLength={120} onKeyDown={(e) => { if (e.key === 'Enter') void handleConfirmCreate(); }} /></div><div className="space-y-2"><label className="text-sm text-muted-foreground">{t('selectTemplate')}</label><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{createTemplates.map((template) => { const isSelected = selectedTemplateTitle === template.title; return (<button key={template.title} type="button" className={`overflow-hidden rounded-md border bg-card text-left transition-all ${isSelected ? 'border-curator-brass ring-2 ring-curator-brass/30 shadow-sm' : 'border-border hover:border-curator-brass/70'}`} onClick={() => setSelectedTemplateTitle(template.title)} disabled={isCreating}><div className="h-28 bg-secondary"><ImageWithFallback src={template.image} alt={template.title} className="h-full w-full object-cover" /></div><div className="p-3"><p className="text-sm text-foreground">{template.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{template.description}</p></div></button>);})}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isCreating}>{t('cancel')}</Button><Button onClick={handleConfirmCreate} disabled={isCreating}>{isCreating ? t('creating') : t('createAndEdit')}</Button></DialogFooter></DialogContent></Dialog>
      </div>
    </div>
  );
}
