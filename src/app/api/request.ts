export type ApiTransportErrorCode =
  | 'REQUEST_TIMEOUT'
  | 'REQUEST_ABORTED'
  | 'NETWORK_ERROR';

export class ApiTransportError extends Error {
  constructor(
    public readonly code: ApiTransportErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiTransportError';
  }
}

export const DEFAULT_API_TIMEOUT_MS = 15_000;
export const LONG_API_TIMEOUT_MS = 60_000;
export const UPLOAD_API_TIMEOUT_MS = 120_000;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const value = part.trim();
    if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
  }
  return null;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  options: { timeoutMs?: number } = {},
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let abortCause: 'caller' | 'timeout' | undefined;

  const abortFromCaller = () => {
    if (abortCause) return;
    abortCause = 'caller';
    controller.abort(callerSignal?.reason);
  };
  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timeoutId = setTimeout(() => {
    if (abortCause) return;
    abortCause = 'timeout';
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS);

  try {
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !headers.has('Authorization')) {
      const csrfToken = readCookie('mrei_csrf');
      if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
    }
    return await fetch(path, {
      ...init,
      credentials: init.credentials ?? 'include',
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (abortCause === 'timeout') {
      throw new ApiTransportError('REQUEST_TIMEOUT', 'The request timed out.', { cause: error });
    }
    if (abortCause === 'caller') {
      throw new ApiTransportError('REQUEST_ABORTED', 'The request was cancelled.', { cause: error });
    }
    throw new ApiTransportError('NETWORK_ERROR', 'The network request failed.', { cause: error });
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
