/**
 * In-memory per-user sliding-window limit for write endpoints (per replica; a soft abuse guard,
 * not a quota). Falls back to the client IP for unauthenticated requests.
 */
const { clientIp } = require('../utils/clientIp');

function userRateLimit({ windowMs = 10 * 60 * 1000, max = 30, name = 'default' } = {}) {
  const buckets = new Map();
  return function userRateLimitMiddleware(req, res, next) {
    const key = `${name}:${req.user?.id || clientIp(req) || 'unknown'}`;
    const now = Date.now();
    const bucket = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (bucket.length >= max) {
      buckets.set(key, bucket);
      return res.status(429).json({
        success: false,
        message: 'Çox sayda sorğu. Bir neçə dəqiqə sonra yenidən cəhd edin.',
        code: 'RATE_LIMITED',
      });
    }
    bucket.push(now);
    buckets.set(key, bucket);
    if (buckets.size > 5000) {
      for (const [k, list] of buckets) if (!list.some((t) => now - t < windowMs)) buckets.delete(k);
    }
    return next();
  };
}

module.exports = { userRateLimit };
