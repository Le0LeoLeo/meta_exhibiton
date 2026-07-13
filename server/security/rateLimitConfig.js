const CANONICAL_DECIMAL = /^(0|[1-9]\d*)$/;

export function readBoundedEnvInteger(
  env,
  name,
  {
    defaultValue,
    min,
    max,
  },
) {
  const rawValue = env[name];
  if (rawValue === undefined) return defaultValue;

  const valueText = String(rawValue);
  if (!CANONICAL_DECIMAL.test(valueText)) {
    throw new Error(`${name} must be a decimal integer between ${min} and ${max}`);
  }

  const value = Number(valueText);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be a decimal integer between ${min} and ${max}`);
  }

  return value;
}

export function createRateLimitKey({ optionalAuth } = {}) {
  return function rateLimitKey(req) {
    const payload = req.auth || optionalAuth?.(req);
    const subject = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
    if (subject) return `user:${subject}`;

    return typeof req.ip === 'string' && req.ip.trim()
      ? req.ip.trim()
      : undefined;
  };
}
