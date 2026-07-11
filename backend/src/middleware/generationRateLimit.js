const { randomUUID } = require('crypto');
const {
  getGenerationRateLimitPerHour,
  countTeacherGenerationsLastHour,
} = require('../services/generationRateLimitService');

function resolveCorrelationId(req) {
  const header =
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    req.correlationId;
  if (header && String(header).trim()) return String(header).trim();
  return randomUUID();
}

/**
 * Per-teacher sliding-window rate limit for AI generation endpoints.
 * Key: req.user.id (instructor). Backed by generation_requests timestamps in PostgreSQL.
 */
function createGenerationRateLimit({
  countFn = countTeacherGenerationsLastHour,
  limitFn = getGenerationRateLimitPerHour,
} = {}) {
  return async function generationRateLimit(req, res, next) {
    try {
      const teacherId = req.user?.id;
      if (!teacherId) {
        return res.status(401).json({ success: false, message: 'Token yoxdur' });
      }

      const limit = limitFn();
      const count = await countFn(teacherId);
      if (count >= limit) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Saatlıq generasiya limitinə çatdınız (${limit}/saat). Bir az sonra yenidən yoxlayın.`,
            correlationId: resolveCorrelationId(req),
          },
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

const generationRateLimit = createGenerationRateLimit();

module.exports = {
  generationRateLimit,
  createGenerationRateLimit,
  resolveCorrelationId,
};
