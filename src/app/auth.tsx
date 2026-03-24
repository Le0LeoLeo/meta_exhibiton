import { Navigate, Outlet, useLocation } from 'react-router';
import { loadAuth } from './api/client';

export function RequireAuth() {
  const location = useLocation();
  const { token } = loadAuth();

  if (!token) {
    const returnTo = location.pathname + location.search + location.hash;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <Outlet />;
}
