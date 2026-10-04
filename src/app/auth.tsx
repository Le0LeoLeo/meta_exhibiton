import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { getMe, loadAuth, saveAuth, subscribeAuth, type AuthUser } from './api/client';
import { useI18n } from './components/I18nProvider';
import { RouteLoadingFallback } from './components/RouteLoadingFallback';
import { Button } from './components/ui/button';

type AuthSession = {
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  user: AuthUser | null;
};

const AuthSessionContext = createContext<(AuthSession & { retry: () => void }) | null>(null);

export function AuthSessionProvider({
  children,
  bootstrap = getMe,
}: {
  children: ReactNode;
  bootstrap?: typeof getMe;
}) {
  const cached = loadAuth();
  const [session, setSession] = useState<AuthSession>(() => cached.token
    ? { status: 'authenticated', user: cached.user }
    : { status: 'loading', user: null });
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let authChanged = false;
    const unsubscribe = subscribeAuth(() => {
      if (cancelled) return;
      // An explicit login or logout takes precedence over an in-flight check.
      authChanged = true;
      const auth = loadAuth();
      setSession(auth.token
        ? { status: 'authenticated', user: auth.user }
        : { status: 'unauthenticated', user: null });
    });

    const currentAuth = loadAuth();
    if (currentAuth.token) {
      setSession({ status: 'authenticated', user: currentAuth.user });
      return unsubscribe;
    }

    setSession({ status: 'loading', user: null });
    bootstrap()
      .then((auth) => {
        if (cancelled || authChanged) return;
        saveAuth(auth);
      })
      .catch((error: unknown) => {
        if (cancelled || authChanged) return;
        const status = typeof error === 'object' && error !== null && 'status' in error
          ? Number(error.status)
          : undefined;
        setSession({
          status: status === 401 ? 'unauthenticated' : 'error',
          user: null,
        });
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [bootstrap, retryAttempt]);

  return (
    <AuthSessionContext.Provider value={{ ...session, retry: () => setRetryAttempt((attempt) => attempt + 1) }}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function createLoginDestination(
  pathname: string,
  search: string,
  hash: string,
): string {
  if (pathname === '/login') {
    return `${pathname}${search}${hash}`;
  }

  return `/login?returnTo=${encodeURIComponent(pathname + search + hash)}`;
}

export function RequireAuth() {
  const location = useLocation();
  const { t } = useI18n();
  const session = useContext(AuthSessionContext);
  const authenticated = session
    ? session.status === 'authenticated'
    : Boolean(loadAuth().token);

  if (session?.status === 'error') {
    return (
      <section className="mx-auto flex min-h-[50vh] max-w-xl flex-col justify-center gap-4 px-4 py-12">
        <div role="alert" className="space-y-2">
          <h1 className="text-2xl font-semibold">{t('authSessionErrorTitle')}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{t('authSessionErrorMessage')}</p>
        </div>
        <Button type="button" className="min-h-11 self-start" onClick={session.retry}>{t('authSessionRetry')}</Button>
      </section>
    );
  }

  if (session?.status === 'loading') {
    return <RouteLoadingFallback />;
  }

  if (!authenticated) {
    if (location.pathname === '/login') {
      // The animated layout can retain this boundary after login navigation.
      // Its outlet is still the protected page and must not mount during exit.
      return null;
    }

    return (
      <Navigate
        to={createLoginDestination(
          location.pathname,
          location.search,
          location.hash,
        )}
        replace
      />
    );
  }

  return <Outlet />;
}
