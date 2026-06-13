const db = require('../utils/db');
const { getPhoneVerificationBlock } = require('../utils/instructorPhone');

/**
 * Lazy OTP: yalnız müəllim ciddi əməliyyat edəndə telefon təsdiqi tələb olunur.
 * Admin və digər rollar keçir.
 */
function requireInstructorPhoneVerification(opts = {}) {
  const trigger = opts.trigger || 'action';
  return async (req, res, next) => {
    try {
      if (req.user?.role !== 'instructor') return next();
      const block = await getPhoneVerificationBlock(db, req.user.id, { trigger });
      if (block) {
        return res.status(block.statusCode).json(block.body);
      }
      return next();
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };
}

module.exports = { requireInstructorPhoneVerification };
