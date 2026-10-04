import { StrictMode, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, Outlet, RouterProvider, useNavigate } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from './I18nProvider';
import { UnsavedChangesProvider, useConfirmDiscard, useUnsavedChanges } from './UnsavedChangesProvider';

beforeEach(() => { localStorage.setItem('metaexpo-locale', 'en'); vi.spyOn(window, 'confirm').mockReturnValue(false); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

function Editor({ name }: { name: string }) {
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  return <><label>{name}<input value={dirty ? 'changed' : ''} onChange={() => setDirty(true)} /></label><button onClick={() => setDirty(false)}>Save {name}</button></>;
}

function Shell({ onSignOut }: { onSignOut: () => void }) {
  const confirmDiscard = useConfirmDiscard();
  const navigate = useNavigate();
  return <><Link to="/away">Global navigation</Link><button onClick={() => confirmDiscard(() => { onSignOut(); void navigate('/away'); })}>Sign out</button><Outlet /></>;
}

function mount(onSignOut = vi.fn()) {
  const router = createMemoryRouter([{
    element: <I18nProvider><UnsavedChangesProvider><Shell onSignOut={onSignOut} /></UnsavedChangesProvider></I18nProvider>,
    children: [{ path: '/', element: <><Editor name="First" /><Editor name="Second" /></> }, { path: '/away', element: <h1>Away</h1> }],
  }], { initialEntries: ['/away', '/'], initialIndex: 1 });
  render(<StrictMode><RouterProvider router={router} /></StrictMode>);
  return router;
}

it.each([
  ['en', 'You have unsaved changes'], ['zh-TW', '你有尚未儲存的修改'], ['zh-CN', '你有尚未保存的修改'],
])('keeps edited forms when navigation is cancelled, with one %s confirmation', async (locale, message) => {
  localStorage.setItem('metaexpo-locale', locale);
  const router = mount();
  fireEvent.change(screen.getByLabelText('First'), { target: { value: 'edit' } });
  fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledExactlyOnceWith(expect.stringContaining(message)));
  expect(router.state.location.pathname).toBe('/');
  expect(screen.getByLabelText('First')).toHaveValue('changed');
});

it('protects browser back and proceeds once when leaving is accepted', async () => {
  const router = mount();
  fireEvent.change(screen.getByLabelText('Second'), { target: { value: 'edit' } });
  await act(async () => { await router.navigate(-1); });
  expect(router.state.location.pathname).toBe('/');
  vi.mocked(window.confirm).mockReturnValue(true);
  await act(async () => { await router.navigate(-1); });
  expect(await screen.findByRole('heading', { name: 'Away' })).toBeVisible();
  expect(window.confirm).toHaveBeenCalledTimes(2);
});

it('keeps other dirty forms protected after one form saves, then releases all protection', async () => {
  const router = mount();
  for (const name of ['First', 'Second']) fireEvent.change(screen.getByLabelText(name), { target: { value: 'edit' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save First' }));
  const dirtyUnload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(dirtyUnload);
  expect(dirtyUnload.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
  await waitFor(() => expect(window.confirm).toHaveBeenCalledOnce());
  expect(router.state.location.pathname).toBe('/');
  fireEvent.click(screen.getByRole('button', { name: 'Save Second' }));
  const cleanUnload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(cleanUnload);
  expect(cleanUnload.defaultPrevented).toBe(false);
  fireEvent.click(screen.getByRole('link', { name: 'Global navigation' }));
  expect(await screen.findByRole('heading', { name: 'Away' })).toBeVisible();
  expect(window.confirm).toHaveBeenCalledOnce();
});

it('confirms before sign-out side effects and avoids a second router prompt', async () => {
  const onSignOut = vi.fn();
  mount(onSignOut);
  fireEvent.change(screen.getByLabelText('First'), { target: { value: 'edit' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).not.toHaveBeenCalled();
  vi.mocked(window.confirm).mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Away' })).toBeVisible();
  expect(onSignOut).toHaveBeenCalledOnce();
  expect(window.confirm).toHaveBeenCalledTimes(2);
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(false);
});
