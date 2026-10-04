import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleSignInButton } from './GoogleSignInButton';

describe('GoogleSignInButton', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.google;
    document.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]').forEach((script) => script.remove());
  });

  it('renders the official button and forwards its credential', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'web-client-id');
    const onCredential = vi.fn();
    let callback: ((response: { credential: string }) => void) | undefined;
    const renderButton = vi.fn();
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn((options) => {
            callback = options.callback;
          }),
          renderButton,
        },
      },
    };

    render(
      <GoogleSignInButton
        onCredential={onCredential}
        unavailableTitle="Unavailable"
      />,
    );

    await waitFor(() => expect(renderButton).toHaveBeenCalledOnce());
    callback?.({ credential: 'google-id-token' });
    expect(onCredential).toHaveBeenCalledWith('google-id-token');
  });

  it('does not forward a blank credential response', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'web-client-id');
    const onCredential = vi.fn();
    let callback: ((response: { credential: string }) => void) | undefined;
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn((options) => { callback = options.callback; }),
          renderButton: vi.fn(),
        },
      },
    };

    render(<GoogleSignInButton onCredential={onCredential} unavailableTitle="Unavailable" />);
    await waitFor(() => expect(callback).toBeTypeOf('function'));
    callback?.({ credential: '   ' });

    expect(onCredential).not.toHaveBeenCalled();
  });

  it('renders an explanatory disabled control when Google is not configured', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');

    render(<GoogleSignInButton onCredential={vi.fn()} unavailableTitle="Unavailable" />);

    expect(screen.getByRole('button', { name: 'Google' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Google' })).toHaveAttribute('title', 'Unavailable');
  });

  it('falls back to the unavailable control when the Google script cannot load', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'web-client-id');

    render(<GoogleSignInButton onCredential={vi.fn()} unavailableTitle="Unavailable" />);
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    expect(script).not.toBeNull();
    script?.dispatchEvent(new Event('error'));

    expect(await screen.findByRole('button', { name: 'Google' })).toBeDisabled();
  });
});
