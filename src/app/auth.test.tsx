import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router';
import { clearAuth } from './api/client';
import { AuthSessionProvider, createLoginDestination, RequireAuth } from './auth';

afterEach(() => {
  cleanup();
  clearAuth();
  localStorage.clear();
  sessionStorage.clear();
});

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  );
}

function ProtectedRouteHarness() {
  return (
    <>
      <LocationProbe />
      <Routes>
        <Route path="/login" element={<main>Login page</main>} />
        <Route element={<RequireAuth />}>
          <Route
            path="/virtual-gallery/create"
            element={<main>Protected gallery editor</main>}
          />
        </Route>
      </Routes>
    </>
  );
}

function LoginRouteHarness() {
  return (
    <>
      <LocationProbe />
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/login" element={<main>Login page</main>} />
        </Route>
      </Routes>
    </>
  );
}

describe('RequireAuth', () => {
  it('preserves the login query and hash unchanged', () => {
    expect(
      createLoginDestination(
        '/login',
        '?returnTo=%2Fvirtual-gallery%2Fcreate',
        '#sign-in',
      ),
    ).toBe('/login?returnTo=%2Fvirtual-gallery%2Fcreate#sign-in');
  });

  it('preserves the full requested location in returnTo', async () => {
    render(
      <MemoryRouter
        initialEntries={['/virtual-gallery/create?template=blank#editor']}
      >
        <ProtectedRouteHarness />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(
        '/login?returnTo=%2Fvirtual-gallery%2Fcreate%3Ftemplate%3Dblank%23editor',
      );
    });
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('does not add a nested returnTo when already on the login page', async () => {
    render(
      <MemoryRouter
        initialEntries={['/login?returnTo=%2Fvirtual-gallery%2Fcreate']}
      >
        <LoginRouteHarness />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(
        '/login?returnTo=%2Fvirtual-gallery%2Fcreate',
      );
      expect(screen.getByText('Login page')).toBeInTheDocument();
    });
  });

  it('shows the route fallback while cookie bootstrap is pending', () => {
    render(
      <AuthSessionProvider bootstrap={() => new Promise(() => {})}>
        <MemoryRouter initialEntries={['/virtual-gallery/create']}>
          <ProtectedRouteHarness />
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    expect(screen.getByText('正在載入展覽…')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('keeps a reloaded protected route open after cookie bootstrap succeeds', async () => {
    render(
      <AuthSessionProvider bootstrap={async () => ({
        token: 'refreshed-token',
        user: { id: 'user-1', email: 'user@example.com', name: 'User' },
      })}>
        <MemoryRouter initialEntries={['/virtual-gallery/create']}>
          <ProtectedRouteHarness />
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    expect(await screen.findByText('Protected gallery editor')).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/virtual-gallery/create');
  });

  it('redirects only after cookie bootstrap confirms an unauthorized session', async () => {
    const unauthorized = Object.assign(new Error('unauthorized'), { status: 401 });
    render(
      <AuthSessionProvider bootstrap={async () => Promise.reject(unauthorized)}>
        <MemoryRouter initialEntries={['/virtual-gallery/create']}>
          <ProtectedRouteHarness />
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(
        '/login?returnTo=%2Fvirtual-gallery%2Fcreate',
      );
    });
  });

  it('does not redirect a protected route for a transient bootstrap failure', async () => {
    render(
      <AuthSessionProvider bootstrap={async () => Promise.reject(new Error('offline'))}>
        <MemoryRouter initialEntries={['/virtual-gallery/create']}>
          <ProtectedRouteHarness />
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    expect(await screen.findByText('正在載入展覽…')).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/virtual-gallery/create');
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });
});
