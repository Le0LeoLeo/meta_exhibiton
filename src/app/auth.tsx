import { Navigate, Outlet, useLocation } from 'react-router';
import { loadAuth } from './api/client';

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
  const { token } = loadAuth();

  if (!token) {
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
