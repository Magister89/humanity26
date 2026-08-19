import crypto from 'node:crypto';

export const SHELL_RATE_LIMIT = 10;
export const SHELL_RATE_WINDOW_MS = 10 * 60 * 1000;

function firstHeaderValue(value, { takeLast = false } = {}) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return '';
  const values = raw.split(',').map(part => part.trim()).filter(Boolean);
  return (takeLast ? values.at(-1) : values[0]) || '';
}

export function getClientIdentifier(req, secret) {
  const headers = req.headers || {};
  const address =
    firstHeaderValue(headers['x-vercel-forwarded-for']) ||
    firstHeaderValue(headers['x-real-ip']) ||
    firstHeaderValue(headers['x-forwarded-for'], { takeLast: true }) ||
    req.socket?.remoteAddress ||
    'unknown';

  return crypto
    .createHmac('sha256', secret)
    .update(String(address).slice(0, 256))
    .digest('hex');
}

export async function consumeRateLimit(
  redis,
  identifier,
  nowMs = Date.now(),
  { limit = SHELL_RATE_LIMIT, windowMs = SHELL_RATE_WINDOW_MS } = {}
) {
  const bucket = Math.floor(nowMs / windowMs);
  const resetAt = (bucket + 1) * windowMs;
  const key = `humanity26:shell-rate:${bucket}:${identifier}`;
  const cleanupSeconds = Math.ceil(windowMs / 1000) + 60;
  const [count] = await redis
    .pipeline()
    .incr(key)
    .expire(key, cleanupSeconds)
    .exec();
  if (count === null || count === undefined || count === '') {
    throw new Error('Invalid rate-limit response');
  }

  const numericCount = Number(count);
  if (!Number.isFinite(numericCount)) {
    throw new Error('Invalid rate-limit response');
  }

  return {
    allowed: numericCount <= limit,
    limit,
    remaining: Math.max(0, limit - numericCount),
    resetAt
  };
}

export function setRateLimitHeaders(res, result, nowMs = Date.now()) {
  const resetSeconds = Math.max(0, Math.ceil((result.resetAt - nowMs) / 1000));
  res.setHeader('RateLimit-Limit', String(result.limit));
  res.setHeader('RateLimit-Remaining', String(result.remaining));
  res.setHeader('RateLimit-Reset', String(resetSeconds));

  if (!result.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, resetSeconds)));
  }
}
