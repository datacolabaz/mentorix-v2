const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');

const DEFAULT_TRIAL = {
  durationDays: 7,
  maxStudents: 5,
  dailyStudentLimit: 2,
};

function ceilDaysLeft(endDate) {
  const endMs = new Date(endDate).getTime();
  if (!Number.isFinite(endMs)) return 0;
  const diff = endMs - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

async function bakuTodayYmdDb(dbConn) {
  const { rows } = await dbConn.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd`
  );
  return rows[0]?.ymd || new Date().toISOString().slice(0, 10);
}

async function getInstructorPhoneVerified(dbConn, userId) {
  const { rows } = await dbConn.query(
    `SELECT id, role, phone_verified
     FROM users
     WHERE id = $1 AND is_active = TRUE
     LIMIT 1`,
    [userId]
  );
  const u = rows[0] || null;
  if (!u) return { ok: false, phone_verified: false };
  if (u.role !== 'instructor') return { ok: false, phone_verified: Boolean(u.phone_verified) };
  return { ok: true, phone_verified: Boolean(u.phone_verified) };
}

async function getTrialRow(dbConn, userId) {
  const { rows } = await dbConn.query(
    `SELECT user_id, start_date, end_date, max_students, used_students, daily_student_limit, is_active
     FROM trials
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function ensureTrialRow(dbConn, userId) {
  const cur = await getTrialRow(dbConn, userId);
  if (cur) return cur;
  const end = new Date(Date.now() + DEFAULT_TRIAL.durationDays * 86400000).toISOString();
  const { rows } = await dbConn.query(
    `INSERT INTO trials (user_id, start_date, end_date, max_students, used_students, daily_student_limit, is_active)
     VALUES ($1, NOW(), $2, $3, 0, $4, TRUE)
     RETURNING user_id, start_date, end_date, max_students, used_students, daily_student_limit, is_active`,
    [userId, end, DEFAULT_TRIAL.maxStudents, DEFAULT_TRIAL.dailyStudentLimit]
  );
  return rows[0] || null;
}

async function getDailyUsage(dbConn, userId, ymd) {
  const { rows } = await dbConn.query(
    `SELECT used_students
     FROM trial_daily_usage
     WHERE user_id = $1 AND ymd = $2
     LIMIT 1`,
    [userId, ymd]
  );
  return Number(rows[0]?.used_students || 0) || 0;
}

router.get('/status', authenticate, authorize('instructor'), async (req, res) => {
  try {
    const userId = req.user.id;
    const phone = await getInstructorPhoneVerified(db, userId);
    if (!phone.ok) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    // Contract: trial only counts after phone verified.
    // If phone isn't verified, don't auto-create a trial row.
    const phone_verified = phone.phone_verified;

    const todayYmd = await bakuTodayYmdDb(db);
    const trial = phone_verified ? await ensureTrialRow(db, userId) : await getTrialRow(db, userId);

    const ends_at = trial?.end_date ? new Date(trial.end_date).toISOString() : null;
    const days_left = ends_at ? ceilDaysLeft(ends_at) : 0;

    const used = Number(trial?.used_students || 0) || 0;
    const limit = Number(trial?.max_students || DEFAULT_TRIAL.maxStudents) || DEFAULT_TRIAL.maxStudents;
    const remaining = Math.max(0, limit - used);

    const dailyLimit = Number(trial?.daily_student_limit || DEFAULT_TRIAL.dailyStudentLimit) || DEFAULT_TRIAL.dailyStudentLimit;
    const used_today = phone_verified && trial ? await getDailyUsage(db, userId, todayYmd) : 0;
    const remaining_today = Math.max(0, dailyLimit - used_today);

    const trialActiveByFlags = Boolean(trial && trial.is_active);
    const trialActiveByTime = Boolean(trial && ends_at && Date.now() <= new Date(ends_at).getTime());
    const is_active = Boolean(trialActiveByFlags && trialActiveByTime);

    const should_warn = remaining <= 1;
    const should_block = !is_active || used >= limit || !phone_verified;

    let status = 'active';
    if (!phone_verified) status = 'blocked';
    else if (!trial) status = 'blocked';
    else if (!trialActiveByFlags) status = 'blocked';
    else if (!trialActiveByTime) status = 'expired';
    else if (used >= limit) status = 'blocked';
    else if (should_warn) status = 'warning';

    return res.json({
      is_active,
      days_left,
      ends_at,
      students: {
        used,
        limit,
        remaining,
      },
      daily_limit: {
        used_today,
        limit: dailyLimit,
        remaining_today,
      },
      requirements: {
        phone_verified,
      },
      status,
      should_warn,
      should_block,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

