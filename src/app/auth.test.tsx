import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
  useLocation,
} from 'react-router';
import { clearAuth, loadAuth, saveAuth, type AuthResponse } from './api/client';
import { AuthSessionProvider, createLoginDestination, RequireAuth } from './auth';
import { I18nProvider } from './components/I18nProvider';
import { Layout } from './components/Layout';

vi.mock('./components/Navigation', () => ({ Navigation: () => <nav>Navigation</nav> }));
vi.mock('./components/Footer', () => ({ Footer: () => <footer>Footer</footer> }));
vi.mock('./components/PointerBackdrop', () => ({ PointerBackdrop: () => null }));

beforeEach(() => {
  localStorage.setItem('metaexpo-locale', 'zh-TW');
});

afterEach(() => {
  cleanup();
  clearAuth();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
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
    <I18nProvider>
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
    </I18nProvider>
  );
}

function LoginRouteHarness() {
  return (
    <I18nProvider>
      <>
        <LocationProbe />
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/login" element={<main>Login page</main>} />
          </Route>
        </Routes>
      </>
    </I18nProvider>
  );
}

function deferredAuth() {
  let resolve!: (auth: AuthResponse) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<AuthResponse>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

const recoveredAuth: AuthResponse = {
  token: 'recovered-token',
  user: { id: 'user-1', email: 'user@example.com', name: 'User' },
};

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

  it('does not render a protected outlet or add a nested returnTo at the login location', async () => {
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
      expect(screen.queryByText('Login page')).not.toBeInTheDocument();
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

  it.each([
    ['zh-TW', '暫時無法確認登入狀態', '重試'],
    ['zh-CN', '暂时无法确认登录状态', '重试'],
    ['en', 'Unable to check your sign-in status', 'Try again'],
  ])('offers a localized retry without redirecting after a transient failure (%s)', async (locale, heading, retry) => {
    localStorage.setItem('metaexpo-locale', locale);
    render(
      <AuthSessionProvider bootstrap={async () => Promise.reject(new Error('offline'))}>
        <MemoryRouter initialEntries={['/virtual-gallery/create']}>
          <ProtectedRouteHarness />
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(heading);
    expect(screen.getByRole('button', { name: retry })).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/virtual-gallery/create');
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('retries in place, opens the requested page, and still responds to logout', async () => {
    const response = deferredAuth();
    const bootstrap = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(() => response.promise);
    const destination = '/virtual-gallery/create?template=blank#editor';
    render(
      <AuthSessionProvider bootstrap={bootstrap}>
        <MemoryRouter initialEntries={[destination]}>
          <ProtectedRouteHarness />
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '重試' }));
    expect(screen.getByText('正在載入展覽…').closest('[role="status"]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重試' })).not.toBeInTheDocument();
    expect(bootstrap).toHaveBeenCalledTimes(2);
    await act(async () => response.resolve(recoveredAuth));

    expect(screen.getByText('Protected gallery editor')).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe(destination);
    expect(loadAuth().token).toBe(recoveredAuth.token);

    act(() => clearAuth());
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(loadAuth().token).toBeNull();
  });

  it('preserves the requested query and hash when a retry confirms an expired session', async () => {
    const bootstrap = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(Object.assign(new Error('unauthorized'), { status: 401 }));
    render(
      <AuthSessionProvider bootstrap={bootstrap}>
        <MemoryRouter initialEntries={['/virtual-gallery/create?template=blank#editor']}>
          <ProtectedRouteHarness />
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '重試' }));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe(
      '/login?returnTo=%2Fvirtual-gallery%2Fcreate%3Ftemplate%3Dblank%23editor',
    );
    expect(bootstrap).toHaveBeenCalledTimes(2);
  });

  it('never mounts protected content in the outgoing layout when retry redirects to login', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(),
    })));
    vi.stubGlobal('scrollTo', vi.fn());
    const protectedMounted = vi.fn();
    function ProtectedContent() {
      useEffect(() => { protectedMounted(); }, []);
      return <main>Protected content must not mount</main>;
    }
    const destination = '/virtual-gallery/my-exhibitions?filter=drafts#saved';
    const bootstrap = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(Object.assign(new Error('unauthorized'), { status: 401 }));
    const router = createMemoryRouter([{
      Component: Layout,
      children: [
        { path: '/login', element: <main>Login page</main> },
        { Component: RequireAuth, children: [{ path: '/virtual-gallery/my-exhibitions', Component: ProtectedContent }] },
      ],
    }], { initialEntries: [destination] });
    const view = render(
      <I18nProvider>
        <AuthSessionProvider bootstrap={bootstrap}>
          <RouterProvider router={router} />
        </AuthSessionProvider>
      </I18nProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '重試' }));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(protectedMounted).not.toHaveBeenCalled();
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(destination);
    view.unmount();
    router.dispose();
  });

  it('does not restore a session when a retry finishes after logout', async () => {
    const response = deferredAuth();
    const bootstrap = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(() => response.promise);
    render(
      <AuthSessionProvider bootstrap={bootstrap}>
        <MemoryRouter initialEntries={['/virtual-gallery/create']}>
          <ProtectedRouteHarness />
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '重試' }));
    act(() => clearAuth());
    await act(async () => response.resolve(recoveredAuth));

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Protected gallery editor')).not.toBeInTheDocument();
    expect(loadAuth().token).toBeNull();
  });

  it('ignores an older session check failure after an explicit login', async () => {
    const response = deferredAuth();
    render(
      <AuthSessionProvider bootstrap={() => response.promise}>
        <MemoryRouter initialEntries={['/virtual-gallery/create']}>
          <ProtectedRouteHarness />
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    act(() => saveAuth(recoveredAuth));
    await act(async () => response.reject(new Error('offline')));

    expect(screen.getByText('Protected gallery editor')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(loadAuth().token).toBe(recoveredAuth.token);
  });

  it('ignores a session response after its provider unmounts', async () => {
    const response = deferredAuth();
    const view = render(
      <AuthSessionProvider bootstrap={() => response.promise}>
        <MemoryRouter initialEntries={['/virtual-gallery/create']}>
          <ProtectedRouteHarness />
        </MemoryRouter>
      </AuthSessionProvider>,
    );

    view.unmount();
    await act(async () => response.resolve(recoveredAuth));
    expect(loadAuth().token).toBeNull();
  });
});
