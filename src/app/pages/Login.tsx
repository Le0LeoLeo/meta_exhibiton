import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { loginUser, loginWithGoogle, saveAuth } from '../api/client';
import { useI18n } from '../components/I18nProvider';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { authPageLink, isExhibitionCreationReturn, safeAuthReturnTo } from '../utils/galleryEntry';

export default function Login() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [searchParams] = useSearchParams();
  const returnTo = safeAuthReturnTo(searchParams.get('returnTo'));
  const continuingCreation = isExhibitionCreationReturn(returnTo);
  const openingGallery = returnTo.startsWith('/virtual-gallery/create?') && new URL(returnTo, 'https://metaexb.com').searchParams.has('exhibitionId');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string; form?: string } = {};
    if (!email.trim()) newErrors.email = t('requiredEmail');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = t('invalidEmail');
    if (!password) newErrors.password = t('requiredPassword');
    else if (password.length < 8) newErrors.password = t('shortPassword');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const auth = await loginUser({ email: email.trim(), password });
      saveAuth(auth, { remember: rememberMe });
      toast.success(t('loginSuccess'), { description: t('loginSuccessDesc', { name: auth.user.name }) });
      navigate(returnTo);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EMAIL_VERIFICATION_REQUIRED') {
        setPassword('');
        navigate(`/verify-email?returnTo=${encodeURIComponent(returnTo)}`, { state: { email: email.trim() } });
        return;
      }
      setErrors((prev) => ({ ...prev, form: error instanceof Error ? error.message : t('loginFailedDesc') }));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setGoogleLoading(true);
    setErrors((prev) => ({ ...prev, form: undefined }));
    try {
      const auth = await loginWithGoogle(credential);
      saveAuth(auth, { remember: rememberMe });
      toast.success(t('loginSuccess'), {
        description: t('loginSuccessDesc', { name: auth.user.name }),
      });
      navigate(returnTo);
    } catch (error) {
      setErrors((prev) => ({ ...prev, form: error instanceof Error ? error.message : t('googleLoginFailed') }));
    } finally {
      setGoogleLoading(false);
    }
  }, [navigate, rememberMe, returnTo, t]);

  return (
    <div className="museum-auth bg-background text-foreground">
      <div className="museum-auth-layout">
        <aside className="museum-auth-aside"><p className="home-eyebrow">PAIDEA</p><h2>{t('homeTitle')}<br />{t('homeTitleEnd')}</h2><p>{t('homeFooter')}</p><Link to="/demo" className="home-text-link">{t('entryDemoAction')} →</Link></aside>
        <motion.div className="museum-auth-form" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="rounded-md border border-border bg-card p-6 text-foreground">
            <motion.div className="mb-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>

              <h1 className="mb-3 text-foreground">{t('loginWelcome')}</h1>
              <p className="text-sm text-muted-foreground">{t('loginSubtitle')}</p>
            </motion.div>

            {(continuingCreation || openingGallery) && (
              <div className="mb-5 rounded-md border border-border bg-secondary p-4 text-sm">
                <p className="text-foreground">{t(openingGallery ? 'entryAuthOpenGallery' : 'authContinueExhibition')}</p>
                {continuingCreation && <p className="mt-1 text-muted-foreground">{t('authKeepSelection')}</p>}
                <Link to="/demo" className="mt-3 inline-block font-medium text-foreground underline underline-offset-4">{t('entryDemoAction')}</Link>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <label htmlFor="login-email" className="mb-1.5 block text-sm text-muted-foreground">{t('email')}</label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  placeholder={t('emailPlaceholder')}
                  className={`w-full ${errors.email ? 'border-destructive' : ''}`}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined, form: undefined })); }}
                />
                {errors.email && <motion.p id="login-email-error" className="mt-1 text-xs text-destructive" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{errors.email}</motion.p>}
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                <label htmlFor="login-password" className="mb-1.5 block text-sm text-muted-foreground">{t('password')}</label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                    placeholder={t('passwordPlaceholder')}
                    className={`w-full pr-10 ${errors.password ? 'border-destructive' : ''}`}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined, form: undefined })); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={t(showPassword ? 'hidePasswordLabel' : 'showPasswordLabel', { label: t('password') })}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && <motion.p id="login-password-error" className="mt-1 text-xs text-destructive" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{errors.password}</motion.p>}
              </motion.div>

              <motion.div className="flex items-center justify-between" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" checked={rememberMe} onCheckedChange={(c) => setRememberMe(c as boolean)} />
                  <label htmlFor="remember" className="cursor-pointer text-sm text-muted-foreground">{t('rememberMe')}</label>
                </div>
                <Link to={`/reset-password?returnTo=${encodeURIComponent(returnTo)}`} className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {t('forgotPassword')}
                </Link>
              </motion.div>

              {errors.form && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <p className="font-medium">{t('loginFailed')}</p>
                  <p className="mt-0.5">{errors.form}</p>
                </div>
              )}

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                <motion.div >
                  <Button type="submit" className="w-full bg-primary py-5 text-primary-foreground hover:bg-curator-brass" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {t('loggingIn')}
                      </span>
                    ) : t('loginButton')}
                  </Button>
                </motion.div>
              </motion.div>

              <div className="space-y-5 pt-2">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  <span className="shrink-0 text-xs text-muted-foreground">{t('orSocialLogin')}</span>
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                </div>
                <GoogleSignInButton
                  onCredential={handleGoogleCredential}
                  disabled={googleLoading}
                  unavailableTitle={t('googleLoginUnavailable')}
                  locale={locale}
                />
              </div>
            </form>

            <div className="mt-5 text-center">
              <p className="text-sm text-muted-foreground">
                {t('noAccount')}{' '}
                <Link to={authPageLink('register', returnTo)} className="text-tool-blue transition-colors hover:text-foreground">{t('registerNow')}</Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
