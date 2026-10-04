import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router';
import { loadAuth } from '@/app/api/client';
import { folderShareRequest, type GalleryFolder } from '@/app/api/galleryFolders';
import { useI18n } from '@/app/components/I18nProvider';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';

export function FolderShareDialog({ folder, onClose }: { folder: GalleryFolder; onClose: () => void }) {
  const { t } = useI18n();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const path = token ? `/folders/share/${encodeURIComponent(token)}` : '';
  const url = path ? `${window.location.origin}${path}` : '';
  useEffect(() => {
    let active = true;
    folderShareRequest(loadAuth().token || '', folder.id).then(result => { if (active) setToken(result.token); })
      .catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [folder.id]);
  async function change(method: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await folderShareRequest(loadAuth().token || '', folder.id, method);
      setToken(result.token); setConfirmRevoke(false);
      toast.success(t(result.token ? 'folderShareCreated' : 'folderShareRevoked'));
    } catch { toast.error(t('foldersFailed')); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); toast.success(t('folderShareCopied')); }
    catch { toast.error(t('folderShareCopyFailed')); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle>{t('folderShareTitle', { name: folder.name })}</DialogTitle><DialogDescription>{t('folderShareScope')}</DialogDescription></DialogHeader>
    {loading ? <p role="status" className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />{t('foldersLoading')}</p>
      : failed ? <p role="alert">{t('foldersLoadFailed')}</p>
      : token ? <div className="space-y-4">
        <p className="text-sm font-medium">{t('folderShareActive')}</p>
        <label htmlFor="folder-share-url" className="block text-sm">{t('folderShareLink')}</label>
        <Input id="folder-share-url" value={url} readOnly onFocus={e => e.target.select()} />
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void copy()}><Copy className="size-4" />{t('folderShareCopy')}</Button>
          <Button asChild variant="outline"><Link to={path} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />{t('folderSharePreview')}</Link></Button></div>
        <p className="text-sm text-muted-foreground">{t('folderShareRevokeHelp')}</p>
        {confirmRevoke ? <div className="space-y-3 rounded-md border border-destructive/40 p-3"><p>{t('folderShareRevokeConfirm')}</p><div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={busy} onClick={() => void change('DELETE')}>{t('folderShareRevoke')}</Button><Button variant="outline" disabled={busy} onClick={() => setConfirmRevoke(false)}>{t('cancel')}</Button></div></div>
          : <Button variant="outline" disabled={busy} onClick={() => setConfirmRevoke(true)}>{t('folderShareRevoke')}</Button>}
      </div> : <><p className="text-sm text-muted-foreground">{t('folderSharePrivate')}</p><Button disabled={busy} onClick={() => void change('POST')}><Link2 className="size-4" />{t('folderShareCreate')}</Button></>}
    <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>{t('folderShareClose')}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
