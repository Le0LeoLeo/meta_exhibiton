import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from './I18nProvider';
import { RouteErrorPage } from './RouteErrorPage';

beforeEach(() => localStorage.setItem('metaexpo-locale', 'zh-TW'));
afterEach(() => { localStorage.removeItem('metaexpo-locale'); });

describe('RouteErrorPage', () => {
  it('shows localized recovery actions without exposing the raw error', async () => {
    const reportError = vi.fn();
    const reloadPage = vi.fn();
    const rawMessage = 'private exception details';
    const router = createMemoryRouter([
      {
        path: '/',
        loader: () => {
          throw new Error(rawMessage);
        },
        element: <div />,
        errorElement: (
          <RouteErrorPage
            errorReference="ERR-TEST-123"
            reloadPage={reloadPage}
            reportError={reportError}
          />
        ),
      },
    ]);

    render(
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>,
    );

    expect(await screen.findByRole('heading', { name: '頁面暫時無法顯示' })).toBeInTheDocument();
    expect(screen.queryByText(rawMessage)).not.toBeInTheDocument();
    expect(screen.getByText('ERR-TEST-123')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(reloadPage).toHaveBeenCalledOnce();

    const homeLink = screen.getByRole('link', { name: '返回首頁' });
    expect(homeLink).toHaveAttribute('href', '/');

    await waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), 'ERR-TEST-123');
    });
  });
});

describe('RouteErrorPage chunk failures', () => {
  afterEach(() => sessionStorage.clear());

  it('reloads automatically once when a route chunk is stale', async () => {
    const reloadPage = vi.fn();
    const router = createMemoryRouter([
      {
        path: '/',
        loader: () => {
          throw new TypeError('Failed to fetch dynamically imported module: /src/app/pages/Login.tsx');
        },
        element: <div />,
        errorElement: <RouteErrorPage reloadPage={reloadPage} reportError={vi.fn()} />,
      },
    ]);

    render(
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>,
    );

    await waitFor(() => expect(reloadPage).toHaveBeenCalledOnce());
  });
});
