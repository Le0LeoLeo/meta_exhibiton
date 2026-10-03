import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ReactNode } from 'react';
import * as auth from '../api/auth';
import { AuthSessionProvider } from '../auth';
import { DEFAULT_AVATAR_APPEARANCE } from '../modules/metaverse3d/avatar/avatarAppearance';
import { Navigation } from './Navigation';
import { UnsavedChangesProvider, useUnsavedChanges } from './UnsavedChangesProvider';

vi.mock('../api/request', () => ({
  apiFetch: vi.fn(async () => new Response('{}', { status: 200 })),
}));

const restoredAuth: auth.AuthResponse = {
  token: 'synthetic-session-token',
  user: {
    id: 'synthetic-user', email: 'navigation-test@example.invalid', name: 'Preview User',
    avatarAppearance: DEFAULT_AVATAR_APPEARANCE,
  },
};

afterEach(() => {
  cleanup();
  auth.clearAuth();
  vi.restoreAllMocks();
});

function renderNavigation(children: ReactNode = <Navigation />, initialEntries = ['/']) {
  const router = createMemoryRouter([{ path: '*', element: <UnsavedChangesProvider>{children}</UnsavedChangesProvider> }], { initialEntries });
  return { ...render(<RouterProvider router={router} />), router };
}

describe('navigation auth synchronization', () => {
  it('puts AI education first for guests and keeps exhibitions available', () => {
    const { container } = renderNavigation();
    const desktopLinks = container.querySelectorAll('.home-navigation-row > div:nth-child(2) a');
    expect(Array.from(desktopLinks, link => link.getAttribute('href'))).toEqual([
      '/solutions', '/virtual-gallery', '/exhibitions',
    ]);
    fireEvent.click(container.querySelector('[aria-controls="mobile-navigation"]')!);
    expect(container.querySelector('#mobile-navigation .grid a')).toHaveAttribute('href', '/solutions');
    expect(container.querySelectorAll('nav a[href="/cv"]')).toHaveLength(0);
    expect(container.querySelector('nav a[href="/exhibitions"]')).toBeInTheDocument();
    expect(container.querySelector('nav a[href="/virtual-gallery"]')).toBeInTheDocument();
  });

  it('puts AI education first for signed-in users alongside their exhibitions and classes', () => {
    auth.saveAuth(restoredAuth);
    const { container } = renderNavigation(<Navigation />, ['/virtual-gallery/my-exhibitions']);

    const desktopLinks = container.querySelectorAll('.home-navigation-row > div:nth-child(2) a');
    expect(Array.from(desktopLinks, link => link.getAttribute('href'))).toEqual([
      '/solutions', '/virtual-gallery/my-exhibitions', '/graduation',
    ]);
    expect(screen.getByRole('link', { name: 'My Exhibitions' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Class exhibitions' })).toHaveAttribute('href', '/graduation');
  });

  it.each([false, true])('opens AI education directly with signed-in state %s', (signedIn) => {
    if (signedIn) auth.saveAuth(restoredAuth);
    const { router } = renderNavigation();

    fireEvent.click(screen.getByRole('link', { name: 'AI for Education' }));
    expect(router.state.location.pathname).toBe('/solutions');
    expect(screen.getByRole('link', { name: 'AI for Education' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([false, true])('keeps the create entry available with signed-in state %s', (signedIn) => {
    if (signedIn) auth.saveAuth(restoredAuth);
    const { router } = renderNavigation();

    const createLink = screen.getByRole('link', { name: 'Create Exhibition' });
    expect(createLink.querySelector('button')).toBeNull();
    fireEvent.click(createLink);
    expect(router.state.location.pathname).toBe('/virtual-gallery/quick-create');
  });

  it.each([false, true])('starts creation from the open menu and closes it with signed-in state %s', (signedIn) => {
    if (signedIn) auth.saveAuth(restoredAuth);
    const { container, router } = renderNavigation();
    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }));

    const menu = container.querySelector('#mobile-navigation')!;
    expect(menu.querySelector('a')).toHaveAttribute('href', '/virtual-gallery/quick-create');
    fireEvent.click(menu.querySelector('a')!);
    expect(router.state.location.pathname).toBe('/virtual-gallery/quick-create');
    expect(screen.getByRole('button', { name: 'Open Menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('puts AI education and workspace shortcuts first in the signed-in menu without duplicate entries', () => {
    auth.saveAuth(restoredAuth);
    const { container } = renderNavigation();
    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }));

    const menu = container.querySelector('#mobile-navigation')!;
    expect(Array.from(menu.querySelectorAll('a')).slice(0, 4).map(link => link.getAttribute('href'))).toEqual([
      '/virtual-gallery/quick-create', '/solutions', '/virtual-gallery/my-exhibitions', '/graduation',
    ]);
    expect(menu.querySelectorAll('a[href="/solutions"]')).toHaveLength(1);
    expect(menu.querySelectorAll('a[href="/exhibitions"]')).toHaveLength(1);
    expect(menu.querySelectorAll('a[href="/virtual-gallery/my-exhibitions"]')).toHaveLength(1);
    expect(menu.querySelectorAll('a[href="/graduation"]')).toHaveLength(1);
    expect(menu.querySelector('a[href="/cv"]')).toBeInTheDocument();
  });

  it('updates desktop and an open mobile menu after asynchronous session restoration', async () => {
    let resolveBootstrap!: (value: auth.AuthResponse) => void;
    const bootstrap = () => new Promise<auth.AuthResponse>((resolve) => { resolveBootstrap = resolve; });
    renderNavigation(
      <AuthSessionProvider bootstrap={bootstrap}>
        <Navigation />
      </AuthSessionProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open Menu' }));
    expect(screen.getAllByRole('link', { name: 'Log In', exact: true }).length).toBeGreaterThan(0);

    await act(async () => { resolveBootstrap(restoredAuth); });

    expect(screen.getByText('Preview User')).toBeInTheDocument();
    expect(screen.queryAllByRole('link', { name: 'Log In', exact: true })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Log Out', exact: true })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Class exhibitions' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'My Exhibitions' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'My CV' })).toHaveAttribute('href', '/cv');
  });

  it('updates the displayed name without changing location or focusing the window', () => {
    auth.saveAuth(restoredAuth);
    renderNavigation();
    expect(screen.getByText('Preview User')).toBeInTheDocument();

    act(() => auth.saveAuth({ ...restoredAuth, user: { ...restoredAuth.user, name: 'Updated Name' } }));

    expect(screen.getByText('Updated Name')).toBeInTheDocument();
    expect(screen.queryByText('Preview User')).not.toBeInTheDocument();
  });

  it('keeps the session when logout is cancelled with unsaved work', () => {
    function DirtyForm() { useUnsavedChanges(true); return <input aria-label="Unsaved artwork" defaultValue="My draft" />; }
    auth.saveAuth(restoredAuth);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderNavigation(<><Navigation /><DirtyForm /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Log Out', exact: true }));
    expect(auth.loadAuth().user?.id).toBe(restoredAuth.user.id);
    expect(screen.getByLabelText('Unsaved artwork')).toHaveValue('My draft');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Log Out', exact: true }));
    expect(auth.loadAuth().user).toBeNull();
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('reflects logout initiated elsewhere without a route change', () => {
    auth.saveAuth(restoredAuth);
    renderNavigation();
    expect(screen.getByText('Preview User')).toBeInTheDocument();

    act(() => auth.clearAuth());

    expect(screen.queryByText('Preview User')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log Out', exact: true })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Log In', exact: true }).length).toBeGreaterThan(0);
  });

  it('removes its auth subscription when unmounted', () => {
    const originalSubscribe = auth.subscribeAuth;
    const unsubscribe = vi.fn();
    const subscribe = vi.spyOn(auth, 'subscribeAuth').mockImplementation((listener) => {
      const removeListener = originalSubscribe(listener);
      return () => { unsubscribe(); return removeListener(); };
    });
    const view = renderNavigation();
    expect(subscribe).toHaveBeenCalledOnce();

    view.unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
