import { applySceneOperation } from './sceneState.js';

const DEFAULT_TTL_MS = 60 * 60 * 1000;

function clone(value) {
  return structuredClone(value);
}

export function createMemorySceneStore({
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now,
} = {}) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new TypeError('ttlMs must be a positive finite number');
  }
  if (typeof now !== 'function') {
    throw new TypeError('now must be a function');
  }

  const entries = new Map();
  const writeQueues = new Map();
  let closing = false;
  let closed = false;
  let closePromise = null;

  function closedError() {
    return new Error('Memory scene store is closed');
  }

  function readEntry(roomId) {
    const entry = entries.get(roomId);
    if (!entry) return null;
    if (entry.expiresAt <= now()) {
      entries.delete(roomId);
      return null;
    }
    return entry;
  }

  function publicEntry(entry) {
    if (!entry) return null;
    return {
      version: entry.version,
      updatedAt: entry.updatedAt,
      scene: clone(entry.scene),
    };
  }

  function writeEntry(roomId, scene, version) {
    const updatedAt = now();
    const entry = {
      version,
      updatedAt,
      expiresAt: updatedAt + ttlMs,
      scene: clone(scene),
    };
    entries.set(roomId, entry);
    return publicEntry(entry);
  }

  function enqueueWrite(roomId, operation) {
    if (closing || closed) {
      return Promise.reject(closedError());
    }

    const previous = writeQueues.get(roomId) || Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    writeQueues.set(roomId, current);
    return current.finally(() => {
      if (writeQueues.get(roomId) === current) {
        writeQueues.delete(roomId);
      }
    });
  }

  return {
    initialize(roomId, scene) {
      return enqueueWrite(roomId, () => {
        const existing = readEntry(roomId);
        return existing
          ? publicEntry(existing)
          : writeEntry(roomId, scene, 1);
      });
    },

    async get(roomId) {
      return publicEntry(readEntry(roomId));
    },

    replace(roomId, scene, validateScene = () => true, options = {}) {
      return enqueueWrite(roomId, () => {
        if (
          !Number.isSafeInteger(options?.expectedVersion)
          || options.expectedVersion < 1
        ) {
          return { accepted: false, reason: 'invalid_version' };
        }

        const current = readEntry(roomId);
        if (!current) {
          return { accepted: false, reason: 'missing_scene' };
        }
        if (current.version !== options.expectedVersion) {
          return { accepted: false, reason: 'conflict' };
        }

        if (
          !scene
          || typeof scene !== 'object'
          || typeof validateScene !== 'function'
          || !validateScene(scene)
        ) {
          return { accepted: false, reason: 'invalid_scene' };
        }

        return {
          accepted: true,
          ...writeEntry(roomId, scene, current.version + 1),
        };
      });
    },

    applyOperation(roomId, op, validateScene = () => true) {
      return enqueueWrite(roomId, () => {
        if (typeof validateScene !== 'function') {
          return { accepted: false, reason: 'invalid_scene' };
        }

        const current = readEntry(roomId);
        if (!current) {
          return { accepted: false, reason: 'missing_scene' };
        }

        const nextScene = applySceneOperation(current.scene, op);
        if (!nextScene || !validateScene(nextScene)) {
          return { accepted: false, reason: 'invalid_scene' };
        }

        return {
          accepted: true,
          ...writeEntry(roomId, nextScene, current.version + 1),
        };
      });
    },

    delete(roomId) {
      return enqueueWrite(roomId, () => {
        entries.delete(roomId);
      });
    },

    async checkReadiness() {
      if (closing || closed) throw closedError();
    },

    close() {
      if (closePromise) return closePromise;

      closing = true;
      closePromise = (async () => {
        while (writeQueues.size > 0) {
          await Promise.allSettled([...writeQueues.values()]);
        }
        entries.clear();
        writeQueues.clear();
        closed = true;
      })();
      return closePromise;
    },
  };
}
