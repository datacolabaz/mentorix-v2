/**
 * Redis-ready program search cache.
 *
 * Production: set REDIS_URL=redis://... and install ioredis.
 * Dev/fallback: in-memory Map with TTL (matches subscriptionPlansService pattern).
 *
 * Cache key: programs:search:{sha256(sorted query params)}
 * TTL: 120s (heavy search traffic; admin seed changes reflect within 2 min)
 */

const crypto = require('crypto');

const CACHE_TTL_SEC = Number(process.env.PROGRAMS_CACHE_TTL_SEC || 120);
const memoryStore = new Map();

let redisClient = null;
let redisInitAttempted = false;

async function getRedisClient() {
  if (redisClient) return redisClient;
  if (redisInitAttempted) return null;
  redisInitAttempted = true;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const Redis = require('ioredis');
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.warn('[programs-cache] Redis unavailable, using memory fallback:', err?.message || err);
    redisClient = null;
    return null;
  }
}

function buildCacheKey(prefix, payload) {
  const stable = JSON.stringify(payload, Object.keys(payload).sort());
  const hash = crypto.createHash('sha256').update(stable).digest('hex').slice(0, 24);
  return `${prefix}:${hash}`;
}

async function cacheGet(key) {
  const redis = await getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      /* fall through */
    }
  }

  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

async function cacheSet(key, value, ttlSec = CACHE_TTL_SEC) {
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
      return;
    } catch {
      /* fall through */
    }
  }

  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSec * 1000,
  });
}

function buildProgramsSearchCacheKey(filters) {
  return buildCacheKey('programs:search', filters);
}

module.exports = {
  CACHE_TTL_SEC,
  buildProgramsSearchCacheKey,
  cacheGet,
  cacheSet,
};
