const translateKey = vi.hoisted(() => (key: string) => key);
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Login from './Login';
import Support from './Support';
import Resources from './Resources';

vi.mock('../components/I18nProvider', () => ({ useI18n: () => ({ t: translateKey }) }));
vi.mock('../components/GoogleSignInButton', () => ({ GoogleSignInButton: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

describe('unconfigured services', () => {
  beforeEach(() => {
    class Observer { observe() {} unobserve() {} disconnect() {} }
    vi.stubGlobal('ResizeObserver', Observer);
    vi.stubGlobal('IntersectionObserver', Observer);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it('links to password recovery without claiming an email was sent', () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'forgotPassword' })).toHaveAttribute('href', '/reset-password?returnTo=%2F');
  });

  it('offers email support without collecting a fake ticket', () => {
    render(<MemoryRouter><Support /></MemoryRouter>);
    expect(screen.getByText('ssSupportEmailDesc')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'iopipoiopiopiopiop9990@gmail.com' })).toHaveAttribute('href', 'mailto:iopipoiopiopiopiop9990@gmail.com');
    for (const name of ['supportContactLiveChatAction', 'supportContactEmailAction', 'supportContactPhoneAction', 'supportFormSubmit']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText('supportFormEmailLabel')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('supportSearchPlaceholder'), { target: { value: 'no matches' } });
    expect(screen.getAllByRole('button', { name: 'supportClearSearch' }).every(button => !button.hasAttribute('disabled'))).toBe(true);
  });

  it('offers the classroom guide and live routes without fake downloads', () => {
    render(<MemoryRouter><Resources /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Build, discuss, and question a 3D exhibition' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open class workspace' })).toHaveAttribute('href', '/graduation');
    expect(screen.getByRole('link', { name: 'Join a class exhibition' })).toHaveAttribute('href', '/graduation');
    expect(screen.getByRole('link', { name: 'Browse exhibitions' })).toHaveAttribute('href', '/exhibitions');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /download/i })).not.toBeInTheDocument();
  });
});
