import { useEffect, useState, type ReactNode, type DragEvent } from 'react';
import { useSearchParams } from 'react-router';
import { ChevronRight, Folder, FolderPlus, FolderInput, MoreHorizontal, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { loadAuth, type GallerySummary } from '@/app/api/client';
import { folderRequest, type GalleryFolder, type GalleryFolderState } from '@/app/api/galleryFolders';
import { useI18n } from '@/app/components/I18nProvider';
import { Button, buttonVariants } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu';
import { FolderShareDialog } from './FolderShareDialog';

type Props = { items: GallerySummary[]; children: (items: GallerySummary[], controls: (item: GallerySummary) => ReactNode) => ReactNode };
type Edit = { kind: 'create' } | { kind: 'rename' | 'delete'; folder: GalleryFolder };
type Move = { galleryIds: string[] } | { folder: GalleryFolder };
const dragType = 'application/x-metaexb-gallery-ids';

export function folderPath(folders: GalleryFolder[], id: string | null): GalleryFolder[] {
  const path: GalleryFolder[] = [];
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = folders.find(f => f.id === id);
    if (!folder) break;
    path.unshift(folder); id = folder.parentId;
  }
  return path;
}

export function ExhibitionFolders({ items, children }: Props) {
  const { t } = useI18n();
  const folderItemLabel = (count: number) => (count === 1 ? t('foldersItemCountOne') : t('foldersItemCount', { count }));
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<GalleryFolderState | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [name, setName] = useState('');
  const [move, setMove] = useState<Move | null>(null);
  const [sharing, setSharing] = useState<GalleryFolder | null>(null);
  const [destination, setDestination] = useState('');
  const [dragOver, setDragOver] = useState<string | null>(null);
  const folders = data?.folders ?? [];
  const requestedFolder = params.get('folder');
  const current = folders.find(f => f.id === requestedFolder) ?? null;
  const currentId = current?.id ?? null;
  const membership = new Map(data?.memberships.map(m => [m.galleryId, m.folderId]));
  const visibleItems = items.filter(item => (membership.get(item.id) ?? null) === currentId);
  const selectedIds = selected.filter(id => visibleItems.some(item => item.id === id));
  const childFolders = folders.filter(f => f.parentId === currentId).sort((a, b) => a.name.localeCompare(b.name));

  async function load() {
    setError(false);
    try { setData(await folderRequest(loadAuth().token || '')); }
    catch { setError(true); }
  }
  useEffect(() => { void load(); }, []);

  function open(id: string | null) {
    setSelected([]);
    setParams(previous => { const next = new URLSearchParams(previous); if (id) next.set('folder', id); else next.delete('folder'); return next; });
  }
  async function mutate(path: string, method: string, body?: unknown) {
    if (busy) return false;
    setBusy(true);
    try {
      setData(await folderRequest(loadAuth().token || '', path, method, body));
      setSelected([]); toast.success(t('foldersSaved')); return true;
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      toast.error(t(code === 'FOLDER_CYCLE' ? 'foldersCycle' : code === 'FOLDER_LIMIT' ? 'foldersLimit' : 'foldersFailed'));
      return false;
    } finally { setBusy(false); }
  }
  function beginMove(value: Move) { setMove(value); setDestination(currentId ?? ''); }
  async function confirmEdit() {
    if (!edit) return;
    const success = edit.kind === 'create'
      ? await mutate('', 'POST', { name: name.trim(), parentId: currentId })
      : edit.kind === 'rename'
        ? await mutate(`/${edit.folder.id}`, 'PATCH', { name: name.trim() })
        : await mutate(`/${edit.folder.id}`, 'DELETE');
    if (success) setEdit(null);
  }
  async function confirmMove() {
    if (!move) return;
    const success = 'folder' in move
      ? await mutate(`/${move.folder.id}`, 'PATCH', { parentId: destination || null })
      : await mutate('/move', 'POST', { galleryIds: move.galleryIds, folderId: destination || null });
    if (success) setMove(null);
  }
  function acceptDrop(event: DragEvent, id: string | null) {
    event.preventDefault(); setDragOver(null);
    if (busy) return;
    try {
      const ids: unknown = JSON.parse(event.dataTransfer.getData(dragType));
      if (Array.isArray(ids) && ids.length && ids.length <= 100 && ids.every(id => typeof id === 'string' && items.some(item => item.id === id))) {
        void mutate('/move', 'POST', { galleryIds: ids, folderId: id });
      }
    } catch { /* Ignore unrelated dragged content. */ }
  }
  const dropProps = (id: string | null) => ({
    onDragOver: (event: DragEvent) => { if (!busy && event.dataTransfer.types.includes(dragType)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOver(id ?? 'root'); } },
    onDragLeave: () => setDragOver(null), onDrop: (event: DragEvent) => acceptDrop(event, id),
  });
  const controls = (item: GallerySummary) => <>
    <label className="inline-flex min-h-11 items-center gap-2 px-2 text-sm">
      <input type="checkbox" aria-label={t('foldersSelectItem', { title: item.title })} className="size-4 accent-primary" disabled={busy}
        checked={selectedIds.includes(item.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, item.id] : ids.filter(id => id !== item.id))} />
    </label>
    <Button asChild variant="outline"><button type="button" disabled={busy} aria-label={t('foldersMoveItem', { title: item.title })}
      draggable={!busy} onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(dragType, JSON.stringify(selectedIds.includes(item.id) ? selectedIds : [item.id])); }}
      onClick={() => beginMove({ galleryIds: [item.id] })}>
      <FolderInput className="size-4" aria-hidden="true" />{t('foldersMove')}
    </button></Button>
  </>;

  if (error) return <div className="space-y-3 p-6" role="alert"><p>{t('foldersLoadFailed')}</p><Button variant="outline" onClick={() => void load()}>{t('refresh')}</Button></div>;
  if (!data) return <div className="flex items-center gap-2 p-6" role="status"><Loader2 className="size-4 animate-spin" />{t('foldersLoading')}</div>;
  return <>
    <div className="space-y-4 border-b border-border p-4 sm:p-6" aria-busy={busy}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t('foldersBreadcrumb')} className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          <Button variant="ghost" className={dragOver === 'root' ? 'bg-accent' : ''} onClick={() => open(null)} {...dropProps(null)} aria-current={!current ? 'page' : undefined}>{t('foldersRoot')}</Button>
          {folderPath(folders, currentId).map(folder => <span key={folder.id} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            <Button variant="ghost" className={`max-w-56 ${dragOver === folder.id ? 'bg-accent' : ''}`} onClick={() => open(folder.id)} {...dropProps(folder.id)} aria-current={folder.id === currentId ? 'page' : undefined}><span className="truncate">{folder.name}</span></Button>
          </span>)}
        </nav>
        <Button variant="outline" disabled={busy} onClick={() => { setName(''); setEdit({ kind: 'create' }); }}><FolderPlus className="size-4" aria-hidden="true" />{t('foldersNew')}</Button>
      </div>
      <p className="text-sm text-muted-foreground">{t('foldersHint')}</p>
      {requestedFolder && !current && <p role="status" className="text-sm text-muted-foreground">{t('foldersMissing')}</p>}
      {childFolders.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {childFolders.map(folder => <div key={folder.id} {...dropProps(folder.id)} className={`flex min-w-0 items-center gap-1 rounded-lg border p-2 transition-colors ${dragOver === folder.id ? 'border-primary bg-accent' : 'border-border bg-background hover:bg-accent/40'}`}>
          <button className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md px-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => open(folder.id)}>
            <Folder className="size-6 shrink-0 text-curator-brass" aria-hidden="true" /><span className="min-w-0"><span className="block truncate font-medium">{folder.name}</span><span className="text-xs text-muted-foreground">{folderItemLabel(items.filter(item => membership.get(item.id) === folder.id).length + folders.filter(f => f.parentId === folder.id).length)}</span></span>
          </button>
          <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className={buttonVariants({ size: 'icon', variant: 'ghost' })} disabled={busy} aria-label={t('foldersActions', { name: folder.name })}><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={event => { if (edit || move || sharing) event.preventDefault(); }}>
              <DropdownMenuItem onSelect={() => setSharing(folder)}>{t('folderShareAction')}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { setName(folder.name); setEdit({ kind: 'rename', folder }); }}>{t('foldersRename')}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => beginMove({ folder })}>{t('foldersMove')}</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onSelect={() => setEdit({ kind: 'delete', folder })}>{t('foldersDelete')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>)}
      </div>}
      {visibleItems.length > 0 && <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="size-4 accent-primary" disabled={busy}
          checked={selectedIds.length === visibleItems.length} onChange={e => setSelected(e.target.checked ? visibleItems.map(item => item.id) : [])} />{t('foldersSelectAll')}</label>
        <span aria-live="polite">{t('foldersSelected', { count: selectedIds.length })}</span>
        {selectedIds.length > 0 && <Button variant="outline" disabled={busy || selectedIds.length > 100} onClick={() => beginMove({ galleryIds: selectedIds })}><FolderInput className="size-4" />{t('foldersMove')}</Button>}
        {selectedIds.length > 100 && <span role="status">{t('foldersBatchLimit')}</span>}
      </div>}
      {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />{t('saving')}</p>}
    </div>
    {visibleItems.length ? children(visibleItems, controls) : <div className="p-8 text-sm text-muted-foreground">{t(childFolders.length ? 'foldersNoLoose' : 'foldersEmpty')}</div>}
    {sharing && <FolderShareDialog key={sharing.id} folder={sharing} onClose={() => setSharing(null)} />}
    <Dialog open={Boolean(edit)} onOpenChange={open => { if (!open && !busy) setEdit(null); }}>
      <DialogContent><DialogHeader><DialogTitle>{t(edit?.kind === 'delete' ? 'foldersDelete' : edit?.kind === 'rename' ? 'foldersRename' : 'foldersNew')}</DialogTitle>
        <DialogDescription>{edit?.kind === 'delete' ? t('foldersDeleteDescription', { name: edit.folder.name }) : t('foldersNameHint')}</DialogDescription></DialogHeader>
        {edit?.kind !== 'delete' && <form id="folder-name-form" onSubmit={e => { e.preventDefault(); void confirmEdit(); }}><label htmlFor="folder-name" className="mb-2 block text-sm">{t('foldersName')}</label><Input id="folder-name" autoFocus value={name} maxLength={120} disabled={busy} onChange={e => setName(e.target.value)} /></form>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setEdit(null)}>{t('cancel')}</Button>
          <Button variant={edit?.kind === 'delete' ? 'destructive' : 'default'} disabled={busy || (edit?.kind !== 'delete' && !name.trim())} onClick={() => void confirmEdit()}>{t(edit?.kind === 'delete' ? 'delete' : 'saveChanges')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(move)} onOpenChange={open => { if (!open && !busy) setMove(null); }}>
      <DialogContent><DialogHeader><DialogTitle>{t('foldersMove')}</DialogTitle><DialogDescription>{t('foldersMoveDescription')}</DialogDescription></DialogHeader>
        <label htmlFor="folder-destination" className="text-sm">{t('foldersDestination')}</label>
        <select id="folder-destination" value={destination} onChange={e => setDestination(e.target.value)} disabled={busy} className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm">
          <option value="">{t('foldersRoot')}</option>
          {folders.filter(folder => !(move && 'folder' in move && folderPath(folders, folder.id).some(f => f.id === move.folder.id)))
            .map(folder => ({ ...folder, path: folderPath(folders, folder.id).map(f => f.name).join(' / ') }))
            .sort((a, b) => a.path.localeCompare(b.path)).map(folder => <option key={folder.id} value={folder.id}>{folder.path}</option>)}
        </select>
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setMove(null)}>{t('cancel')}</Button><Button disabled={busy} onClick={() => void confirmMove()}>{t('foldersMoveHere')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
