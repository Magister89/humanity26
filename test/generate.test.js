import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createHandler,
  generateBSOD,
  getExpirationTime,
  getHourKey,
  normalizeBSOD,
  parseBSODContent
} from '../api/generate.js';

const VALID_BSOD = {
  errorCode: '0E_HUMANITY_FAULT',
  address: '0028:C0011E36',
  vxd: 'VHUMANITY.VXD',
  offset: '00010E36',
  message: 'A page fault occurred in VHUMANITY.VXD while processing the news. Protected mode has declined to protect anyone.'
};

function jsonResponse(body, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => headers[name.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

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

function createRedis(initialEntries = []) {
  const values = new Map(initialEntries);
  const writes = [];
  return {
    values,
    writes,
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value, options) {
      values.set(key, value);
      writes.push({ key, value, options });
      return 'OK';
    }
  };
}

const silentLogger = {
  error() {},
  warn() {}
};

test('builds UTC hourly cache boundaries', () => {
  const date = new Date('2026-08-19T23:59:30.000Z');
  assert.equal(getHourKey(date), 'bsod:2026-08-19-23');
  assert.equal(getExpirationTime(date).toISOString(), '2026-08-20T00:00:00.000Z');
});

test('normalizes valid model JSON and rejects non-VXD drivers', () => {
  assert.deepEqual(
    parseBSODContent(`\`\`\`json\n${JSON.stringify({ ...VALID_BSOD, vxd: 'vlogic' })}\n\`\`\``),
    { ...VALID_BSOD, vxd: 'VLOGIC.VXD' }
  );

  assert.throws(
    () => normalizeBSOD({ ...VALID_BSOD, vxd: 'CREATIVITY.DLL' }),
    /Invalid vxd/
  );
});

test('calls the Z.AI Coding endpoint with structured output enabled', async () => {
  let capturedUrl;
  let capturedOptions;

  const result = await generateBSOD(['Test headline'], {
    apiKey: 'test-key',
    attempts: 1,
    fetchImpl: async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return jsonResponse({ choices: [{ message: { content: JSON.stringify(VALID_BSOD) } }] });
    }
  });

  assert.deepEqual(result, VALID_BSOD);
  assert.equal(capturedUrl, 'https://api.z.ai/api/coding/paas/v4/chat/completions');
  assert.equal(capturedOptions.headers.Authorization, 'Bearer test-key');

  const request = JSON.parse(capturedOptions.body);
  assert.equal(request.model, 'glm-5.3');
  assert.deepEqual(request.response_format, { type: 'json_object' });
  assert.deepEqual(request.thinking, { type: 'enabled' });
  assert.equal(request.reasoning_effort, 'low');
});

test('retries transient Z.AI failures', async () => {
  let calls = 0;
  const delays = [];

  const result = await generateBSOD(['Test headline'], {
    apiKey: 'test-key',
    attempts: 2,
    sleep: async delay => delays.push(delay),
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse({ error: { message: 'temporarily unavailable' } }, 503);
      }
      return jsonResponse({ choices: [{ message: { content: JSON.stringify(VALID_BSOD) } }] });
    }
  });

  assert.deepEqual(result, VALID_BSOD);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [300]);
});

test('does not retry non-transient Z.AI failures', async () => {
  let calls = 0;
  const delays = [];

  await assert.rejects(
    generateBSOD(['Test headline'], {
      apiKey: 'test-key',
      attempts: 2,
      sleep: async delay => delays.push(delay),
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ error: { message: 'invalid credentials' } }, 401);
      }
    }),
    /Z\.AI returned HTTP 401/
  );

  assert.equal(calls, 1);
  assert.deepEqual(delays, []);
});

