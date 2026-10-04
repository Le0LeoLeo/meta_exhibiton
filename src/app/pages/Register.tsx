import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Check } from 'lucide-react';
import { toast } from 'sonner';
import { loginWithGoogle, registerUser, saveAuth } from '../api/client';
import { useI18n } from '../components/I18nProvider';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { authPageLink, isExhibitionCreationReturn, safeAuthReturnTo } from '../utils/galleryEntry';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeAuthReturnTo(searchParams.get('returnTo'));
  const continuingCreation = isExhibitionCreationReturn(returnTo);
  const openingGallery = returnTo.startsWith('/virtual-gallery/create?') && new URL(returnTo, 'https://metaexb.com').searchParams.has('exhibitionId');
  const { t, locale } = useI18n();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { level: 1, label: t('strengthWeak'), color: 'bg-destructive' };
    if (score <= 2) return { level: 2, label: t('strengthMedium'), color: 'bg-warning-quiet' };
    if (score <= 3) return { level: 3, label: t('strengthStrong'), color: 'bg-tool-blue' };
    return { level: 4, label: t('strengthVeryStrong'), color: 'bg-success-quiet' };
  };

  const strength = getPasswordStrength(form.password);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('requiredName');
    if (!form.email.trim()) errs.email = t('requiredEmail');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('invalidEmail');
    if (!form.password) errs.password = t('requiredPassword');
    else if (form.password.length < 8) errs.password = t('shortPassword');
    if (!form.confirmPassword) errs.confirmPassword = t('confirmPassword');
    else if (form.password !== form.confirmPassword) errs.confirmPassword = t('confirmPasswordMismatch');
    if (!agreeTerms) errs.terms = t('agreeTerms');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const auth = await registerUser({ name: form.name, email: form.email, password: form.password, locale, returnTo });
      if ('verificationRequired' in auth) {
        setForm((previous) => ({ ...previous, password: '', confirmPassword: '' }));
        navigate(`/verify-email?returnTo=${encodeURIComponent(returnTo)}`, { state: { email: auth.email, deliveryStatus: auth.deliveryStatus } });
        return;
      }
      saveAuth(auth, { remember: true });
      toast.success(t('registerSuccess'), { description: t('registerSuccessDesc', { name: auth.user.name }) });
      navigate(returnTo);
    } catch (error) {
      toast.error(t('registerFailed'), { description: error instanceof Error ? error.message : t('registerFailedDesc') });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setGoogleLoading(true);
    try {
      const auth = await loginWithGoogle(credential);
      saveAuth(auth, { remember: true });
      toast.success(t('loginSuccess'), { description: t('loginSuccessDesc', { name: auth.user.name }) });
      navigate(returnTo);
    } catch (error) {
      toast.error(t('googleLoginFailed'), {
        description: error instanceof Error ? error.message : t('googleLoginFailed'),
      });
    } finally {
      setGoogleLoading(false);
    }
  }, [navigate, returnTo, t]);

  const renderField = (field: string, label: string, placeholder: string, type: string, delay: number) => {
    const isPasswordField = field === 'password' || field === 'confirmPassword';
    const showPwd = field === 'password' ? showPassword : showConfirm;
    const togglePwd = field === 'password' ? () => setShowPassword(!showPassword) : () => setShowConfirm(!showConfirm);
    const fieldId = `register-${field}`;
    const autoComplete = { name: 'name', email: 'email', password: 'new-password', confirmPassword: 'new-password' }[field];

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay }}>
        <label htmlFor={fieldId} className="mb-1.5 block text-sm text-muted-foreground">{label}</label>
        <div className="relative">
          <Input
            id={fieldId}
            type={isPasswordField ? (showPwd ? 'text' : 'password') : type}
            autoComplete={autoComplete}
            aria-invalid={Boolean(errors[field])}
            aria-describedby={errors[field] ? `${fieldId}-error` : undefined}
            placeholder={placeholder}
            className={`w-full ${isPasswordField ? 'pr-10' : ''} ${errors[field] ? 'border-destructive' : ''}`}
            value={form[field as keyof typeof form]}
            onChange={(e) => updateField(field, e.target.value)}
          />
          {isPasswordField && (
            <button
              type="button"
              onClick={togglePwd}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t(showPwd ? 'hidePasswordLabel' : 'showPasswordLabel', { label })}
              aria-pressed={showPwd}
            >
              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          )}
        </div>
        {field === 'password' && form.password && (
          <div className="mt-2">
            <div className="mb-1 flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.level ? strength.color : 'bg-secondary'}`} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('passwordStrength')} {strength.label}</p>
          </div>
        )}
        {errors[field] && <motion.p id={`${fieldId}-error`} className="mt-1 text-xs text-destructive" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{errors[field]}</motion.p>}
      </motion.div>
    );
  };

  const featureIcons = [
    { label: t('featureVirtualGallery'), color: 'text-tool-blue' },
    { label: t('featureMultiplayer'), color: 'text-curator-brass' },
    { label: t('homeAgentTitle'), color: 'text-success-quiet' },
  ];

  return (
    <div className="museum-auth bg-background text-foreground">
      <div className="museum-auth-layout">
        <aside className="museum-auth-aside"><p className="home-eyebrow">PAIDEA</p><h2>{t('homeTitle')}<br />{t('homeTitleEnd')}</h2><p>{t('homeFooter')}</p><Link to="/demo" className="home-text-link">{t('entryDemoAction')} →</Link></aside>
        <motion.div className="museum-auth-form" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="rounded-md border border-border bg-card p-6 text-foreground">
            <motion.div className="mb-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>

              <h1 className="mb-3 text-foreground">{t('registerTitle')}</h1>
              <p className="text-sm text-muted-foreground">{t('registerSubtitle')}</p>
            </motion.div>

            {(continuingCreation || openingGallery) && (
              <div className="mb-5 rounded-md border border-border bg-secondary p-4 text-sm">
                <p className="text-foreground">{t(openingGallery ? 'entryAuthOpenGallery' : 'authContinueExhibition')}</p>
                {continuingCreation && <p className="mt-1 text-muted-foreground">{t('authKeepSelection')}</p>}
                <Link to="/demo" className="mt-3 inline-block font-medium text-foreground underline underline-offset-4">{t('entryDemoAction')}</Link>
              </div>
            )}

            <form className="space-y-3.5" onSubmit={handleSubmit}>
              {renderField('name', t('name'), t('namePlaceholder'), 'text', 0.2)}
              {renderField('email', t('email'), t('emailPlaceholder'), 'email', 0.25)}
              {renderField('password', t('password'), t('passwordPlaceholder'), 'password', 0.3)}
              {renderField('confirmPassword', t('confirmPassword'), t('confirmPasswordPlaceholder'), 'password', 0.35)}

              <motion.div className="flex items-start space-x-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <Checkbox id="terms" className="mt-1" checked={agreeTerms} onCheckedChange={(c) => { setAgreeTerms(c as boolean); setErrors((p) => ({ ...p, terms: '' })); }} />
                <label htmlFor="terms" className="cursor-pointer text-sm text-muted-foreground">
                  {t('termsPrefix')}{' '}
                  <Link to="/terms" className="text-tool-blue transition-colors hover:text-foreground" onClick={(event) => event.stopPropagation()}>{t('terms')}</Link>
                  {' / '}
                  <Link to="/privacy" className="text-tool-blue transition-colors hover:text-foreground" onClick={(event) => event.stopPropagation()}>{t('privacyPolicy')}</Link>
                </label>
              </motion.div>
              {errors.terms && <motion.p className="text-xs text-destructive" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{errors.terms}</motion.p>}

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
                <motion.div >
                  <Button type="submit" className="w-full bg-primary py-5 text-primary-foreground hover:bg-curator-brass" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {t('creatingAccount')}
                      </span>
                    ) : t('createAccount')}
                  </Button>
                </motion.div>
              </motion.div>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">{t('orSocialRegister')}</span></div>
              </div>

              <GoogleSignInButton
                onCredential={handleGoogleCredential}
                disabled={googleLoading}
                unavailableTitle={t('googleLoginUnavailable')}
                locale={locale}
              />
            </form>

            <div className="mt-5 text-center">
              <p className="text-sm text-muted-foreground">
                {t('haveAccount')}{' '}
                <Link to={authPageLink('login', returnTo)} className="text-tool-blue transition-colors hover:text-foreground">{t('loginNow')}</Link>
              </p>
            </div>

            <motion.div className="mt-6 border-t border-border pt-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
              <p className="mb-2.5 text-xs text-muted-foreground">{t('accountIncludes')}</p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {featureIcons.map((f, i) => (
                  <motion.li key={f.label} className="flex items-center" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.08 }}>
                    <Check className={`size-3.5 ${f.color} mr-2`} />
                    {f.label}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
