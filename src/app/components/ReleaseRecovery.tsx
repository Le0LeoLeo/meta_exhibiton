import { useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';
import { Button } from './ui/button';
import { captureRecoveryScene, downloadRecoveryScene, hasRecoveryScene, readRecoveryScene } from '@/app/utils/releaseRecovery';

export function RecoveryActions({ reload = () => window.location.reload() }: { reload?: () => void }) {
  const { t } = useI18n();
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const save = () => {
    try {
      const scene = readRecoveryScene();
      if (scene) { downloadRecoveryScene(scene); setDownloaded(scene); }
      setError(false);
    } catch { setError(true); }
  };
  const refresh = () => {
    try {
      const scene = readRecoveryScene();
      if (scene && scene !== downloaded) { save(); return; }
      reload();
    } catch { setError(true); }
  };
  return <div className="space-y-3">
    {hasRecoveryScene() && <p className="text-sm">{t('updateScene')}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{t('updateDownloadFailed')}</p>}
    <div className="flex flex-wrap justify-center gap-3">
      {hasRecoveryScene() && <Button variant="outline" onClick={save}>{t('updateDownload')}</Button>}
      <Button onClick={refresh}>{t('updateReload')}</Button>
    </div>
  </div>;
}

export function ReleaseRecovery() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onError = () => { captureRecoveryScene(); setOpen(true); };
    const onHandled = () => setOpen(false);
    window.addEventListener('vite:preloadError', onError);
    window.addEventListener('metaexb:recovery-handled', onHandled);
    return () => { window.removeEventListener('vite:preloadError', onError); window.removeEventListener('metaexb:recovery-handled', onHandled); };
  }, []);
  if (!open) return null;
  return <aside role="region" aria-label={t('updateTitle')} className="fixed inset-x-4 bottom-4 z-[10000] mx-auto max-w-xl space-y-3 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl">
    <h2 className="font-semibold">{t('updateTitle')}</h2>
    <p className="text-sm">{t('updateMessage')}</p>
    <RecoveryActions />
    <Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>{t('updateLater')}</Button>
  </aside>;
}
