import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  Plus,
  ImagePlus,
  Pencil,
  Calendar,
  ArrowRight,
  Loader2,
  RefreshCw,
  Share2,
  Trash2,
  Globe,
  Eye,
  BarChart3,
  MoreHorizontal,
} from 'lucide-react';
import { Button, buttonVariants } from '../components/ui/button';
import {
  createGallery,
  deleteGalleryById,
  getMyGalleries,
  loadAuth,
  publishGalleryById,
  unpublishGalleryById,
  updateGalleryById,
  type GallerySummary,
} from '../api/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import {
  CREATE_GALLERY_TEMPLATE_TITLES,
  GALLERY_TEMPLATES,
} from '../constants/galleryTemplates';
import { getDefaultGalleryAtmosphere, getTemplateSceneJson, type GalleryAtmosphere } from '../constants/gallerySceneTemplates';
import { GalleryAtmosphereSelector } from '../components/GalleryAtmosphereSelector';
import { useI18n } from '../components/I18nProvider';
import { useMobileDevice } from '../hooks/useMobileDevice';
import { ExhibitionShareDialog } from '../components/ExhibitionShareDialog';
import { ExhibitionFolders } from '../features/exhibition-folders/ExhibitionFolders';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

const createTemplates = GALLERY_TEMPLATES.filter((template) =>
  CREATE_GALLERY_TEMPLATE_TITLES.includes(
    template.title as (typeof CREATE_GALLERY_TEMPLATE_TITLES)[number],
  ),
);
const defaultTemplateTitle = createTemplates[0]?.title ?? GALLERY_TEMPLATES[0]?.title ?? '';

const TEMPLATE_I18N_KEYS = [
  'vgTemplateBlank',
  'vgTemplateModernArt',
  'vgTemplateTech',
  'vgTemplateMuseum',
  'vgTemplateFashion',
  'vgTemplatePhoto',
  'vgTemplateCar',
] as const;

const templateKeyMap = new Map(
  GALLERY_TEMPLATES.map((template, index) => [template.title, TEMPLATE_I18N_KEYS[index]]),
);

const tTitle = (t: (key: string) => string, title: string) => {
  const key = templateKeyMap.get(title);
  return key ? t(`${key}Title`) : title;
};

const tDesc = (t: (key: string) => string, title: string) => {
  const key = templateKeyMap.get(title);
  return key ? t(`${key}Desc`) : title;
};

