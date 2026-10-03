import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Mail } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useI18n } from '../components/I18nProvider';
import { confirmVerificationEmail, getAuthConfig, sendVerificationEmail } from '../api/auth';
import { authPageLink, safeAuthReturnTo } from '../utils/galleryEntry';

export default function VerifyEmail() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeAuthReturnTo(params.get('returnTo'));
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const pending = location.state as { email?: string; deliveryStatus?: string } | null;
  const [email, setEmail] = useState(pending?.email || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(pending?.deliveryStatus === 'sent');
  const [accepted, setAccepted] = useState(false);
  const [unavailable, setUnavailable] = useState(pending?.deliveryStatus === 'unavailable');
  const [cooldown, setCooldown] = useState(pending?.deliveryStatus === 'sent' ? 60 : 0);
  const [availability, setAvailability] = useState<'loading' | 'enabled' | 'disabled' | 'error'>('loading');
  const [configAttempt, setConfigAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getAuthConfig().then((config) => {
      if (active) setAvailability(config.emailVerificationEnabled ? 'enabled' : 'disabled');
    }).catch(() => { if (active) setAvailability('error'); });
    return () => { active = false; };
  }, [configAttempt]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const confirm = async () => {
    if (busy || availability !== 'enabled') return;
    setBusy(true);
    setError('');
    try {
      await confirmVerificationEmail(token);
      setVerified(true);
      navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true, state: null });
    } catch (failure) {
      const invalid = failure instanceof Error && 'status' in failure && failure.status === 400
        && 'code' in failure && failure.code === 'INVALID_VERIFICATION_TOKEN';
      setError(t(invalid ? 'verifyInvalid' : 'verifyServiceRetry'));
    } finally { setBusy(false); }
  };
  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || cooldown || availability !== 'enabled') return;
    setBusy(true);
    setError('');
    setSent(false);
    setAccepted(false);
    setUnavailable(false);
    try {
      const result = await sendVerificationEmail({ email: email.trim(), password, locale, returnTo });
      setSent(result.deliveryStatus === 'sent');
      setAccepted(result.deliveryStatus === 'accepted');
      setUnavailable(result.deliveryStatus === 'unavailable');
      if (result.deliveryStatus !== 'unavailable') setCooldown(60);
    } catch {
      setError(t('verifySendFailed'));
    } finally { setPassword(''); setBusy(false); }
  };

  return <main className="min-h-[calc(100vh-8rem)] bg-background px-4 py-12 text-foreground">
    <section className="mx-auto max-w-md space-y-5 rounded-md border border-border bg-card p-6" aria-labelledby="verify-title">
      <Mail className="size-7 text-curator-brass" aria-hidden="true" />
      <h1 id="verify-title" className="text-xl font-semibold">{t(verified ? 'verifyComplete' : 'verifyTitle')}</h1>
      <p className="text-sm text-muted-foreground">{t(verified ? 'verifyCompleteDesc' : availability === 'disabled' ? 'verifyDisabled' : availability === 'loading' ? 'verifyWorking' : availability === 'error' ? 'verifyServiceRetry' : token ? 'verifyConfirmDesc' : 'verifyPendingDesc')}</p>
      {availability === 'error' && <Button onClick={() => { setAvailability('loading'); setConfigAttempt((value) => value + 1); }}>{t('verifyRetry')}</Button>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!verified && token && <Button className="w-full" onClick={confirm} disabled={busy || availability !== 'enabled'}>{t(busy ? 'verifyWorking' : 'verifyConfirm')}</Button>}
      {!verified && (!token || error) && <>
        {sent && <p role="status" className="text-sm text-muted-foreground">{t('verifySent', { email })}</p>}
        {accepted && <p role="status" className="text-sm text-muted-foreground">{t('verifyAccepted')}</p>}
        {unavailable && <p role="alert" className="text-sm text-destructive">{t('verifyUnavailable')}</p>}
        <form onSubmit={resend} className="space-y-4">
          <div><label htmlFor="verification-email" className="mb-1 block text-sm">{t('email')}</label>
            <Input id="verification-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div><label htmlFor="verification-password" className="mb-1 block text-sm">{t('password')}</label>
            <Input id="verification-password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          <p className="text-xs text-muted-foreground">{t('verifyResendHelp')}</p>
          <Button type="submit" className="w-full" disabled={busy || cooldown > 0 || availability !== 'enabled'}>{busy ? t('verifyWorking') : cooldown ? t('verifyCooldown', { seconds: cooldown }) : t('verifyResend')}</Button>
        </form>
      </>}
      <Link to={authPageLink('login', returnTo)} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">{t('loginNow')}</Link>
    </section>
  </main>;
}
