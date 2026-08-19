import assert from 'node:assert/strict';
import test from 'node:test';

import { consumeRateLimit, getClientIdentifier } from '../api/_lib/rate-limit.js';
import { createShellHandler } from '../api/shell.js';

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    }
  };
}

function createAllowedHandler(overrides = {}) {
  return createShellHandler({
    getRedis: () => ({}),
    identifyClient: () => 'test-client',
    limitAttempt: async () => ({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAt: 600_000
    }),
    now: () => 0,
    logger: { error() {} },
    ...overrides
  });
}

async function withShellEnvironment(callback) {
  const previousKey = process.env.MESSAGE_KEY;
  const previousCombo = process.env.MESSAGE_COMBO;
  process.env.MESSAGE_KEY = '00'.repeat(32);
  process.env.MESSAGE_COMBO = 'abcd';

  try {
    await callback();
  } finally {
    if (previousKey === undefined) delete process.env.MESSAGE_KEY;
    else process.env.MESSAGE_KEY = previousKey;
    if (previousCombo === undefined) delete process.env.MESSAGE_COMBO;
    else process.env.MESSAGE_COMBO = previousCombo;
  }
}

test('rejects malformed shell key entries without throwing', async () => {
  await withShellEnvironment(async () => {
    const response = createResponse();
    await createAllowedHandler()({ method: 'POST', body: { keys: [1] } }, response);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { error: 'Invalid request' });
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['ratelimit-remaining'], '9');
  });
});

test('uses a generic denial for a valid but incorrect combo', async () => {
  await withShellEnvironment(async () => {
    const response = createResponse();
    await createAllowedHandler()(
      { method: 'POST', body: { keys: ['a', 'b', 'c', 'e'] } },
      response
    );

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.body, { error: 'Access denied' });
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  });
});

test('logs only an error type when shell decryption fails', async () => {
  await withShellEnvironment(async () => {
    const errors = [];
    const response = createResponse();
    const handler = createAllowedHandler({
      logger: {
        error(message, metadata) {
          errors.push({ message, metadata });
        }
      }
    });

    await handler(
      { method: 'POST', body: { keys: ['a', 'b', 'c', 'd'] } },
      response
    );

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { error: 'Failed to decrypt message' });
    assert.equal(errors.length, 1);
    assert.equal(errors[0].message, 'Shell decryption failed');
    assert.deepEqual(Object.keys(errors[0].metadata), ['name']);
  });
});

test('returns 429 with reset metadata after the attempt limit', async () => {
  await withShellEnvironment(async () => {
    const response = createResponse();
    const handler = createAllowedHandler({
      limitAttempt: async () => ({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAt: 600_000
      })
    });

    await handler(
      { method: 'POST', body: { keys: ['a', 'b', 'c', 'd'] } },
      response
    );

    assert.equal(response.statusCode, 429);
    assert.deepEqual(response.body, { error: 'Too many attempts' });
    assert.equal(response.headers['ratelimit-limit'], '10');
    assert.equal(response.headers['ratelimit-remaining'], '0');
    assert.equal(response.headers['ratelimit-reset'], '600');
    assert.equal(response.headers['retry-after'], '600');
  });
});

test('fails closed when the rate-limit store is unavailable', async () => {
  await withShellEnvironment(async () => {
    const response = createResponse();
    const handler = createAllowedHandler({
      limitAttempt: async () => {
        throw new Error('redis unavailable');
      }
    });

    await handler(
      { method: 'POST', body: { keys: ['a', 'b', 'c', 'd'] } },
      response
    );

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, { error: 'Rate limit unavailable' });
  });
});

test('uses one atomic pipeline for the fixed-window counter and cleanup', async () => {
  const calls = [];
  const pipeline = {
    incr(key) {
      calls.push(['incr', key]);
      return this;
    },
    expire(key, seconds) {
      calls.push(['expire', key, seconds]);
      return this;
    },
    async exec() {
      calls.push(['exec']);
      return [3, 1];
    }
  };

  const result = await consumeRateLimit(
    { pipeline: () => pipeline },
    'hashed-client',
    123_000,
    { limit: 4, windowMs: 60_000 }
  );

  assert.deepEqual(result, {
    allowed: true,
    limit: 4,
    remaining: 1,
    resetAt: 180_000
  });
  assert.match(calls[0][1], /^humanity26:shell-rate:2:hashed-client$/);
  assert.deepEqual(calls.at(-1), ['exec']);
});

test('hashes the trusted proxy address instead of storing raw IP data', () => {
  const identifier = getClientIdentifier(
    {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.7'
      }
    },
    'rate-limit-secret'
  );

  assert.match(identifier, /^[a-f0-9]{64}$/);
  assert.equal(identifier.includes('203.0.113.7'), false);
});
