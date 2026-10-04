import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';

type GoogleCredentialResponse = {
  credential: string;
};

type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          type: 'standard';
          shape: 'rectangular';
          theme: 'outline';
          text: 'signin_with';
          size: 'large';
          width: number;
          locale?: string;
        },
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error('Unable to load Google Identity Services'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    googleScriptPromise = null;
    throw error;
  });
  googleScriptPromise = promise;
  return promise;
}

export function GoogleSignInButton({
  onCredential,
  disabled = false,
  unavailableTitle,
  locale,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
  unavailableTitle: string;
  locale?: string;
}) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [loadFailed, setLoadFailed] = useState(false);
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelled = false;

    loadGoogleIdentityServices()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        const width = Math.max(
          160,
          Math.min(400, Math.floor(containerRef.current.getBoundingClientRect().width)),
        );
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            const normalizedCredential = credential?.trim();
            if (normalizedCredential) callbackRef.current(normalizedCredential);
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          shape: 'rectangular',
          theme: 'outline',
          text: 'signin_with',
          size: 'large',
          width,
          ...(locale ? { locale } : {}),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, locale]);

  if (!clientId || loadFailed) {
    return (
      <Button type="button" variant="outline" className="w-full" disabled title={unavailableTitle}>
        Google
      </Button>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex min-h-10 w-full justify-center${disabled ? ' pointer-events-none opacity-60' : ''}`}
      aria-busy={disabled}
    />
  );
}
