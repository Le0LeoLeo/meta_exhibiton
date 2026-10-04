import { useState } from 'react';
import { useI18n } from '@/app/components/I18nProvider';
import { Button } from '@/app/components/ui/button';
import { setJourneyConsent, useJourneyConsent } from './journey';
export function JourneyConsent({ settings = false }: { settings?: boolean }) {
  const { t } = useI18n(); const state = useJourneyConsent();
  const [failed, setFailed] = useState(false); const [busy, setBusy] = useState(false);
  if (!settings && state !== 'unknown') return null;
  const choose = async (allowed: boolean) => { setBusy(true); setFailed(false); try { await setJourneyConsent(allowed); } catch { setFailed(true); } finally { setBusy(false); } };
  return <section aria-label={t('usageTitle')} className="mx-auto my-6 max-w-4xl space-y-3 rounded-xl border border-border bg-card p-5 text-foreground">
    <h2 className="font-semibold">{t('usageTitle')}</h2><p className="text-sm leading-7 text-muted-foreground">{t('usageCopy')}</p>
    {settings && <p className="text-sm leading-7">{t('usagePolicy')}</p>}
    <p role="status" className="text-sm">{t(state === 'blocked' ? 'usageSignal' : state === 'allowed' ? 'usageOn' : 'usageOff')}</p>
    <div className="flex flex-wrap gap-3">
      {state !== 'allowed' && state !== 'blocked' && <Button variant="outline" disabled={busy} onClick={() => void choose(true)}>{t('usageAccept')}</Button>}
      {state !== 'blocked' && <Button variant="outline" disabled={busy} onClick={() => void choose(false)}>{t(state === 'allowed' ? 'usageWithdraw' : 'usageDecline')}</Button>}
      {state === 'blocked' && settings && <Button variant="outline" disabled={busy} onClick={() => void choose(false)}>{t('usageWithdraw')}</Button>}
      {!settings && <a className="inline-flex min-h-11 items-center text-sm underline" href="/privacy">{t('usagePrivacy')}</a>}
    </div>
    {failed && <div role="alert"><p>{t('usageWithdrawFailed')}</p><Button disabled={busy} onClick={() => void choose(false)}>{t('usageRetryDelete')}</Button></div>}
  </section>;
}
