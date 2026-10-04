import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/app/components/I18nProvider';
import { ResourceNotice } from './shared';
import { InviteCodeCopy } from './GraduationClassPage';

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

describe('InviteCodeCopy', () => {
  it('shows and selects the join link when the clipboard is blocked', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) } });
    render(<I18nProvider><MemoryRouter><InviteCodeCopy token="invite-token" /></MemoryRouter></I18nProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Copy student join link' }));
    const field = await screen.findByRole('textbox', { name: 'Copy student join link' });
    expect(field).toHaveValue(`${window.location.origin}/graduation?invite=invite-token#student`);
    await waitFor(() => expect(field).toHaveFocus());
    vi.unstubAllGlobals();
  });
});
