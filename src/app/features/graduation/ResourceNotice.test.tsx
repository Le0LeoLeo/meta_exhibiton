import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import { ResourceNotice } from './shared';

function renderNotice(errorStatus: number | undefined, reload = vi.fn()) {
  render(<I18nProvider><MemoryRouter><ResourceNotice loading={false} error="Not available" errorStatus={errorStatus} reload={reload} /></MemoryRouter></I18nProvider>);
  return reload;
}

beforeEach(() => localStorage.setItem('metaexpo-locale', 'en'));
afterEach(() => { cleanup(); localStorage.clear(); });

describe('ResourceNotice', () => {
  it('links back to the workspace when the content no longer exists', () => {
    renderNotice(404);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/graduation');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps a retry for temporary failures', () => {
    const reload = renderNotice(503);
    fireEvent.click(screen.getByRole('button'));
    expect(reload).toHaveBeenCalledOnce();
  });
});
