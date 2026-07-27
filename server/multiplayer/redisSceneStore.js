import { createHash } from 'node:crypto';

import { applySceneOperation } from './sceneState.js';

const DEFAULT_TTL_SECONDS = 60 * 60;
const DEFAULT_SCENE_MAX_BYTES = 1024 * 1024;
const DEFAULT_MAX_RETRIES = 5;
const ENVELOPE_OVERHEAD_BYTES = 1024;
const MAX_TTL_SECONDS = 24 * 60 * 60;
const MAX_RETRIES = 5;

const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then
  return {0, 'missing'}
end
local decoded = cjson.decode(current)
if tonumber(decoded.version) ~= tonumber(ARGV[1]) then
  return {0, tostring(decoded.version)}
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return {1, tostring(ARGV[1] + 1)}
`;

function clone(value) {
  return structuredClone(value);
}

function keyForRoom(roomId) {
  if (typeof roomId !== 'string' || !roomId) {
    throw new TypeError('roomId must be a non-empty string');
  }
  const hash = createHash('sha256').update(roomId).digest('hex');
  return `mrei:multiplayer:scene:${hash}`;
}

function serializeSceneBounded(scene, sceneMaxBytes) {
  const serialized = JSON.stringify(scene);
  if (Buffer.byteLength(serialized, 'utf8') > sceneMaxBytes) {
    throw new RangeError('Redis scene exceeds sceneMaxBytes');
  }
  return serialized;
}

function serializeEnvelopeBounded(envelope, envelopeMaxBytes) {
  const serialized = JSON.stringify(envelope);
  if (Buffer.byteLength(serialized, 'utf8') > envelopeMaxBytes) {
    throw new RangeError('Redis scene envelope exceeds envelopeMaxBytes');
  }
  return serialized;
}

function parseEnvelope(
  raw,
  { sceneMaxBytes, envelopeMaxBytes, validateScene },
) {
  if (typeof raw !== 'string') {
    throw new TypeError('Redis scene state must be a JSON string');
  }
  if (Buffer.byteLength(raw, 'utf8') > envelopeMaxBytes) {
    throw new RangeError('Redis scene envelope exceeds envelopeMaxBytes');
  }

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new SyntaxError('Redis scene state contains malformed JSON');
  }

  if (
    !envelope
    || typeof envelope !== 'object'
    || Array.isArray(envelope)
    || !Number.isSafeInteger(envelope.version)
    || envelope.version < 1
    || !Number.isSafeInteger(envelope.updatedAt)
    || envelope.updatedAt < 0
    || !envelope.scene
    || typeof envelope.scene !== 'object'
    || Array.isArray(envelope.scene)
  ) {
    throw new TypeError('Redis scene state has an invalid envelope');
  }

  serializeSceneBounded(envelope.scene, sceneMaxBytes);
  if (!validateScene(clone(envelope.scene))) {
    throw new TypeError('Redis scene state has an invalid envelope');
  }
  return clone(envelope);
}

export function createRedisSceneStore({
  client,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  sceneMaxBytes = DEFAULT_SCENE_MAX_BYTES,
  maxRetries = DEFAULT_MAX_RETRIES,
  validateScene = () => true,
  now = Date.now,
  ownsClient = false,
} = {}) {
  if (!client || typeof client !== 'object') {
    throw new TypeError('client is required');
  }
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_TTL_SECONDS) {
    throw new TypeError(`ttlSeconds must be an integer from 1 to ${MAX_TTL_SECONDS}`);
  }
  if (
    !Number.isInteger(sceneMaxBytes)
    || sceneMaxBytes < 1
    || sceneMaxBytes > DEFAULT_SCENE_MAX_BYTES
  ) {
    throw new TypeError(
      `sceneMaxBytes must be an integer from 1 to ${DEFAULT_SCENE_MAX_BYTES}`,
    );
  }
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > MAX_RETRIES) {
    throw new TypeError(`maxRetries must be an integer from 0 to ${MAX_RETRIES}`);
  }
  if (typeof validateScene !== 'function') {
    throw new TypeError('validateScene must be a function');
  }
  if (typeof now !== 'function') {
    throw new TypeError('now must be a function');
  }

  const envelopeMaxBytes = sceneMaxBytes + ENVELOPE_OVERHEAD_BYTES;
  const activeOperations = new Set();
  let closing = false;
  let closed = false;
  let closePromise = null;

  function closedError() {
    return new Error('Redis scene store is closed');
  }

  function runOperation(operation) {
    if (closing || closed) return Promise.reject(closedError());

    let tracked;
    tracked = Promise.resolve()
      .then(operation)
      .finally(() => {
        activeOperations.delete(tracked);
      });
    activeOperations.add(tracked);
    return tracked;
  }

  function validateCandidate(scene, validator) {
    return (
      scene
      && typeof scene === 'object'
      && !Array.isArray(scene)
      && validator(clone(scene))
    );
  }

  async function read(roomId) {
    const raw = await client.get(keyForRoom(roomId));
    return raw === null
      ? null
      : parseEnvelope(raw, {
        sceneMaxBytes,
        envelopeMaxBytes,
        validateScene,
      });
  }

  async function compareAndSet(roomId, expectedVersion, scene) {
    serializeSceneBounded(scene, sceneMaxBytes);
    const envelope = {
      version: expectedVersion + 1,
      updatedAt: now(),
      scene: clone(scene),
    };
    const serialized = serializeEnvelopeBounded(envelope, envelopeMaxBytes);
    const result = await client.eval(CAS_SCRIPT, {
      keys: [keyForRoom(roomId)],
      arguments: [
        String(expectedVersion),
        serialized,
        String(ttlSeconds),
      ],
    });
    return Number(result?.[0]) === 1 ? clone(envelope) : null;
  }

  async function writeWithCas(roomId, transition, validator) {
    if (typeof validator !== 'function') {
      return { accepted: false, reason: 'invalid_scene' };
    }

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const current = await read(roomId);
      if (!current) {
        return { accepted: false, reason: 'missing_scene' };
      }

      const nextScene = transition(clone(current.scene));
      if (!validateCandidate(nextScene, validator)) {
        return { accepted: false, reason: 'invalid_scene' };
      }

      const written = await compareAndSet(roomId, current.version, nextScene);
      if (written) {
        return { accepted: true, ...written };
      }
    }

    return { accepted: false, reason: 'conflict' };
  }

  return {
    initialize(roomId, scene) {
      return runOperation(async () => {
        if (!validateCandidate(scene, validateScene)) {
          throw new TypeError('Cannot initialize an invalid scene');
        }
        serializeSceneBounded(scene, sceneMaxBytes);

        const envelope = {
          version: 1,
          updatedAt: now(),
          scene: clone(scene),
        };
        const result = await client.set(
          keyForRoom(roomId),
          serializeEnvelopeBounded(envelope, envelopeMaxBytes),
          { NX: true, EX: ttlSeconds },
        );
        if (result === 'OK' || result === true) return clone(envelope);

        const existing = await read(roomId);
        if (!existing) {
          throw new Error('Redis scene initialization lost its concurrent value');
        }
        return existing;
      });
    },

    get(roomId) {
      return runOperation(() => read(roomId));
    },

    replace(roomId, scene, validator = validateScene, options) {
      return runOperation(async () => {
        const expectedVersion = options?.expectedVersion;
        if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
          return { accepted: false, reason: 'invalid_version' };
        }

        const current = await read(roomId);
        if (!current) {
          return { accepted: false, reason: 'missing_scene' };
        }
        if (current.version !== expectedVersion) {
          return { accepted: false, reason: 'conflict' };
        }
        if (typeof validator !== 'function' || !validateCandidate(scene, validator)) {
          return { accepted: false, reason: 'invalid_scene' };
        }
        serializeSceneBounded(scene, sceneMaxBytes);

        const written = await compareAndSet(roomId, expectedVersion, scene);
        return written
          ? { accepted: true, ...written }
          : { accepted: false, reason: 'conflict' };
      });
    },

    applyOperation(roomId, op, validator = validateScene) {
      return runOperation(() => writeWithCas(
        roomId,
        (currentScene) => applySceneOperation(currentScene, clone(op)),
        validator,
      ));
    },

    delete(roomId) {
      return runOperation(() => client.del(keyForRoom(roomId)));
    },

    checkReadiness() {
      return runOperation(() => client.ping());
    },

    close() {
      if (closePromise) return closePromise;
      closing = true;
      closePromise = (async () => {
        try {
          while (activeOperations.size > 0) {
            await Promise.allSettled([...activeOperations]);
          }
          if (ownsClient && client.isOpen !== false) {
            await client.quit();
          }
        } finally {
          closed = true;
        }
      })();
      return closePromise;
    },
  };
}
