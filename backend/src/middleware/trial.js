const db = require('../utils/db');

const DEFAULT_TRIAL = {
  durationDays: 7,
  maxStudents: 5,
  dailyStudentLimit: 2,
};

async function bakuTodayYmdDb(dbConn) {
  const { rows } = await dbConn.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS ymd`
  );
  return rows[0]?.ymd || new Date().toISOString().slice(0, 10);
}

function httpError(code, statusCode = 400, message = code) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  err.status = statusCode;
  return err;
}

function effectiveInstructorId(req) {
  if (req.user?.role === 'admin') {
    const raw = req.body?.instructor_id || req.query?.instructor_id;
    return raw || null;
  }
  return req.user?.id || null;
}

/** Auth no longer requires phone OTP; keep hook for route compatibility. */
async function requireInstructorPhoneVerified(req, _res, next) {
  try {
    const instructorId = effectiveInstructorId(req);
    if (!instructorId) throw httpError('INSTRUCTOR_REQUIRED', 400, 'INSTRUCTOR_REQUIRED');

    const { rows } = await db.query(
      `SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [instructorId]
    );
    const u = rows[0];
    if (!u || u.role !== 'instructor') throw httpError('INSTRUCTOR_REQUIRED', 400, 'INSTRUCTOR_REQUIRED');

    req.trial_instructor_id = instructorId;
    next();
  } catch (e) {
    next(e);
  }
}

async function ensureActiveTrialRow(dbConn, instructorId) {
  const { rows } = await dbConn.query(
    `SELECT user_id, start_date, end_date, max_students, used_students, daily_student_limit, is_active
     FROM trials
     WHERE user_id = $1
     LIMIT 1`,
    [instructorId]
  );
  const cur = rows[0] || null;

  const todayYmd = await bakuTodayYmdDb(dbConn);
  const now = new Date();
  const end = new Date(now.getTime() + DEFAULT_TRIAL.durationDays * 86400000);

  // Create trial at first eligible action (phone already verified).
  if (!cur) {
    const { rows: ins } = await dbConn.query(
      `INSERT INTO trials (user_id, start_date, end_date, max_students, used_students, daily_student_limit, is_active)
       VALUES ($1, NOW(), $2, $3, 0, $4, TRUE)
       RETURNING user_id, start_date, end_date, max_students, used_students, daily_student_limit, is_active`,
      [instructorId, end.toISOString(), DEFAULT_TRIAL.maxStudents, DEFAULT_TRIAL.dailyStudentLimit]
    );
    // Seed daily row (optional)
    await dbConn.query(
      `INSERT INTO trial_daily_usage (user_id, ymd, used_students)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id, ymd) DO NOTHING`,
      [instructorId, todayYmd]
    );
    return ins[0];
  }
  return cur;
}

async function checkTrialActive(req, _res, next) {
  try {
    const instructorId = req.trial_instructor_id || effectiveInstructorId(req);
    if (!instructorId) throw httpError('INSTRUCTOR_REQUIRED', 400, 'INSTRUCTOR_REQUIRED');

    const trial = await ensureActiveTrialRow(db, instructorId);
    if (!trial.is_active) throw httpError('TRIAL_INACTIVE', 403, 'TRIAL_INACTIVE');
    const now = Date.now();
    const endMs = new Date(trial.end_date).getTime();
    if (!Number.isFinite(endMs) || now > endMs) throw httpError('TRIAL_EXPIRED', 403, 'TRIAL_EXPIRED');

    req.trial = trial;
    next();
  } catch (e) {
    next(e);
  }
}

async function checkStudentLimit(req, _res, next) {
  try {
    const trial = req.trial;
    if (!trial) throw httpError('TRIAL_REQUIRED', 400, 'TRIAL_REQUIRED');
    if (Number(trial.used_students) >= Number(trial.max_students)) {
      throw httpError('TRIAL_LIMIT_REACHED', 403, 'TRIAL_LIMIT_REACHED');
    }
    next();
  } catch (e) {
    next(e);
  }
}

async function checkDailyStudentLimit(req, _res, next) {
  try {
    const instructorId = req.trial_instructor_id || effectiveInstructorId(req);
    const trial = req.trial;
    if (!trial || !instructorId) throw httpError('TRIAL_REQUIRED', 400, 'TRIAL_REQUIRED');

    const todayYmd = await bakuTodayYmdDb(db);
    const { rows } = await db.query(
      `SELECT used_students
       FROM trial_daily_usage
       WHERE user_id = $1 AND ymd = $2
       LIMIT 1`,
      [instructorId, todayYmd]
    );
    const usedToday = Number(rows[0]?.used_students || 0) || 0;
    if (usedToday >= Number(trial.daily_student_limit || 0)) {
      throw httpError('TRIAL_DAILY_LIMIT_REACHED', 403, 'TRIAL_DAILY_LIMIT_REACHED');
    }
    req.trial_today_ymd = todayYmd;
    req.trial_used_today = usedToday;
    next();
  } catch (e) {
    next(e);
  }
}

async function consumeTrialStudentSlotTx(client, instructorId, todayYmd) {
  // Bump total + daily in a single transaction (caller ensures it only runs on success).
  await client.query(
    `UPDATE trials
     SET used_students = used_students + 1,
         updated_at = NOW()
     WHERE user_id = $1`,
    [instructorId]
  );
  await client.query(
    `INSERT INTO trial_daily_usage (user_id, ymd, used_students)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id, ymd)
     DO UPDATE SET used_students = trial_daily_usage.used_students + 1,
                   updated_at = NOW()`,
    [instructorId, todayYmd]
  );
}

module.exports = {
  DEFAULT_TRIAL,
  effectiveInstructorId,
  requireInstructorPhoneVerified,
  checkTrialActive,
  checkStudentLimit,
  checkDailyStudentLimit,
  consumeTrialStudentSlotTx,
};

