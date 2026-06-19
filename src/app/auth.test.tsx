import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router';
import { createLoginDestination, RequireAuth } from './auth';

afterEach(() => {
  cleanup();
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
});
