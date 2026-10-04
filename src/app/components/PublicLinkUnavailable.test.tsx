import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from './I18nProvider';
import { PublicLinkUnavailable } from './PublicLinkUnavailable';

function renderNotice(props: Parameters<typeof PublicLinkUnavailable>[0]) {
  render(<I18nProvider><MemoryRouter><PublicLinkUnavailable {...props} /></MemoryRouter></I18nProvider>);
}

beforeEach(() => localStorage.setItem('metaexpo-locale', 'en'));
afterEach(() => { cleanup(); localStorage.clear(); });

describe('PublicLinkUnavailable', () => {
  it('offers a way forward instead of retrying when the link does not exist', () => {
    const onRetry = vi.fn();
    renderNotice({ status: 404, onRetry });

    expect(screen.getByRole('heading', { name: 'This link is unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse exhibitions' })).toHaveAttribute('href', '/exhibitions');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('offers a retry for temporary failures', () => {
    const onRetry = vi.fn();
    renderNotice({ status: 503, title: 'This CV is unavailable', onRetry });

    expect(screen.getByRole('heading', { name: 'This CV is unavailable' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
