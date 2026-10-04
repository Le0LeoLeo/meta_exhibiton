import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Layout } from './Layout';
import { useState } from 'react';
import { useUnsavedChanges } from './UnsavedChangesProvider';

vi.mock('./Navigation', () => ({ Navigation: () => <nav>Navigation</nav> }));
vi.mock('./Footer', () => ({ Footer: () => <footer>Footer</footer> }));
vi.mock('./PointerBackdrop', () => ({ PointerBackdrop: () => <canvas aria-hidden="true" /> }));

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(),
  })));
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each([undefined, { layout: 'fullscreen' }])('keeps unsaved forms protected in layout %j', async (handle) => {
  function Editor() {
    const [dirty, setDirty] = useState(false);
    useUnsavedChanges(dirty);
    return <button onClick={() => setDirty(true)}>Edit content</button>;
  }
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const router = createMemoryRouter([{ element: <Layout />, children: [
    { path: '/', element: <Editor />, handle }, { path: '/away', element: <h1>Away</h1> },
  ] }]);
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit content' }));
  await act(async () => { await router.navigate('/away'); });
  expect(confirm).toHaveBeenCalledOnce();
  expect(router.state.location.pathname).toBe('/');
  expect(screen.getByRole('button', { name: 'Edit content' })).toBeVisible();
});

function renderLayoutRoute(pathname: string) {
  const router = createMemoryRouter([{
    element: <Layout />,
    children: [
      { path: '/', element: <h1>Home page</h1> },
      { path: '/exhibitions', element: <h1>Exhibitions list</h1> },
      { path: '/virtual-gallery', element: <h1>Gallery page</h1> },
      { path: '/demo', element: <h1>Demo exhibition</h1>, handle: { layout: 'fullscreen' } },
      { path: '/exhibitions/:exhibitionId', element: <h1>Public exhibition</h1>, handle: { layout: 'fullscreen' } },
      { path: '/virtual-gallery/share/:token', element: <h1>Shared editor</h1>, handle: { layout: 'fullscreen' } },
      {
        children: [
          { path: '/virtual-gallery/create', element: <h1>Create exhibition</h1>, handle: { layout: 'fullscreen' } },
        ],
      },
      { path: '*', element: <h1>Not found</h1> },
    ],
  }], { initialEntries: [pathname] });
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

it.each([
  ['/demo', 'Demo exhibition'],
  ['/exhibitions/example', 'Public exhibition'],
  ['/virtual-gallery/share/example', 'Shared editor'],
  ['/virtual-gallery/create', 'Create exhibition'],
])('uses the fullscreen route layout for %s', (pathname, title) => {
  const { router, container } = renderLayoutRoute(pathname);

  expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.queryByText('Footer')).not.toBeInTheDocument();
  expect(container.querySelector('canvas')).not.toBeInTheDocument();
  expect(container.querySelector('.museum-immersive')).toBeInTheDocument();
  router.dispose();
});

it.each(['/', '/exhibitions', '/virtual-gallery', '/exhibitions/example/missing', '/virtual-gallery/create-other'])(
  'keeps the normal page layout when %s has no fullscreen route handle', (pathname) => {
    const { router, container } = renderLayoutRoute(pathname);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    expect(container.querySelector('canvas')).toBeInTheDocument();
    expect(container.querySelector('.museum-pages')).toBeInTheDocument();
    router.dispose();
  },
);

it('updates navigation and footer when entering and leaving a fullscreen route', async () => {
  const { router } = renderLayoutRoute('/exhibitions');
  expect(screen.getByRole('navigation')).toBeInTheDocument();

  await act(async () => { await router.navigate('/demo'); });
  await screen.findByRole('heading', { name: 'Demo exhibition' });
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.queryByText('Footer')).not.toBeInTheDocument();

  await act(async () => { await router.navigate('/virtual-gallery/share/example'); });
  await screen.findByRole('heading', { name: 'Shared editor' });
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

  await act(async () => { await router.navigate('/exhibitions'); });
  await screen.findByRole('heading', { name: 'Exhibitions list' });
  expect(screen.getAllByRole('navigation')).toHaveLength(1);
  expect(screen.getByText('Footer')).toBeInTheDocument();
  router.dispose();
});

it('keeps the outgoing page in place until exit, then resets scroll for the new page', async () => {
  const scrollTo = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
  const router = createMemoryRouter([{
    element: <Layout />,
    children: [
      { path: '/', element: <h1>First page</h1> },
      { path: '/next', element: <h1>Next page</h1> },
    ],
  }]);
  render(<RouterProvider router={router} />);
  expect(scrollTo).not.toHaveBeenCalled();
  await act(async () => { await router.navigate('/next'); });
  expect(screen.getByRole('heading', { name: 'First page' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'First page' }).closest('[inert]')).not.toBeNull();
  expect(scrollTo).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Next page' })).toBeInTheDocument());
  expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' });
  expect(screen.queryByRole('heading', { name: 'First page' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('navigation')).toHaveLength(1);
  router.dispose();
});
