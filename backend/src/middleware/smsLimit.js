const db = require('../utils/db');

const checkSmsLimit = async (req, res, next) => {
  try {
    const instructorId = req.user.role === 'admin'
      ? req.body.instructor_id
      : req.user.id;

    const { rows } = await db.query(
      'SELECT sms_limit, sms_used FROM instructor_profiles WHERE user_id = $1',
      [instructorId]
    );

    if (!rows[0])
      return res.status(404).json({ success: false, message: 'Müəllim profili tapılmadı' });

    const { sms_limit, sms_used } = rows[0];

    if (sms_used >= sms_limit)
      return res.status(429).json({
        success: false,
        message: `SMS limiti dolub (${sms_used}/${sms_limit})`,
      });

    req.smsRemaining = sms_limit - sms_used;
    req.instructorId = instructorId;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { checkSmsLimit };
