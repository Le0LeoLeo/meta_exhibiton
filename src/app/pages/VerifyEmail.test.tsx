import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VerifyEmail from './VerifyEmail';
const { confirm, send, config } = vi.hoisted(() => ({ confirm: vi.fn(), send: vi.fn(), config: vi.fn() }));
vi.mock('../api/auth', () => ({ confirmVerificationEmail: confirm, sendVerificationEmail: send, getAuthConfig: config }));
vi.mock('../components/I18nProvider', () => ({ useI18n: () => ({ locale: 'en', t: (key: string) => key }) }));
function open(hash = '', returnTo = '/virtual-gallery/my-exhibitions') {
  render(<MemoryRouter initialEntries={[{ pathname: '/verify-email', search: `?returnTo=${encodeURIComponent(returnTo)}`, hash }]}><VerifyEmail /></MemoryRouter>);
}
async function resend() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'verifyResend' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('email'), { target: { value: 'user@example.com' } });
  fireEvent.change(screen.getByLabelText('password'), { target: { value: 'Password123!' } });
  fireEvent.submit(screen.getByLabelText('password').closest('form')!);
}
describe('email verification', () => {
  beforeEach(() => { vi.clearAllMocks(); config.mockResolvedValue({ emailVerificationEnabled: true }); });
  afterEach(cleanup);
  it('requires explicit confirmation and preserves the destination after success', async () => {
    confirm.mockResolvedValue(undefined); open('#token=secret-token');
    expect(confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'verifyConfirm' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'verifyConfirm' }));
    await screen.findByText('verifyComplete');
    expect(confirm).toHaveBeenCalledWith('secret-token');
    expect(screen.getByRole('link', { name: 'loginNow' })).toHaveAttribute('href', '/login?returnTo=%2Fvirtual-gallery%2Fmy-exhibitions');
    expect(screen.queryByRole('button', { name: 'verifyConfirm' })).not.toBeInTheDocument();
  });
  it('offers resend for an invalid or expired link', async () => {
    confirm.mockRejectedValue(Object.assign(new Error('expired'), { status: 400, code: 'INVALID_VERIFICATION_TOKEN' })); open('#token=expired');
    await waitFor(() => expect(screen.getByRole('button', { name: 'verifyConfirm' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'verifyConfirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('verifyInvalid');
    expect(screen.getByRole('button', { name: 'verifyResend' })).toBeInTheDocument();
  });
  it('sends a new link, clears password and enforces a cooldown', async () => {
    send.mockResolvedValue({ verificationRequired: true, email: 'user@example.com', deliveryStatus: 'sent' });
    open(); await resend(); await screen.findByText('verifySent');
    expect(send).toHaveBeenCalledWith({ email: 'user@example.com', password: 'Password123!', locale: 'en', returnTo: '/virtual-gallery/my-exhibitions' });
    expect(screen.getByLabelText('password')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'verifyCooldown' })).toBeDisabled();
  });
  it.each(['unavailable', 'reject'])('does not claim email was sent after %s', async (outcome) => {
    if (outcome === 'reject') send.mockRejectedValue(new Error('unavailable'));
    else send.mockResolvedValue({ verificationRequired: true, email: 'user@example.com', deliveryStatus: 'unavailable' });
    open(); await resend(); await screen.findByRole('alert');
    expect(screen.queryByText('verifySent')).not.toBeInTheDocument();
    expect(screen.getByLabelText('password')).toHaveValue('');
  });
  it('does not claim delivery for a generic accepted request', async () => {
    send.mockResolvedValue({ verificationRequired: true, email: 'user@example.com', deliveryStatus: 'accepted' });
    open(); await resend(); await screen.findByText('verifyAccepted');
    expect(screen.queryByText('verifySent')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'verifyCooldown' })).toBeDisabled();
  });
  it.each([new Error('network'), Object.assign(new Error('Unavailable'), { status: 503 })])('keeps confirmation available after a service failure', async (failure) => {
    confirm.mockRejectedValue(failure); open('#token=keep-token');
    await waitFor(() => expect(screen.getByRole('button', { name: 'verifyConfirm' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'verifyConfirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('verifyServiceRetry');
    expect(screen.queryByText('verifyInvalid')).not.toBeInTheDocument();
    confirm.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'verifyConfirm' }));
    await screen.findByText('verifyComplete');
    expect(confirm).toHaveBeenLastCalledWith('keep-token');
  });
  it.each(['', '#token=unused'])('disables verification when not configured', async (hash) => {
    config.mockResolvedValue({ emailVerificationEnabled: false }); open(hash);
    await screen.findByText('verifyDisabled');
    expect(screen.getByRole('button', { name: hash ? 'verifyConfirm' : 'verifyResend' })).toBeDisabled();
    expect(confirm).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });
  it('allows retrying an unavailable configuration request', async () => {
    config.mockRejectedValueOnce(new Error('network')).mockResolvedValue({ emailVerificationEnabled: true }); open('#token=keep');
    fireEvent.click(await screen.findByRole('button', { name: 'verifyRetry' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'verifyConfirm' })).toBeEnabled());
  });
  it('does not forward an external return URL', () => {
    open('', 'https://evil.example/#token=secret');
    expect(screen.getByRole('link', { name: 'loginNow' })).toHaveAttribute('href', '/login?returnTo=%2F');
  });
});
