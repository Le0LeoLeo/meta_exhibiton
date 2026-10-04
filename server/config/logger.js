const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(authorization|cookie|token|secret|password|api[-_]?key|database64)/i;
const BEARER_CREDENTIAL = /\bBearer\s+[^\s,;]+/gi;
const JWT_CREDENTIAL = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const URL_CREDENTIAL = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@]*:[^\s/@]+@/gi;

function sanitizeErrorText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(BEARER_CREDENTIAL, `Bearer ${REDACTED}`)
    .replace(JWT_CREDENTIAL, REDACTED)
    .replace(URL_CREDENTIAL, `$1${REDACTED}@`);
}

function sanitize(value, seen = new WeakSet()) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeErrorText(value.message),
      stack: sanitizeErrorText(value.stack),
    };
  }
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';

  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? REDACTED : sanitize(item, seen),
  ]));
}

export function createLogger({ write = process.stdout.write.bind(process.stdout) } = {}) {
  const log = (level, event, fields = {}) => {
    write(`${JSON.stringify({
      ...sanitize(fields),
      timestamp: new Date().toISOString(),
      level,
      event,
    })}\n`);
  };

  return {
    info(event, fields = {}) {
      log('info', event, fields);
    },
    warn(event, fields = {}) {
      log('warn', event, fields);
    },
    error(event, error, fields = {}) {
      log('error', event, { ...fields, error });
    },
  };
}

export const logger = createLogger();
