import { Redis } from '@upstash/redis';

let defaultRedis;

export function createRedisClient(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error('Redis environment variables are not configured');
  }

  return new Redis({ url, token });
}

export function getDefaultRedis() {
  if (!defaultRedis) defaultRedis = createRedisClient();
  return defaultRedis;
}