export default function MyExhibitions() {
  const isMobile = useMobileDevice();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  // English needs spaces around the quoted title; Chinese corner brackets do not.
  const quote = (text: string) => (locale === 'en' ? ` “${text}” ` : `「${text}」`);
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
  const [deleteGallery, setDeleteGallery] = useState<GallerySummary | null>(
    null,
  );
  const [newTitle, setNewTitle] = useState('');
  const [selectedTemplateTitle, setSelectedTemplateTitle] =
    useState(defaultTemplateTitle);
  const [selectedAtmosphere, setSelectedAtmosphere] = useState<GalleryAtmosphere>(() => getDefaultGalleryAtmosphere(defaultTemplateTitle));
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishGallery, setPublishGallery] = useState<GallerySummary | null>(
    null,
  );
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [items],
  );

  const fetchMyExhibitions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { token } = loadAuth();
      if (!token) {
        navigate(
          '/login?returnTo=' +
            encodeURIComponent('/virtual-gallery/my-exhibitions'),
        );
        return;
      }
      const galleryResult = await getMyGalleries(token);
      setItems(
        Array.isArray(galleryResult.galleries) ? galleryResult.galleries : [],
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('loadMyExhibitionsFailed');
      setError(message);
      toast.error(t('cannotLoadMyExhibitions'), { description: message });
    } finally {
      setIsLoading(false);
    }
  }, [navigate, t]);

  useEffect(() => {
    void fetchMyExhibitions();
  }, [fetchMyExhibitions]);

  const handleCreateNew = () => {
    if (isMobile) return;
    setNewTitle('');
    setSelectedTemplateTitle(defaultTemplateTitle);
    setSelectedAtmosphere(getDefaultGalleryAtmosphere(defaultTemplateTitle));
    setCreateOpen(true);
  };
  const handleConfirmCreate = async () => {
    if (isMobile) return;
    const title = newTitle.trim();
    if (!title) return toast.error(t('pleaseEnterExhibitionName'));
    const selectedTemplate =
      createTemplates.find((t2) => t2.title === selectedTemplateTitle) ??
      createTemplates[0];
    setIsCreating(true);
    try {
      const { token } = loadAuth();
      if (!token)
        return navigate(
          '/login?returnTo=' +
            encodeURIComponent('/virtual-gallery/my-exhibitions'),
        );
      const sceneJson = getTemplateSceneJson(selectedTemplate.title, selectedAtmosphere, locale === 'en' ? 'en' : 'zh');
      const result = await createGallery(token, {
        title,
        description: tDesc(t, selectedTemplate.title),
        templateTitle: selectedTemplate.title,
        templateImage: selectedTemplate.image,
        category: selectedTemplate.category,
        ...(sceneJson ? { sceneJson } : {}),
      });
      setCreateOpen(false);
      toast.success(t('createdNewExhibition'), {
        description: `${quote(title)}${t('addedToMyList')}`.trim(),
      });
      navigate(
        `/virtual-gallery/create?exhibitionId=${encodeURIComponent(result.gallery.id)}`,
      );
    } catch (err) {
      toast.error(t('createExhibitionFailed'), {
        description: err instanceof Error ? err.message : t('tryAgainLater'),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartInlineEdit = (gallery: GallerySummary) => {
    setEditingGalleryId(gallery.id);
    setEditTitle(gallery.title);
    setEditDescription(gallery.description || '');
  };
  const handleCancelInlineEdit = () => {
    setEditingGalleryId(null);
    setEditTitle('');
    setEditDescription('');
    setSavingEditId(null);
  };
  const handleSaveInlineEdit = async (gallery: GallerySummary) => {
    const title = editTitle.trim();
    const description = editDescription.trim();
    if (!title) return toast.error(t('pleaseEnterExhibitionName'));
    const { token } = loadAuth();
    if (!token)
      return navigate(
        '/login?returnTo=' +
          encodeURIComponent('/virtual-gallery/my-exhibitions'),
      );
    setSavingEditId(gallery.id);
    try {
      const result = await updateGalleryById(token, gallery.id, {
        expectedRevision: gallery.revision,
        title,
        description,
      });
      setItems((prev) =>
        prev.map((item) => (item.id === gallery.id ? result.gallery : item)),
      );
      toast.success(t('updatedExhibitionInfo'), {
        description: `${quote(title)}`.trim(),
      });
      handleCancelInlineEdit();
    } catch (err) {
      toast.error(t('updateExhibitionInfoFailed'), {
        description: err instanceof Error ? err.message : t('tryAgainLater'),
      });
    } finally {
      setSavingEditId(null);
    }
  };
  const handleOpenDelete = (gallery: GallerySummary) => {
    setDeleteGallery(gallery);
    setDeleteOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (!deleteGallery) return;
    setIsDeleting(true);
    try {
      const { token } = loadAuth();
      if (!token)
        return navigate(
          '/login?returnTo=' +
            encodeURIComponent('/virtual-gallery/my-exhibitions'),
        );
      await deleteGalleryById(token, deleteGallery.id);
      setItems((prev) => prev.filter((g) => g.id !== deleteGallery.id));
      setDeleteOpen(false);
      toast.success(t('deletedExhibition'), {
        description: `${quote(deleteGallery.title)}`.trim(),
      });
      setDeleteGallery(null);
    } catch (err) {
      toast.error(t('deleteExhibitionFailed'), {
        description: err instanceof Error ? err.message : t('tryAgainLater'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePublish = async (gallery: GallerySummary) => {
    if (gallery.isPublished) {
      const { token } = loadAuth();
      if (!token)
        return navigate(
          '/login?returnTo=' +
            encodeURIComponent('/virtual-gallery/my-exhibitions'),
        );
      setPublishingId(gallery.id);
      try {
        const result = await unpublishGalleryById(token, gallery.id);
        setItems((prev) =>
          prev.map((item) => (item.id === gallery.id ? result.gallery : item)),
        );
        toast.success(t('unpublishedExhibition'), {
          description: `${quote(gallery.title)}${t('removedFromPublicExhibitions')}`.trim(),
        });
      } catch (err) {
        toast.error(t('unpublishFailed'), {
          description: err instanceof Error ? err.message : t('tryAgainLater'),
        });
      } finally {
        setPublishingId(null);
      }
      return;
    }
    setPublishGallery(gallery);
    setPublishOpen(true);
  };

  const handleConfirmPublish = async () => {
    if (!publishGallery) return;
    const { token } = loadAuth();
    if (!token)
      return navigate(
        '/login?returnTo=' +
          encodeURIComponent('/virtual-gallery/my-exhibitions'),
      );
    setPublishingId(publishGallery.id);
    try {
      const result = await publishGalleryById(token, publishGallery.id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === publishGallery.id ? result.gallery : item,
        ),
      );
      setPublishOpen(false);
      toast.success(t('publishedExhibition'), {
        description: `${quote(publishGallery.title)}${t('nowPubliclyViewable')}`.trim(),
      });
    } catch (err) {
      toast.error(t('publishFailed'), {
        description: err instanceof Error ? err.message : t('tryAgainLater'),
      });
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground transition-colors duration-300 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="museum-workspace-heading text-balance"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">
            {t('manageExhibitions')}
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            {t('myExhibitionsTitle')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            {t('myExhibitionsSubtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 rounded-md border border-border bg-card p-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="mb-1 text-2xl font-semibold text-foreground">
                {t('createNewExhibition')}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {t('quickExhibitionSubtitle')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
              <Button asChild className="min-h-11">
                <Link to="/virtual-gallery/quick-create">
                  <ImagePlus className="size-4" aria-hidden="true" />
                  {t('quickExhibitionCreateAction')}
                </Link>
              </Button>
              <Button variant="outline" className="min-h-11" onClick={handleCreateNew} disabled={isMobile} title={isMobile ? t('mobileEditorDesktopRequired') : undefined}>
                <Plus className="size-4" aria-hidden="true" />
                {t(isMobile ? 'mobileEditorDesktopRequired' : 'selectTemplate')}
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-md border border-border bg-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-6">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">
                {t('manageExhibitions')}
              </h2>
              <p className="mt-1 text-muted-foreground">
                {t('manageExhibitionsDesc')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/admin/exhibitions')}
              >
                <BarChart3 className="mr-2 size-4" />
                {t('eaBtnLabel')}
              </Button>
              <Button
                variant="outline"
                onClick={fetchMyExhibitions}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}
                {t('refresh')}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('loadingExhibitions')}
            </div>
          ) : error ? (
            <div className="p-8 text-destructive">{error}</div>
          ) : sortedItems.length === 0 ? (
            <div className="space-y-3 p-8">
              <p className="font-medium text-foreground">{t('noExhibitionsYet')}</p>
              <p className="text-sm text-muted-foreground">{t('myExhibitionsEmptyHint')}</p>
              <Button asChild><Link to="/virtual-gallery/quick-create">{t('quickExhibitionCreateAction')}</Link></Button>
            </div>
          ) : (
            <ExhibitionFolders items={sortedItems}>{(folderItems, folderControls) => (
            <div className="divide-y divide-border">
              {folderItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-4 p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-4 lg:flex-1">
                      <div className="h-20 w-28 flex-shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
                        <ImageWithFallback
                          src={
                            item.templateImage ||
                            'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80'
                          }
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {editingGalleryId === item.id ? (
                            <Input
                              id={`gallery-title-${item.id}`}
                              autoFocus
                              aria-label={t('exhibitionName')}
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              placeholder={t('enterExhibitionName')}
                              className="h-9 max-w-md"
                              maxLength={120}
                              disabled={savingEditId === item.id}
                            />
                          ) : (
                            <p className="truncate text-lg font-medium text-foreground">
                              {item.title}
                            </p>
                          )}
                          <span
                            className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${item.isPublished ? 'border-curator-brass/60 text-curator-brass' : 'border-border text-muted-foreground'}`}
                          >
                            {item.isPublished
                              ? t('published')
                              : t('unpublished')}
                          </span>
                        </div>
                        {editingGalleryId === item.id ? (
                          <div className="mt-3 max-w-2xl space-y-2">
                            <label className="block text-xs font-medium text-muted-foreground">
                              {t('exhibitionDescription')}
                            </label>
                            <textarea
                              aria-label={t('exhibitionDescription')}
                              value={editDescription}
                              onChange={(e) =>
                                setEditDescription(e.target.value)
                              }
                              placeholder={t('enterExhibitionDescription')}
                              className="min-h-[84px] w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-curator-brass focus:ring-2 focus:ring-curator-brass/30"
                              disabled={savingEditId === item.id}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => void handleSaveInlineEdit(item)}
                                disabled={savingEditId === item.id}
                              >
                                {savingEditId === item.id
                                  ? t('saving')
                                  : t('saveInfo')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelInlineEdit}
                                disabled={savingEditId === item.id}
                              >
                                {t('cancel')}
                              </Button>
                            </div>
                          </div>
                        ) : item.description ? (
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                            {item.description}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {t('noDescriptionYet')}
                          </p>
                        )}
                        <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="size-4" />
                          {t('lastUpdated')}{locale === 'en' ? ': ' : '：'}
                          {new Date(item.updatedAt).toLocaleString(locale)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-md lg:justify-end">
                      {folderControls(item)}
                      <Button asChild className="min-h-11">
                        <Link to={item.quickDraftId && !item.isPublished
                          ? `/virtual-gallery/quick-create?draftId=${encodeURIComponent(item.quickDraftId)}`
                          : `/virtual-gallery/edit-artworks?exhibitionId=${encodeURIComponent(item.id)}`}>
                          <Pencil className="mr-2 size-4" aria-hidden="true" />
                          {t(item.quickDraftId && !item.isPublished ? 'quickExhibitionResume' : 'artworkEditTitle')}
                        </Link>
                      </Button>
                      {item.isPublished ? (
                        <Button
                          variant="outline"
                          onClick={() =>
                            navigate(
                              `/exhibitions/${encodeURIComponent(item.id)}`,
                            )
                          }
                        >
                          <Eye className="mr-2 size-4" />
                          {t('viewPage')}
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShareGalleryId(item.id);
                          setShareOpen(true);
                        }}
                      >
                        <Share2 className="mr-2 size-4" />
                        {t('share')}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className={`${buttonVariants({ variant: 'outline' })} min-h-11`} aria-label={`${t('galleryMoreActions')}: ${item.title}`}>
                            <MoreHorizontal className="size-4" aria-hidden="true" />{t('galleryMoreActions')}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onCloseAutoFocus={event => {
                          if (editingGalleryId === item.id) {
                            event.preventDefault();
                            document.getElementById(`gallery-title-${item.id}`)?.focus();
                          } else if (publishOpen || deleteOpen) event.preventDefault();
                        }}>
                          {editingGalleryId !== item.id && <DropdownMenuItem className="min-h-11" onSelect={() => handleStartInlineEdit(item)}>
                            <Pencil aria-hidden="true" />{t('editInfo')}
                          </DropdownMenuItem>}
                          {item.quickDraftId && !item.isPublished && <DropdownMenuItem className="min-h-11" asChild>
                            <Link to={`/virtual-gallery/edit-artworks?exhibitionId=${encodeURIComponent(item.id)}`}>
                              <ImagePlus aria-hidden="true" />{t('artworkEditTitle')}
                            </Link>
                          </DropdownMenuItem>}
                          <DropdownMenuItem className="min-h-11" asChild>
                            <Link to={`/virtual-gallery/create?exhibitionId=${encodeURIComponent(item.id)}${isMobile ? '&share=view' : ''}`}>
                              <ArrowRight aria-hidden="true" />{t(isMobile ? 'mobileEditorViewOnly' : 'galleryAdvancedEditor')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="min-h-11" disabled={publishingId === item.id} onSelect={() => void handleTogglePublish(item)}>
                            <Globe aria-hidden="true" />{t(publishingId === item.id ? 'processing' : item.isPublished ? 'unpublish' : 'publishEvent')}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={() => handleOpenDelete(item)}>
                            <Trash2 aria-hidden="true" />{t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}</ExhibitionFolders>
          )}
        </motion.div>

        <ExhibitionShareDialog
          gallery={items.find(item => item.id === shareGalleryId) ?? null}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />

        <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
          <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-md border border-border bg-card p-0 shadow-[0_24px_70px_-36px_rgba(28,28,26,0.5)] sm:max-w-3xl">
            <div className="border-b border-border bg-secondary px-6 py-5">
              <DialogHeader>
                <DialogTitle className="text-xl text-foreground">
                  {t('publishExhibition')}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  {t('publishExhibitionDesc')}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="space-y-5 px-6 py-6">
              <div className="rounded-md border border-border bg-secondary p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-curator-brass">
                      {t('toBePublished')}
                    </p>
                    <p className="mt-1 text-lg font-medium text-foreground">
                      {publishGallery?.title || t('untitledExhibition')}
                    </p>
                  </div>
                  <span className="rounded border border-curator-brass/60 px-3 py-1 text-xs font-medium text-curator-brass">
                    Publish
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {t('publishInfo')}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary px-6 py-4">
              <p className="text-xs text-muted-foreground">
                {t('publishNotice')}
              </p>
              <DialogFooter className="m-0 gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPublishOpen(false)}
                  disabled={publishingId === publishGallery?.id}
                  className="px-4"
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={() => void handleConfirmPublish()}
                  disabled={publishingId === publishGallery?.id}
                  className="bg-primary px-4 text-primary-foreground hover:bg-curator-brass"
                >
                  {publishingId === publishGallery?.id
                    ? t('publishing')
                    : t('confirmPublish')}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('deleteExhibition')}</DialogTitle>
              <DialogDescription>
                {t('deleteExhibitionConfirm')}{quote(deleteGallery?.title || t('thisExhibition'))}{t('cannotUndo')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={isDeleting}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? t('deleting') : t('confirmDelete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('createNewExhibition')}</DialogTitle>
              <DialogDescription>
                {t('createNewExhibitionHint')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="create-exhibition-title"
                  className="text-sm text-muted-foreground"
                >
                  {t('exhibitionName')}
                </label>
                <Input
                  id="create-exhibition-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t('exampleExhibitionName')}
                  maxLength={120}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleConfirmCreate();
                  }}
                />
              </div>
              <GalleryAtmosphereSelector value={selectedAtmosphere} onChange={setSelectedAtmosphere} disabled={isCreating} />
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  {t('selectTemplate')}
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {createTemplates.map((template) => {
                    const isSelected = selectedTemplateTitle === template.title;
                    return (
                      <button
                        key={template.title}
                        type="button"
                        className={`overflow-hidden rounded-md border bg-card text-left transition-all ${isSelected ? 'border-curator-brass ring-2 ring-curator-brass/30' : 'border-border hover:border-curator-brass/70'}`}
                        onClick={() => { if (template.title !== selectedTemplateTitle) setSelectedAtmosphere(getDefaultGalleryAtmosphere(template.title)); setSelectedTemplateTitle(template.title); }}
                        aria-pressed={isSelected}
                        disabled={isCreating}
                      >
                        <div className="h-28 bg-secondary">
                          <ImageWithFallback
                            src={template.image}
                            alt={tTitle(t, template.title)}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="p-3">
                          <p className='text-sm text-foreground'>
                            {tTitle(t, template.title)}
                          </p>
                          <p className='mt-1 line-clamp-2 text-xs text-muted-foreground'>
                            {tDesc(t, template.title)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isCreating}
              >
                {t('cancel')}
              </Button>
              <Button onClick={handleConfirmCreate} disabled={isMobile || isCreating}>
                {isCreating ? t('creating') : t('createAndEdit')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
