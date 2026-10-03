import { Button } from './ui/button';
import { Link, useLocation, useNavigate } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { Globe, LogOut, Menu, UserCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeToggle } from './ThemeToggle';
import { clearAuth, loadAuth, subscribeAuth, type AuthUser } from '../api/auth';
import { toast } from 'sonner';
import { useI18n } from './I18nProvider';
import { useConfirmDiscard } from './UnsavedChangesProvider';

const navItems = [
  { labelKey: 'navSolutions', path: '/solutions' },
  { labelKey: 'navHome', path: '/' },
  { labelKey: 'navVirtualGallery', path: '/virtual-gallery' },
  { labelKey: 'navExhibitions', path: '/exhibitions' },
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
  const confirmDiscard = useConfirmDiscard();

  useEffect(() => {
    const syncAuth = () => setAuthUser(loadAuth().user);
    const unsubscribe = subscribeAuth(syncAuth);
    syncAuth();
    window.addEventListener('storage', syncAuth);
    window.addEventListener('focus', syncAuth);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener('focus', syncAuth);
    };
  }, []);

  useEffect(() => {
    setAuthUser(loadAuth().user);
  }, [location.pathname]);

  const isLoggedIn = !!authUser;
  const desktopItems = isLoggedIn ? [
    { labelKey: 'navSolutions', path: '/solutions' },
    { labelKey: 'myExhibitions', path: '/virtual-gallery/my-exhibitions' },
    { labelKey: 'navClasses', path: '/graduation' },
  ] : navItems.filter(item => ['/exhibitions', '/virtual-gallery', '/solutions'].includes(item.path));
  const menuItems = isLoggedIn
    ? [...desktopItems, ...navItems.filter(item => !desktopItems.some(desktopItem => desktopItem.path === item.path))]
    : navItems;
  const initials = useMemo(() => (authUser?.name || authUser?.email || 'U').slice(0, 1).toUpperCase(), [authUser]);

  const handleLogout = () => confirmDiscard(() => {
    clearAuth();
    setAuthUser(null);
    setMobileMenuOpen(false);
    toast.success(t('loggedOut'));
    navigate('/');
  });

  return (
    <nav className={`sticky top-0 z-50 border-b border-border bg-card/90 shadow-[0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md dark:bg-card/90 home-navigation`}>
      <div className="home-navigation-inner mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="home-navigation-row flex h-16 items-center justify-between gap-4">
          <Link to="/" aria-label="META EXB" className="group flex min-w-0 items-center gap-2 text-left text-base font-semibold tracking-tight text-foreground">
            <img src="/brand/metaexb-icon-v1.png" alt="" width={48} height={48} className="home-brand-icon size-12 shrink-0 rounded-lg bg-[#a82e23] object-contain" />
            <span className="home-brand">META EXB</span>
          </Link>

          <div className="hidden items-center gap-2 xl:flex">
            {desktopItems.map((item) => {
              const isActive = isActivePath(location.pathname, item.path);
              const label = t(item.labelKey);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? "page" : undefined}
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

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={toggleLocale} className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-card px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:px-3" aria-label={t('switchLocale')}>
              <Globe className="size-4" />
              {locale === 'zh-TW' ? t('localeTraditional') : locale === 'zh-CN' ? t('localeSimplified') : t('localeEnglish')}
            </button>
            <ThemeToggle />
            <div className="hidden items-center gap-2 lg:flex">
              {isLoggedIn ? (
                <>
                  <Link to="/profile" aria-label={t('profile')} title={authUser?.name} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">{initials}</span>
                    <span className="max-w-28 truncate xl:hidden 2xl:inline">{authUser?.name}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label={t('logout')}
                    title={t('logout')}
                    className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <LogOut className="size-4" />
                    <span className="xl:hidden 2xl:inline">{t('logout')}</span>
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                    {t('login')}
                  </Link>
                </>
              )}
            </div>
            <Button asChild className="home-nav-create hidden rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-curator-brass md:inline-flex">
              <Link to="/virtual-gallery/quick-create">{t('createNewExhibition')}</Link>
            </Button>

            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <Link to="/profile" aria-label={t('profile')} className="hidden h-10 items-center gap-1 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex md:hidden">
                  <UserCircle2 className="size-4" />
                  {initials}
                </Link>
              ) : (
                <Link to="/login" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex md:hidden">{t('login')}</Link>
              )}
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? t('closeMenu') : t('openMenu')}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation"
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
            id="mobile-navigation"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border bg-card"
          >
            <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
              <Button asChild className="home-nav-create mb-3 w-full rounded-md bg-primary text-primary-foreground transition-colors hover:bg-curator-brass">
                <Link to="/virtual-gallery/quick-create" onClick={() => setMobileMenuOpen(false)}>{t('createNewExhibition')}</Link>
              </Button>
              <div className="grid gap-1">
                {menuItems.map((item, i) => {
                  const isActive = isActivePath(location.pathname, item.path);
                  const label = t(item.labelKey);
                  return (
                    <motion.div
                      key={item.path}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Link
                        to={item.path}
                        aria-current={isActive ? 'page' : undefined}
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
                    <p className="px-3 text-xs font-semibold text-muted-foreground">{t('navWorkspace')}</p>
                    <Link to="/cv" onClick={() => setMobileMenuOpen(false)} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">{t('navCv')}</Link>
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
