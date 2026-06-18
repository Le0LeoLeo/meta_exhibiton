import { Button } from './ui/button';
import { Link, useLocation, useNavigate } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { Globe, LogOut, Menu, UserCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeToggle } from './ThemeToggle';
import { clearAuth, loadAuth, type AuthUser } from '../api/auth';
import { toast } from 'sonner';
import { useI18n } from './I18nProvider';

const navItems = [
  { labelKey: 'navHome', path: '/' },
  { labelKey: 'navVirtualGallery', path: '/virtual-gallery' },
  { labelKey: 'navExhibitions', path: '/exhibitions' },
  { label: '解決方案', path: '/solutions' },
  { labelKey: 'navCompetitions', path: '/competitions' },
  { labelKey: 'navSupport', path: '/support' },
  { labelKey: 'navResources', path: '/resources' },
];

function isActivePath(pathname: string, path: string) {
  return pathname === path || (path !== '/' && pathname.startsWith(path));
}

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => loadAuth().user);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, locale, toggleLocale } = useI18n();

  useEffect(() => {
    const syncAuth = () => setAuthUser(loadAuth().user);
    syncAuth();
    window.addEventListener('storage', syncAuth);
    window.addEventListener('focus', syncAuth);
    return () => {
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener('focus', syncAuth);
    };
  }, []);

  useEffect(() => {
    setAuthUser(loadAuth().user);
  }, [location.pathname]);

  const isLoggedIn = !!authUser;
  const initials = useMemo(() => (authUser?.name || authUser?.email || 'U').slice(0, 1).toUpperCase(), [authUser]);

  const handleLogout = () => {
    clearAuth();
    setAuthUser(null);
    setMobileMenuOpen(false);
    toast.success(t('loggedOut'));
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/90 shadow-[0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md dark:bg-card/90">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="group shrink-0 text-left text-base font-semibold tracking-tight text-foreground">
            <span className="block leading-tight transition-transform duration-200 group-hover:-translate-y-px">{t('appName')}</span>
            <span className="block text-xs font-medium text-muted-foreground transition-colors group-hover:text-curator-brass">{t('appShort')}</span>
          </Link>

          <div className="hidden items-center gap-2 xl:flex">
            {navItems.map((item) => {
              const isActive = isActivePath(location.pathname, item.path);
              const label = 'labelKey' in item ? t(item.labelKey) : item.label;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-x-3 -bottom-0.5 h-px rounded-full bg-curator-brass"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={toggleLocale} className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-card px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:px-3" aria-label={t('switchLocale')}>
              <Globe className="size-4" />
              {locale === 'zh-TW' ? t('localeTraditional') : locale === 'zh-CN' ? t('localeSimplified') : t('localeEnglish')}
            </button>
            <ThemeToggle />
            <div className="hidden items-center gap-2 md:flex">
              {isLoggedIn ? (
                <>
                  <Link to="/profile" className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">{initials}</span>
                    <span className="max-w-28 truncate">{authUser?.name}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <LogOut className="size-4" />
                    {t('logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                    {t('login')}
                  </Link>
                  <Link to="/register">
                    <Button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-curator-brass">
                      {t('register')}
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 xl:hidden">
              {isLoggedIn ? (
                <button type="button" onClick={handleLogout} className="inline-flex h-10 items-center gap-1 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden">
                  <UserCircle2 className="size-4" />
                  {initials}
                </button>
              ) : (
                <Link to="/login" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex md:hidden">{t('login')}</Link>
              )}
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? t('closeMenu') : t('openMenu')}
              >
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border bg-card xl:hidden"
          >
            <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
              <div className="grid gap-1">
                {navItems.map((item, i) => {
                  const isActive = isActivePath(location.pathname, item.path);
                  const label = 'labelKey' in item ? t(item.labelKey) : item.label;
                  return (
                    <motion.div
                      key={item.path}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Link
                        to={item.path}
                        className={`block rounded-md px-3 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'border-l-2 border-curator-brass bg-secondary text-foreground'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {label}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                {isLoggedIn ? (
                  <div className="grid gap-2">
                    <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                      {t('profile')}
                    </Link>
                    <button type="button" onClick={handleLogout} className="rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                      {t('logout')}
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                      {t('login')}
                    </Link>
                    <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full rounded-md bg-primary text-primary-foreground transition-colors hover:bg-curator-brass">
                        {t('register')}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
