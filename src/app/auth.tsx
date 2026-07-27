import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { getMe, loadAuth, saveAuth, subscribeAuth, type AuthUser } from './api/client';
import { RouteLoadingFallback } from './components/RouteLoadingFallback';

type AuthSession = {
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  user: AuthUser | null;
};

const AuthSessionContext = createContext<AuthSession | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeAuth(() => {
      if (cancelled) return;
      const auth = loadAuth();
      setSession(auth.token
        ? { status: 'authenticated', user: auth.user }
        : { status: 'unauthenticated', user: null });
    });

    if (loadAuth().token) return unsubscribe;

    bootstrap()
      .then((auth) => {
        if (cancelled) return;
        saveAuth(auth);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
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
  }, [bootstrap]);

  return (
    <AuthSessionContext.Provider value={session}>
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
  const session = useContext(AuthSessionContext);
  const authenticated = session
    ? session.status === 'authenticated'
    : Boolean(loadAuth().token);

  if (session?.status === 'loading' || session?.status === 'error') {
    return <RouteLoadingFallback />;
  }

  if (!authenticated) {
    if (location.pathname === '/login') {
      return <Outlet />;
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
