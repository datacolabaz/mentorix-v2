const { clientIp } = require('../utils/clientIp');

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const buckets = new Map();

function pruneBucket(bucket, now) {
  while (bucket.length && now - bucket[0] > WINDOW_MS) {
    bucket.shift();
  }
}

/** Public qonaq join — IP əsaslı rate limit (5 dəqiqədə max 5 cəhd). */
function publicGuestJoinRateLimit(req, res, next) {
  const ip = clientIp(req) || 'unknown';
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket) {
    bucket = [];
    buckets.set(ip, bucket);
  }
  pruneBucket(bucket, now);
  if (bucket.length >= MAX_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      message: 'Çox sayda cəhd. Bir neçə dəqiqə sonra yenidən yoxlayın.',
      code: 'RATE_LIMITED',
    });
  }
  bucket.push(now);
  return next();
}

module.exports = { publicGuestJoinRateLimit };
