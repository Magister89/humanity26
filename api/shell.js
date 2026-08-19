import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  consumeRateLimit,
  getClientIdentifier,
  setRateLimitHeaders
} from './_lib/rate-limit.js';
import { getDefaultRedis } from './_lib/redis.js';

export function createShellHandler({
  getRedis = getDefaultRedis,
  limitAttempt = consumeRateLimit,
  identifyClient = getClientIdentifier,
  now = () => Date.now(),
  rateLimitOptions,
  logger = console
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const key = process.env.MESSAGE_KEY;
    const combo = process.env.MESSAGE_COMBO;

    if (!key || !combo) {
      return res.status(500).json({ error: 'Server not configured' });
    }

    const requestTime = now();
    const rateLimitSecret = process.env.RATE_LIMIT_SECRET || key;

    try {
      const redis = getRedis();
      const identifier = identifyClient(req, rateLimitSecret);
      const rateLimit = await limitAttempt(redis, identifier, requestTime, rateLimitOptions);
      setRateLimitHeaders(res, rateLimit, requestTime);

      if (!rateLimit.allowed) {
        return res.status(429).json({ error: 'Too many attempts' });
      }
    } catch (error) {
      logger.error?.('Shell rate limit failed', {
        message: error instanceof Error ? error.message : String(error)
      });
      return res.status(503).json({ error: 'Rate limit unavailable' });
    }

    const { keys } = req.body || {};

    if (
      !Array.isArray(keys) ||
      keys.length === 0 ||
      keys.length > 26 ||
      !keys.every(keyName => typeof keyName === 'string' && /^[a-z]$/i.test(keyName))
    ) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const submitted = keys.map(keyName => keyName.toLowerCase()).sort().join('');
    const submittedBuffer = Buffer.from(submitted);
    const comboBuffer = Buffer.from(combo);

    if (
      submittedBuffer.length !== comboBuffer.length ||
      !crypto.timingSafeEqual(submittedBuffer, comboBuffer)
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    try {
      const encryptedPath = join(process.cwd(), 'data', 'message.enc.json');
      const encryptedData = JSON.parse(readFileSync(encryptedPath, 'utf8'));

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(key, 'hex'),
        Buffer.from(encryptedData.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return res.status(200).json({ message: JSON.parse(decrypted) });
    } catch (error) {
      logger.error?.('Shell decryption failed', {
        name: error instanceof Error ? error.name : 'Error'
      });
      return res.status(500).json({ error: 'Failed to decrypt message' });
    }
  };
}

export default createShellHandler();