test('serves a short-lived fallback when no cache exists', async () => {
  const fixedNow = new Date('2026-08-19T10:10:00.000Z');
  const redis = createRedis();
  const handler = createHandler({
    getRedis: () => redis,
    getCronSecret: () => 'cron-secret',
    now: () => new Date(fixedNow),
    logger: silentLogger
  });
  const response = createResponse();

  await handler({ method: 'GET', headers: {}, query: {} }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.fallback, true);
  assert.equal(response.body.cached, false);
  assert.equal(response.body.expiresAt, '2026-08-19T10:15:00.000Z');
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('authorized generation populates current and last-known-good caches', async () => {
  const fixedNow = new Date('2026-08-19T10:00:05.000Z');
  const redis = createRedis();
  const handler = createHandler({
    getRedis: () => redis,
    getCronSecret: () => 'cron-secret',
    now: () => new Date(fixedNow),
    fetchHeadlines: async () => ['Test headline'],
    generate: async () => VALID_BSOD,
    logger: silentLogger
  });
  const response = createResponse();

  await handler(
    {
      method: 'GET',
      headers: { authorization: 'Bearer cron-secret' },
      query: {}
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.fallback, false);
  assert.equal(response.body.cached, false);
  assert.equal(redis.writes.length, 2);
  assert.equal(redis.writes[0].key, 'bsod:2026-08-19-10');
  assert.equal(redis.writes[1].key, 'bsod:latest');
});

test('serves last-known-good data after a current-hour miss', async () => {
  const fixedNow = new Date('2026-08-19T11:05:00.000Z');
  const latest = { ...VALID_BSOD, generatedAt: '2026-08-19T10:00:05.000Z' };
  const redis = createRedis([['bsod:latest', latest]]);
  const handler = createHandler({
    getRedis: () => redis,
    getCronSecret: () => 'cron-secret',
    now: () => new Date(fixedNow),
    logger: silentLogger
  });
  const response = createResponse();

  await handler({ method: 'GET', headers: {}, query: {} }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.cached, true);
  assert.equal(response.body.stale, true);
  assert.equal(response.body.fallback, false);
  assert.equal(response.body.bsod.message, VALID_BSOD.message);
});

test('ignores force refresh requests without cron authorization', async () => {
  const redis = createRedis();
  let generationCalls = 0;
  const handler = createHandler({
    getRedis: () => redis,
    getCronSecret: () => 'cron-secret',
    now: () => new Date('2026-08-19T10:00:05.000Z'),
    generate: async () => {
      generationCalls += 1;
      return VALID_BSOD;
    },
    logger: silentLogger
  });
  const response = createResponse();

  await handler(
    {
      method: 'GET',
      headers: {},
      query: { force: 'true' }
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.fallback, true);
  assert.equal(generationCalls, 0);
});

test('returns 503 when the current-hour cache write fails', async () => {
  const redis = {
    async get() {
      return null;
    },
    async set() {
      throw new Error('redis unavailable');
    }
  };
  const handler = createHandler({
    getRedis: () => redis,
    getCronSecret: () => 'cron-secret',
    now: () => new Date('2026-08-19T10:00:05.000Z'),
    fetchHeadlines: async () => ['Test headline'],
    generate: async () => VALID_BSOD,
    logger: silentLogger
  });
  const response = createResponse();

  await handler(
    {
      method: 'GET',
      headers: { authorization: 'Bearer cron-secret' },
      query: {}
    },
    response
  );

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: 'CACHE_WRITE_FAILED' });
});

test('returns a failing status to cron when generation fails', async () => {
  const redis = createRedis();
  const handler = createHandler({
    getRedis: () => redis,
    getCronSecret: () => 'cron-secret',
    now: () => new Date('2026-08-19T10:00:05.000Z'),
    fetchHeadlines: async () => ['Test headline'],
    generate: async () => {
      throw new Error('provider unavailable');
    },
    logger: silentLogger
  });
  const response = createResponse();

  await handler(
    {
      method: 'GET',
      headers: { authorization: 'Bearer cron-secret' },
      query: {}
    },
    response
  );

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, { error: 'AI_GENERATION_FAILED' });
  assert.equal(redis.writes.length, 0);
});
