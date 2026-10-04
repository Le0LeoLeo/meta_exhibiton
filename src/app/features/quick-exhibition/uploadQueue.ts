/** A small dynamic queue: retries and later batches share the same concurrency cap. */
export function createUploadQueue(concurrency = 3) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Invalid upload concurrency');
  const pending: Array<{ run: () => Promise<unknown>; resolve: (value: unknown) => void; reject: (error: unknown) => void }> = [];
  let active = 0;
  let stopped = false;

  function pump() {
    while (!stopped && active < concurrency && pending.length) {
      const job = pending.shift()!;
      active += 1;
      Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(() => {
        active -= 1;
        pump();
      });
    }
  }

  return {
    add<T>(run: () => Promise<T>): Promise<T> {
      if (stopped) return Promise.reject(new DOMException('Upload queue stopped', 'AbortError'));
      return new Promise<T>((resolve, reject) => {
        pending.push({ run, resolve: (value) => resolve(value as T), reject });
        pump();
      });
    },
    stop() {
      stopped = true;
      for (const job of pending.splice(0)) job.reject(new DOMException('Upload queue stopped', 'AbortError'));
    },
  };
}
