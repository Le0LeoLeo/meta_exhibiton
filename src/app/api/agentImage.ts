/** Read only the displayed artwork; never send access URLs or credentials to the model. */
export async function prepareAgentImage(source: string, token: string, signal?: AbortSignal): Promise<string> {
  const url = new URL(source, window.location.href);
  if (!['https:', 'http:', 'data:', 'blob:'].includes(url.protocol)) throw new Error('Unsupported artwork image');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(abort, 10000);
  let bitmap: ImageBitmap | undefined;
  try {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const sameOrigin = url.origin === window.location.origin;
    const protectedMedia = sameOrigin && /^\/(?:api\/media\/|uploads\/)/.test(url.pathname);
    const res = await fetch(url.href, {
      signal: controller.signal,
      credentials: sameOrigin ? 'same-origin' : 'omit',
      headers: protectedMedia ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error('Artwork image unavailable');
    const blob = await res.blob();
    if (blob.size > 20 * 1024 * 1024 || !blob.type.startsWith('image/')) throw new Error('Unsupported artwork image');
    bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image preparation unavailable');
    for (const edge of [2048, 1600, 1200]) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      if (dataUrl.length <= 800000 && dataUrl.startsWith('data:image/jpeg;base64,')) {
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        return dataUrl;
      }
    }
    throw new Error('Artwork image too large');
  } finally {
    bitmap?.close();
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
