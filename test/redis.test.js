import assert from 'node:assert/strict';
import test from 'node:test';
import { Redis } from '@upstash/redis';
import { createRedisClient } from '../api/_lib/redis.js';

test('creates Redis clients from Vercel-managed credentials', () => {
  const redis = createRedisClient({
    KV_REST_API_URL: 'https://example.upstash.io',
    KV_REST_API_TOKEN: 'test-token'
  });

  assert.ok(redis instanceof Redis);
});

test('rejects missing or manual Redis credential aliases', () => {
  assert.throws(() => createRedisClient({}), /not configured/);
  assert.throws(
    () =>
      createRedisClient({
        UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'test-token'
      }),
    /not configured/
  );
});
