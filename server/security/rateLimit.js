const FALLBACK_KEY = Symbol('missing rate limit key');
const CLEANUP_BATCH_SIZE = 2;
const DEFAULT_MAX_KEYS = 10_000;

function validateOptions({
  limit,
  windowMs,
  now,
  maxKeys,
}) {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new TypeError('limit must be a positive integer');
  }
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new TypeError('windowMs must be a positive number');
  }
  if (typeof now !== 'function') {
    throw new TypeError('now must be a function');
  }
  if (!Number.isInteger(maxKeys) || maxKeys <= 0) {
    throw new TypeError('maxKeys must be a positive integer');
  }
}

function normalizeKey(value) {
  return typeof value === 'string' && value.trim() ? value : FALLBACK_KEY;
}

export function createRateTokenConsumer(options = {}) {
  const {
    limit,
    windowMs,
    now = Date.now,
    maxKeys = DEFAULT_MAX_KEYS,
  } = options;

  validateOptions({
    limit,
    windowMs,
    now,
    maxKeys,
  });

  const entries = new Map();
  let lastObservedTime = Number.NEGATIVE_INFINITY;

  function cleanupExpired(currentTime) {
    for (let scanned = 0; scanned < CLEANUP_BATCH_SIZE; scanned += 1) {
      const nextEntry = entries.entries().next();
      if (nextEntry.done) return;

      const [entryKey, entry] = nextEntry.value;
      if (entry.windowStartedAt + windowMs > currentTime) return;
      entries.delete(entryKey);
    }
  }

  function ensureCapacity() {
    if (entries.size < maxKeys) return;
    const oldestKey = entries.keys().next().value;
    entries.delete(oldestKey);
  }

  function consume(rawKey) {
    const observedTime = now();
    if (!Number.isFinite(observedTime)) {
      throw new TypeError('now() must return a finite number');
    }

    const currentTime = Math.max(observedTime, lastObservedTime);
    lastObservedTime = currentTime;
    cleanupExpired(currentTime);

    const entryKey = normalizeKey(rawKey);
    let entry = entries.get(entryKey);

    if (entry && entry.windowStartedAt + windowMs <= currentTime) {
      entries.delete(entryKey);
      entry = null;
    }

    if (!entry) {
      ensureCapacity();
      entry = { count: 0, windowStartedAt: currentTime };
      entries.set(entryKey, entry);
    }

    if (entry.count >= limit) {
      return {
        allowed: false,
        retryAfterMs: Math.max(0, entry.windowStartedAt + windowMs - currentTime),
      };
    }

    entry.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  consume.size = () => entries.size;
  return consume;
}

export function createInMemoryRateLimitStore({ maxKeys = DEFAULT_MAX_KEYS } = {}) {
  const consumers = new Map();

  return {
    consume({ namespace, key, limit, windowMs, now }) {
      const storeNamespace = String(namespace || 'default');
      let entry = consumers.get(storeNamespace);

      if (!entry) {
        let currentTime = now;
        entry = {
          limit,
          windowMs,
          consume: createRateTokenConsumer({
            limit,
            windowMs,
            maxKeys,
            now: () => currentTime,
          }),
          setCurrentTime(value) {
            currentTime = value;
          },
        };
        consumers.set(storeNamespace, entry);
      } else if (entry.limit !== limit || entry.windowMs !== windowMs) {
        throw new Error(`rate limit namespace "${storeNamespace}" has conflicting settings`);
      }

      entry.setCurrentTime(now);
      return entry.consume(key);
    },
    async checkReadiness() {},
    async close() {
      consumers.clear();
    },
  };
}

export function createFixedWindowLimiter(options = {}) {
  const {
    limit,
    windowMs,
    now = Date.now,
    maxKeys = DEFAULT_MAX_KEYS,
    namespace = 'default',
    store = createInMemoryRateLimitStore({ maxKeys }),
    key = (req) => req.ip,
    message = 'too many requests',
  } = options;

  validateOptions({ limit, windowMs, now, maxKeys });
  if (typeof key !== 'function') {
    throw new TypeError('key must be a function');
  }
  if (!store || typeof store.consume !== 'function') {
    throw new TypeError('store.consume must be a function');
  }

  return async function fixedWindowLimiter(req, res, next) {
    try {
      const result = await store.consume({
        namespace,
        key: key(req),
        limit,
        windowMs,
        now: now(),
      });
      if (result.allowed) return next();

      res.set('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      return res.status(429).json({ message });
    } catch (error) {
      return next(error);
    }
  };
}
