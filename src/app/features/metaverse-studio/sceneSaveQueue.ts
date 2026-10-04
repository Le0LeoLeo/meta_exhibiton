// Read the scene and its base revision after the preceding save acknowledges.
export function createSceneSaveQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;
  return {
    get busy() { return pending > 0; },
    run<T>(operation: () => Promise<T>): Promise<T> {
      pending += 1;
      const result = tail.then(operation);
      tail = result.catch(() => undefined).finally(() => { pending -= 1; });
      return result;
    },
  };
}
