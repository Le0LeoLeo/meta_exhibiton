import { useState } from 'react';
import { useI18n } from '@/app/components/I18nProvider';
import { Button } from '@/app/components/ui/button';
import { downloadRecoveryScene, readRecoveryScene } from '@/app/utils/releaseRecovery';
import { useSceneDeliveryStore } from '../../network/sceneDeliveryMonitor';
import { useReconnectDraftStore } from '../../network/reconnectDraftStore';
import { useMultiplayerStore } from '../../network/multiplayerStore';

export function MultiplayerDeliveryStatus() {
  const { t } = useI18n();
  const { pendingCount, delayed } = useSceneDeliveryStore();
  const review = useReconnectDraftStore(state => state.draft);
  const connected = useMultiplayerStore(state => state.connected);
  const role = useMultiplayerStore(state => state.role);
  const missing = useMultiplayerStore(state => state.sceneRecoveryRequested && state.roomError?.code === 'SCENE_MISSING');
  const [failed, setFailed] = useState(false);
  if (!pendingCount && !review) return null;
  return <div role={delayed || review ? 'alert' : 'status'} className="space-y-2 rounded-md border border-border bg-card p-3 text-sm text-card-foreground">
    <p>{t(review ? review.remote && connected ? 'reconnectReview' : 'reconnectWaiting' : delayed ? 'syncDelayed' : 'syncWaiting')}</p>
    {(delayed || review) && <Button variant="outline" onClick={() => {
      try {
        const scene = readRecoveryScene();
        if (!scene) throw new Error('Scene unavailable');
        downloadRecoveryScene(scene); setFailed(false);
      } catch { setFailed(true); }
    }}>{t('updateDownload')}</Button>}
    {review?.remote && connected && <div className="flex flex-wrap gap-2">
      <Button disabled={role !== 'owner' && role !== 'editor'} onClick={() => useReconnectDraftStore.setState({ decision: 'merge' })}>{t('reconnectMerge')}</Button>
      <Button variant="outline" onClick={() => useReconnectDraftStore.setState({ decision: 'remote' })}>{t('reconnectRemote')}</Button>
    </div>}
    {review && !review.remote && connected && missing && <Button disabled={role !== 'owner' && role !== 'editor'} onClick={() => useReconnectDraftStore.setState({ decision: 'merge' })}>{t('reconnectRebuild')}</Button>}
    {failed && <p>{t('updateDownloadFailed')}</p>}
  </div>;
}
