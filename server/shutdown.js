function closeHttpServer(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function closeDatabase(database) {
  if (!database?.close) return Promise.resolve();
  return new Promise((resolve, reject) => {
    database.close((error) => (error ? reject(error) : resolve()));
  });
}

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

function waitForSettledWithTimeout(promises, timeoutMs) {
  const settled = Promise.allSettled(promises);
  let timeout;
  const timedOut = new Promise((resolve) => {
    timeout = setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([settled, timedOut]).finally(() => clearTimeout(timeout));
}

export function createShutdownHandler({
  httpServer,
  multiplayerServer,
  rateLimitStore,
  database,
  logger = console,
  shutdownTimeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
}) {
  let shutdownPromise = null;

  return function shutdown() {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      const errors = [];
      const drainSteps = [
        closeHttpServer(httpServer),
        Promise.resolve().then(() => multiplayerServer?.close?.()),
        Promise.resolve().then(() => rateLimitStore?.close?.()),
      ];
      const results = await waitForSettledWithTimeout(drainSteps, shutdownTimeoutMs);

      if (results === null) {
        const error = new Error(`server shutdown timed out after ${shutdownTimeoutMs}ms`);
        errors.push(error);
        logger.error('[server] shutdown step failed', error);
        httpServer?.closeAllConnections?.();
      } else {
        for (const result of results) {
          if (result.status === 'rejected') {
            errors.push(result.reason);
            logger.error('[server] shutdown step failed', result.reason);
          }
        }
      }

      try {
        await closeDatabase(database);
      } catch (error) {
        errors.push(error);
        logger.error('[server] shutdown step failed', error);
      }
      if (errors.length > 0) throw new AggregateError(errors, 'server shutdown failed');
    })();
    return shutdownPromise;
  };
}
