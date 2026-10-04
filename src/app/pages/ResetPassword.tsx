import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useI18n } from '@/app/components/I18nProvider';
import { confirmPasswordReset, requestPasswordReset } from '@/app/api/passwordReset';
import { clearAuth } from '@/app/api/auth';
import { authPageLink, safeAuthReturnTo } from '@/app/utils/galleryEntry';

export default function ResetPassword() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || (!token && cooldown)) return;
    setError('');
    if (token && password !== confirmation) { setError(t('resetMismatch')); return; }
    if (token && (password.length < 8 || new TextEncoder().encode(password).length > 72)) { setError(t('resetPasswordHelp')); return; }
    setBusy(true);
    try {
      if (token) {
        await confirmPasswordReset(token, password, locale);
        clearAuth(); setDone(true); setPassword(''); setConfirmation('');
        navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true });
      } else {
        await requestPasswordReset(email.trim(), locale);
        setAccepted(true); setCooldown(60);
      }
    } catch (failure) {
      const code = failure instanceof Error && 'code' in failure ? String(failure.code) : '';
      // RESET_UNAVAILABLE means email delivery is not configured; retrying or checking the network will not help.
      setError(t(['INVALID_RESET_TOKEN', 'INVALID_RESET_INPUT'].includes(code) ? 'resetInvalid' : code === 'RESET_UNAVAILABLE' ? 'resetUnavailable' : 'resetRetry'));
    } finally { setBusy(false); }
  }
  return <main className="min-h-[calc(100vh-8rem)] bg-background px-4 py-12 text-foreground">
    <section className="mx-auto max-w-md space-y-5 rounded-md border border-border bg-card p-6" aria-labelledby="reset-title">
      <h1 id="reset-title" className="text-xl font-semibold">{t('resetTitle')}</h1>
      <p className="text-sm text-muted-foreground" role={done ? 'status' : undefined}>{t(done ? 'resetDone' : token ? 'resetLinkIntro' : 'resetIntro')}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!done && <form onSubmit={submit} className="space-y-4">
        {token ? <>
          <div><label htmlFor="reset-password">{t('resetPassword')}</label><Input id="reset-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} aria-describedby="reset-password-help" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <p id="reset-password-help" className="text-xs text-muted-foreground">{t('resetPasswordHelp')}</p>
          <div><label htmlFor="reset-confirm">{t('resetConfirm')}</label><Input id="reset-confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>
        </> : <div><label htmlFor="reset-email">{t('email')}</label><Input id="reset-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></div>}
        {accepted && !token && <p role="status" className="text-sm text-muted-foreground">{t('resetAccepted')}</p>}
        <Button type="submit" className="w-full" disabled={busy || (!token && cooldown > 0)}>{busy ? t('resetBusy') : token ? t('resetSubmit') : cooldown ? t('resetCooldown', { seconds: cooldown }) : t('resetSend')}</Button>
      </form>}
      {!done && token && <Link to={{ pathname: '/reset-password', search: location.search }} onClick={() => { setError(''); setPassword(''); setConfirmation(''); }} className="inline-flex min-h-11 items-center text-sm underline">{t('resetNewLink')}</Link>}
      <Link to={authPageLink('login', safeAuthReturnTo(params.get('returnTo')))} className="flex min-h-11 items-center text-sm underline">{t('loginNow')}</Link>
    </section>
  </main>;
}
