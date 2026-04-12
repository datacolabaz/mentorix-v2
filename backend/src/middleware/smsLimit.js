const { checkSmsQuota } = require('../services/smsQuotaService');

const checkSmsLimit = async (req, res, next) => {
  try {
    const instructorId =
      req.user.role === 'admin' ? req.body.instructor_id : req.user.id;

    const quota = await checkSmsQuota(instructorId, { requireProfile: true });
    if (!quota.ok) {
      return res.status(quota.statusCode).json(quota.body);
    }

    req.smsRemaining = quota.remaining ?? 0;
    req.instructorId = instructorId;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { checkSmsLimit };
