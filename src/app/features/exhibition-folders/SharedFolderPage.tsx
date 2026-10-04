import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ChevronRight, Folder, ArrowLeft, Images, Eye } from 'lucide-react';
import { sharedFolderRequest, type SharedFolder, type SharedFolderGallery } from '@/app/api/galleryFolders';
import { apiUrl } from '@/app/api/base';
import { folderPath } from './ExhibitionFolders';
import { Button } from '@/app/components/ui/button';
import { useI18n } from '@/app/components/I18nProvider';
import { SharedGalleryScene } from './SharedGalleryScene';
import { localizeTemplateDescription } from '@/app/utils/templateDescription';
import type { SceneSnapshot } from '@/app/modules/metaverse3d/store/metaverseStoreTypes';

export default function SharedFolderPage() {
  const { token = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { t, locale } = useI18n();
  const folderId = params.get('folder'); const galleryId = params.get('gallery');
  const [data, setData] = useState<SharedFolder | null>(null);
  const [gallery, setGallery] = useState<(SharedFolderGallery & { scene: SceneSnapshot }) | null>(null);
  const [failed, setFailed] = useState(false);
  const [view3d, setView3d] = useState(false);
  useEffect(() => {
    let current = true;
    setData(null); setGallery(null); setFailed(false); setView3d(false);
    async function load() {
      try {
        const folder = await sharedFolderRequest<SharedFolder>(token, folderId ? `?folder=${encodeURIComponent(folderId)}` : '');
        let detail: (SharedFolderGallery & { scene: SceneSnapshot }) | null = null;
        if (galleryId) {
          const result = await sharedFolderRequest<SharedFolderGallery>(token, `/galleries/${encodeURIComponent(galleryId)}`);
          const scene = JSON.parse(result.sceneJson ?? '{"items":[]}') as SceneSnapshot;
          if (!Array.isArray(scene.items)) throw new Error('Invalid scene');
          const mediaUrl = (url: string | undefined) => {
            const id = /^\/api\/media\/([\w-]+)(?:\?.*)?$/.exec(url ?? '')?.[1];
            return id ? apiUrl(`/api/shared-folders/galleries/${encodeURIComponent(galleryId!)}/media/${id}?token=${encodeURIComponent(token)}`) : url;
          };
          scene.items = scene.items.map(item => ({ ...item, content: mediaUrl(item.content) ?? '', assetUrl: mediaUrl(item.assetUrl) }));
          detail = { ...result, scene };
        }
        if (current) { setData(folder); setGallery(detail); setFailed(false); }
      } catch { if (current) { setFailed(true); setData(null); setGallery(null); } }
    }
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { current = false; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [token, folderId, galleryId]);
  const open = (id: string, exhibition?: string) => setParams({ folder: id, ...(exhibition ? { gallery: exhibition } : {}) });
  return <main className="mx-auto min-h-[70vh] max-w-6xl space-y-6 px-4 py-10 sm:px-6">
    {failed ? <div role="alert" className="rounded-xl border border-border p-8"><h1 className="text-2xl font-semibold">{t('folderShareUnavailable')}</h1><p className="mt-3 text-muted-foreground">{t('folderShareUnavailableHelp')}</p><Button asChild variant="outline" className="mt-5"><Link to={`/folders/share/${encodeURIComponent(token)}`}>{t('folderShareBack')}</Link></Button></div>
      : !data ? <p role="status">{t('foldersLoading')}</p> : <>
        <header><p className="mb-2 text-sm text-muted-foreground">{t('folderShareReadOnly')}</p><h1 className="break-words text-3xl font-semibold">{gallery?.title ?? data.folder.name}</h1><p className="mt-3 text-muted-foreground">{t('folderShareVisitorHelp')}</p></header>
        <nav aria-label={t('foldersBreadcrumb')} className="flex flex-wrap items-center gap-1">
          {folderPath(data.folders, data.folder.id).map((folder, index) => <span key={folder.id} className="flex min-w-0 items-center">{index > 0 && <ChevronRight className="size-4 shrink-0" />}<Button variant="ghost" onClick={() => open(folder.id)} className="max-w-60"><span className="truncate">{folder.name}</span></Button></span>)}
        </nav>
        {gallery ? <>
          <Button variant="outline" onClick={() => open(data.folder.id)}><ArrowLeft className="size-4" />{t('folderShareBack')}</Button>
          {gallery.description && <p className="whitespace-pre-wrap break-words text-muted-foreground">{localizeTemplateDescription(gallery.description, locale)}</p>}
          <Button variant="outline" onClick={() => setView3d(!view3d)}><Eye className="size-4" />{t(view3d ? 'folderSharePictures' : 'folderShare3D')}</Button>
          {view3d ? <SharedGalleryScene scene={gallery.scene} /> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{gallery.scene.items.filter(item => item.type === 'painting').map(item => <article key={item.id} className="overflow-hidden rounded-xl border border-border bg-card"><img src={item.content} alt={item.title ?? ''} referrerPolicy="no-referrer" loading="lazy" className="aspect-[4/3] w-full bg-secondary/30 object-contain" /><div className="space-y-2 p-4"><h2 className="break-words font-medium">{item.title}</h2><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.description}</p></div></article>)}</div>}
        </> : <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.folders.filter(folder => folder.parentId === data.folder.id).map(folder => <button key={folder.id} onClick={() => open(folder.id)} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-5 text-left hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"><Folder className="size-7 shrink-0 text-curator-brass" /><span className="truncate font-medium">{folder.name}</span><ChevronRight className="ml-auto size-4 shrink-0" /></button>)}</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.galleries.map(item => <article key={item.id} className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5"><Images className="size-8 text-muted-foreground" /><h2 className="break-words text-xl font-semibold">{item.title}</h2><p className="line-clamp-3 break-words text-sm text-muted-foreground">{item.description}</p><Button variant="outline" className="mt-auto" onClick={() => open(data.folder.id, item.id)}>{t('folderShareViewExhibition')}</Button></article>)}</div>
          {!data.galleries.length && !data.folders.some(folder => folder.parentId === data.folder.id) && <p className="rounded-xl border border-dashed border-border p-8 text-muted-foreground">{t('folderShareEmpty')}</p>}
        </>}
      </>}
  </main>;
}
