import { useEffect, useState } from 'react';
import { Copy, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { GallerySummary } from '../api/gallery';
import { useI18n } from './I18nProvider';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { generateExhibitionQr } from './exhibitionQr';

type Props = { gallery: GallerySummary | null; open: boolean; onOpenChange: (open: boolean) => void };

export function ExhibitionShareDialog({ gallery, open, onOpenChange }: Props) {
  const { t } = useI18n();
  const visitorUrl = gallery?.isPublished
    ? `${window.location.origin}/exhibitions/${encodeURIComponent(gallery.id)}` : '';
  const [qr, setQr] = useState<{ url: string; image: string; error: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setQr(null);
    if (open && visitorUrl) {
      void generateExhibitionQr(visitorUrl).then(image => {
        if (!cancelled) setQr({ url: visitorUrl, image, error: false });
      }).catch(() => {
        if (!cancelled) setQr({ url: visitorUrl, image: '', error: true });
      });
    }
    return () => { cancelled = true; };
  }, [open, visitorUrl, retry]);
  const currentQr = qr?.url === visitorUrl ? qr : null;
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('copiedViewShareLink'));
    } catch {
      toast.error(t('copyFailed'), { description: t('pleaseCopyManually') });
    }
  };
  const downloadName = `${(gallery?.title || 'exhibition').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 80)}-QR.png`;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{t('shareExhibition')}</DialogTitle>
        <DialogDescription>{t('shareQrDescription')}</DialogDescription>
      </DialogHeader>
      <p className="min-w-0 break-words text-center font-medium">{gallery?.title}</p>
      {visitorUrl ? <div className="min-w-0 space-y-4">
        <div className="mx-auto flex aspect-square w-full max-w-64 items-center justify-center rounded-md bg-white text-black">
          {currentQr?.image ? <img src={currentQr.image} alt={t('shareQrImageAlt')} width={256} height={256} className="h-auto w-full rounded-md" />
            : currentQr?.error ? <div className="p-4 text-center">
              <p role="alert" className="text-sm">{t('shareQrError')}</p>
              <Button className="mt-3 bg-black text-white hover:bg-black/80" onClick={() => setRetry(value => value + 1)}>{t('shareQrRetry')}</Button>
            </div> : <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />{t('shareQrLoading')}</p>}
        </div>
        <p className="text-center text-sm text-muted-foreground">{t('shareQrVisitorHint')}</p>
        <label className="block space-y-2 text-sm">
          <span>{t('shareQrVisitorLink')}</span>
          <Input readOnly value={visitorUrl} onFocus={event => event.target.select()} />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={() => void copy(visitorUrl)}><Copy className="mr-2 size-4" />{t('shareQrCopy')}</Button>
          {currentQr?.image ? <Button asChild><a href={currentQr.image} download={downloadName}><Download className="mr-2 size-4" />{t('shareQrDownload')}</a></Button>
            : <Button disabled><Download className="mr-2 size-4" />{t('shareQrDownload')}</Button>}
        </div>
      </div> : <p role="status" className="rounded-md border border-border bg-secondary p-4 text-sm leading-6">{t('shareQrPublishFirst')}</p>}
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{t('close')}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
