const db = require('../utils/db');
const { PLANS, TRIAL_LIMITS, normalizePlanSlug } = require('../config/plans');
const getCurrentPlan = require('./billingGetCurrentPlan');

const TZ = 'Asia/Baku';

function httpError(code, status = 403, message = code) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  err.statusCode = status;
  return err;
}

async function logBillingEvent(dbConn, { user_id, event, context }) {
  try {
    await dbConn.query(
      `INSERT INTO billing_events (user_id, event, context)
       VALUES ($1, $2, $3::jsonb)`,
      [user_id || null, String(event || '').slice(0, 120), context ? JSON.stringify(context) : null]
    );
  } catch {
    // ignore (backward compatible / migrations not applied yet)
  }
}

async function currentYmBaku(dbConn) {
  const { rows } = await dbConn.query(
    `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE '${TZ}'), 'YYYY-MM') AS ym`
  );
  return rows[0]?.ym || new Date().toISOString().slice(0, 7);
}

async function getUserBasics(dbConn, userId) {
  const { rows } = await dbConn.query(
    `SELECT id, role, is_active, phone_verified
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function ensureSubscriptionRow(dbConn, userId) {
  const { rows } = await dbConn.query(
    `SELECT user_id, plan, status
     FROM subscriptions
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  if (rows[0]) return rows[0];

  const { rows: ins } = await dbConn.query(
    `INSERT INTO subscriptions (user_id, plan, status)
     VALUES ($1, 'basic', 'active')
     RETURNING user_id, plan, status`,
    [userId]
  );
  return ins[0] || { user_id: userId, plan: 'basic', status: 'active' };
}

async function ensureUsageRow(dbConn, userId) {
  const { rows } = await dbConn.query(
    `SELECT user_id, students_count, storage_used_mb, sms_used_monthly, sms_period_ym
     FROM usage_counters
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  if (rows[0]) return rows[0];

  const ym = await currentYmBaku(dbConn);
  const { rows: ins } = await dbConn.query(
    `INSERT INTO usage_counters (user_id, students_count, storage_used_mb, sms_used_monthly, sms_period_ym)
     VALUES ($1, 0, 0, 0, $2)
     RETURNING user_id, students_count, storage_used_mb, sms_used_monthly, sms_period_ym`,
    [userId, ym]
  );
  return ins[0];
}

async function ensureSmsPeriodUpToDate(dbConn, userId) {
  const usage = await ensureUsageRow(dbConn, userId);
  const ym = await currentYmBaku(dbConn);
  if (String(usage.sms_period_ym || '') === String(ym)) return usage;

  const { rows } = await dbConn.query(
    `UPDATE usage_counters
     SET sms_used_monthly = 0,
         sms_period_ym = $2,
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING user_id, students_count, storage_used_mb, sms_used_monthly, sms_period_ym`,
    [userId, ym]
  );
  return rows[0] || usage;
}

function remaining(limit, used) {
  // Unlimited = null
  if (limit == null) return null;
  const l = Number(limit);
  const u = Number(used) || 0;
  if (!Number.isFinite(l)) return null;
  return Math.max(0, l - u);
}

async function getTrialRow(dbConn, userId) {
  const { rows } = await dbConn.query(
    `SELECT user_id, start_date, end_date, is_active,
            max_students, storage_limit_mb, sms_limit_monthly
     FROM trials
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

function isTrialActive(trial) {
  if (!trial) return false;
  if (!trial.is_active) return false;
  const endMs = new Date(trial.end_date).getTime();
  if (!Number.isFinite(endMs)) return false;
  return Date.now() <= endMs;
}

function ceilDaysLeft(endsAt) {
  const endMs = new Date(endsAt).getTime();
  if (!Number.isFinite(endMs)) return 0;
  const diff = endMs - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function isWarnStudents(remStudents) {
  return remStudents != null && remStudents <= 3;
}

function isWarnPercent(rem, lim, thresholdPct /*0-1*/) {
  if (lim == null) return false;
  const l = Number(lim);
  const r = Number(rem);
  if (!Number.isFinite(l) || !Number.isFinite(r) || l <= 0) return false;
  return r / l <= thresholdPct;
}

function buildStatus({
  phone_verified,
  is_active,
  limits,
  used,
  remainingObj,
}) {
  // Priority:
  // 1) phone not verified -> warning (dashboard open; write-actions gate elsewhere)
  // 2) not active (trial expired/inactive) -> expired
  // 3) any reached limit -> blocked
  // 4) any warn threshold -> warning
  // 5) otherwise -> active
  if (!phone_verified) return 'warning';
  if (!is_active) return 'expired';

  const reachedStudents = limits.students != null && used.students >= limits.students;
  const reachedStorage = limits.storage_mb != null && used.storage_mb >= limits.storage_mb;
  const reachedSms = limits.sms_monthly != null && used.sms_monthly >= limits.sms_monthly;
  if (reachedStudents || reachedStorage || reachedSms) return 'blocked';

  const warnStudents = isWarnStudents(remainingObj.students);
  const warnSms = isWarnPercent(remainingObj.sms_monthly, limits.sms_monthly, 0.2);
  const warnStorage = isWarnPercent(remainingObj.storage_mb, limits.storage_mb, 0.2);
  if (warnStudents || warnSms || warnStorage) return 'warning';

  return 'active';
}

function buildMessages(status, remStudents, phone_verified) {
  if (status === 'warning' && !phone_verified) {
    return {
      banner: 'Hesabınızın tam funksionallığı üçün telefon nömrənizi təsdiqləyin',
      cta: { label: 'Telefonu təsdiqlə', action: 'OPEN_VERIFY_PHONE' },
    };
  }
  if (status === 'warning') {
    const banner =
      remStudents === 1 ? 'You have 1 student slot left' : `You have ${remStudents ?? 0} student slots left`;
    return { banner, cta: { label: 'Upgrade to PRO', action: 'OPEN_UPGRADE_MODAL' } };
  }
  if (status === 'blocked') {
    return { banner: 'Usage blocked', cta: { label: 'Upgrade to PRO', action: 'OPEN_UPGRADE_MODAL' } };
  }
  if (status === 'expired') {
    return { banner: 'Trial expired', cta: { label: 'Upgrade to PRO', action: 'OPEN_UPGRADE_MODAL' } };
  }
  return { banner: null, cta: null };
}

async function resolveEntitlements(userId) {
  const basics = await getUserBasics(db, userId);
  if (!basics || !basics.is_active) throw httpError('USER_NOT_FOUND', 404, 'USER_NOT_FOUND');
  if (basics.role !== 'instructor') throw httpError('FORBIDDEN', 403, 'FORBIDDEN');

  const phone_verified = Boolean(basics.phone_verified);

  const usage = await ensureSmsPeriodUpToDate(db, userId);
  const sub = await ensureSubscriptionRow(db, userId);
  const sub2 = await getCurrentPlan(db, userId);
  const trial = await getTrialRow(db, userId);

  const trial_active = phone_verified && isTrialActive(trial);

  const planSlug = normalizePlanSlug(sub?.plan);
  const planLimits = PLANS[planSlug] || PLANS.basic;

  const limits = trial_active
    ? {
        students: Number(trial?.max_students || TRIAL_LIMITS.students),
        storage_mb: Number(trial?.storage_limit_mb || TRIAL_LIMITS.storage_mb),
        sms_monthly: Number(trial?.sms_limit_monthly || TRIAL_LIMITS.sms_monthly),
      }
    : {
        students: planLimits.students,
        storage_mb: planLimits.storage_mb,
        sms_monthly: planLimits.sms_monthly,
      };

  const used = {
    students: Number(usage?.students_count || 0) || 0,
    storage_mb: Number(usage?.storage_used_mb || 0) || 0,
    sms_monthly: Number(usage?.sms_used_monthly || 0) || 0,
  };

  const rem = {
    students: remaining(limits.students, used.students),
    storage_mb: remaining(limits.storage_mb, used.storage_mb),
    sms_monthly: remaining(limits.sms_monthly, used.sms_monthly),
  };

  const subStatus = String(sub2?.status || 'active');
  const periodEndMs = sub2?.current_period_end ? new Date(sub2.current_period_end).getTime() : null;
  const nowMs = Date.now();
  const graceUntilMs = sub2?.grace_until ? new Date(sub2.grace_until).getTime() : null;
  const inGrace =
    !trial_active &&
    subStatus === 'past_due' &&
    (graceUntilMs == null ? false : nowMs <= graceUntilMs);

  const subscription_active =
    subStatus === 'active' &&
    (!periodEndMs || periodEndMs >= nowMs);

  // Grace period: do not block actions, but show a "grace" state.
  const is_active = trial_active ? true : subscription_active || inGrace;
  const status = buildStatus({
    phone_verified,
    is_active,
    limits,
    used,
    remainingObj: rem,
  });

  const status2 = inGrace ? 'grace' : status;
  const should_warn = status === 'warning';
  const should_block = (status2 === 'blocked' || status2 === 'expired'); // grace is NOT blocking
  const messages = buildMessages(status, rem.students, phone_verified);

  return {
    plan: planSlug,
    trial: {
      is_active: trial_active,
      ends_at: trial_active ? new Date(trial.end_date).toISOString() : null,
      days_left: trial_active ? ceilDaysLeft(trial.end_date) : 0,
    },
    subscription: {
      status: subStatus,
      current_period_end: sub2?.current_period_end ? new Date(sub2.current_period_end).toISOString() : null,
      grace_until: sub2?.grace_until ? new Date(sub2.grace_until).toISOString() : null,
    },
    limits,
    usage: used,
    remaining: rem,
    status: status2,
    should_warn: status2 === 'warning' || status2 === 'grace',
    should_block,
    messages,
    requirements: { phone_verified },
    timezone: TZ,
  };
}

async function bumpUsageCountersTx(client, userId, patch) {
  const fields = [];
  const values = [userId];
  let idx = 2;
  for (const [k, v] of Object.entries(patch || {})) {
    fields.push(`${k} = ${k} + $${idx}`);
    values.push(Number(v) || 0);
    idx += 1;
  }
  if (!fields.length) return;
  await client.query(
    `INSERT INTO usage_counters (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await client.query(
    `UPDATE usage_counters SET ${fields.join(', ')}, updated_at = NOW() WHERE user_id = $1`,
    values
  );
}

module.exports = {
  TZ,
  resolveEntitlements,
  getCurrentPlan,
  ensureSmsPeriodUpToDate,
  bumpUsageCountersTx,
  logBillingEvent,
};

