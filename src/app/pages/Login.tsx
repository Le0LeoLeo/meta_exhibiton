import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { loginUser, saveAuth } from '../api/client';
import { useI18n } from '../components/I18nProvider';

export default function Login() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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
      setErrors((prev) => ({ ...prev, form: error instanceof Error ? error.message : t('loginFailed') }));
      toast.error(t('loginFailed'), { description: error instanceof Error ? error.message : t('loginFailedDesc') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-12">
        <motion.div className="w-full" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="rounded-md border border-border bg-card p-6 text-foreground shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)]">
            <motion.div className="mb-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md border border-border bg-secondary text-curator-brass">
                <LogIn className="size-5" />
              </div>
              <h2 className="mb-1 text-xl font-semibold text-foreground">{t('loginWelcome')}</h2>
              <p className="text-sm text-muted-foreground">{t('loginSubtitle')}</p>
            </motion.div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <label htmlFor="login-email" className="mb-1.5 block text-sm text-muted-foreground">{t('email')}</label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  className={`w-full ${errors.email ? 'border-destructive' : ''}`}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                />
                {errors.email && <motion.p className="mt-1 text-xs text-destructive" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{errors.email}</motion.p>}
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                <label htmlFor="login-password" className="mb-1.5 block text-sm text-muted-foreground">{t('password')}</label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('passwordPlaceholder')}
                    className={`w-full pr-10 ${errors.password ? 'border-destructive' : ''}`}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && <motion.p className="mt-1 text-xs text-destructive" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{errors.password}</motion.p>}
              </motion.div>

              <motion.div className="flex items-center justify-between" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" checked={rememberMe} onCheckedChange={(c) => setRememberMe(c as boolean)} />
                  <label htmlFor="remember" className="cursor-pointer text-sm text-muted-foreground">{t('rememberMe')}</label>
                </div>
                <button type="button" className="text-sm text-muted-foreground transition-colors hover:text-foreground" onClick={() => toast.info(t('forgotPasswordSent'), { description: t('forgotPasswordCheckEmail') })}>
                  {t('forgotPassword')}
                </button>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
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

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">{t('orSocialLogin')}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <motion.div whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Button type="button" variant="outline" className="w-full" onClick={() => toast.info(t('googleLogin'), { description: t('googleLoginDesc') })}>
                    <svg className="size-4 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </Button>
                </motion.div>
                <motion.div whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <Button type="button" variant="outline" className="w-full" onClick={() => toast.info(t('githubLogin'), { description: t('githubLoginDesc') })}>
                    <svg className="size-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                    </svg>
                    GitHub
                  </Button>
                </motion.div>
              </div>
            </form>

            <div className="mt-5 text-center">
              <p className="text-sm text-muted-foreground">
                {t('noAccount')}{' '}
                <Link to="/register" className="text-tool-blue transition-colors hover:text-foreground">{t('registerNow')}</Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
