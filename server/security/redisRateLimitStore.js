import { createHash } from 'node:crypto';
import { createClient } from 'redis';

const CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

function hashSubject(value) {
  const subject = typeof value === 'string' && value.trim()
    ? value
    : '__missing__';
  return createHash('sha256').update(subject).digest('hex');
}

export function createRedisRateLimitStore({
  url,
  client = createClient({ url }),
  onError = () => {},
} = {}) {
  client.on?.('error', onError);
  let connectPromise = null;

  async function ensureConnected() {
    if (client.isOpen) return;
    connectPromise ||= client.connect();
    try {
      await connectPromise;
    } catch (error) {
      connectPromise = null;
      throw error;
    }
  }

  return {
    async consume({ namespace, key, limit, windowMs }) {
      await ensureConnected();
      const redisKey = `mrei:rate-limit:${namespace}:${hashSubject(key)}`;
      const [count, ttl] = await client.eval(CONSUME_SCRIPT, {
        keys: [redisKey],
        arguments: [String(windowMs)],
      });
      const retryAfterMs = Number(ttl);
      return {
        allowed: Number(count) <= limit,
        retryAfterMs: Number(count) <= limit ? 0 : Math.max(0, retryAfterMs),
      };
    },
    async checkReadiness() {
      await ensureConnected();
      await client.ping();
    },
    async close() {
      if (client.isOpen) await client.quit();
    },
  };
}
