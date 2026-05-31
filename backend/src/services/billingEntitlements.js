const db = require('../utils/db');
const { normalizePlanSlug } = require('../config/plans');
const { BASIC_TRIAL_DAYS } = require('../config/billingTrial');
const { isBasicTrialGranted, hasBasicTrialIpDenial } = require('./basicTrialIpService');
const getCurrentPlan = require('./billingGetCurrentPlan');
const { getActivePlansMap } = require('./subscriptionPlansService');
const {
  isHighestTierPlan,
  planRank,
  smsUsageLine,
  storageUsageLine,
  fetchPendingTopups,
  pickLimitCta,
} = require('./billingAlertHelpers');

const TZ = 'Asia/Baku';
/** Aşağı paketə keçid: cari abunəlik dövrü ən azı 30 gün aktiv olmalıdır */
const DOWNGRADE_MIN_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

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

  // Permanent free (BASIC): no subscription end date — limits come from subscription_plans only.
  const { rows: ins } = await dbConn.query(
    `INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end, updated_at)
     VALUES ($1, 'basic', 'active', NOW(), NULL, NOW())
     RETURNING user_id, plan, status`,
    [userId]
  );
  return ins[0] || { user_id: userId, plan: 'basic', status: 'active' };
}

async function ensureUsageRow(dbConn, userId) {
  const { rows } = await dbConn.query(
    `SELECT user_id, students_count, storage_used_mb, storage_used_bytes, sms_used_monthly, sms_period_ym,
            COALESCE(extra_sms_balance, 0) AS extra_sms_balance,
            COALESCE(extra_storage_bytes, 0) AS extra_storage_bytes
     FROM usage_counters
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  if (rows[0]) return rows[0];

  const ym = await currentYmBaku(dbConn);
  const { rows: ins } = await dbConn.query(
    `INSERT INTO usage_counters (user_id, students_count, storage_used_mb, storage_used_bytes, sms_used_monthly, sms_period_ym)
     VALUES ($1, 0, 0, 0, 0, $2)
     RETURNING user_id, students_count, storage_used_mb, storage_used_bytes, sms_used_monthly, sms_period_ym,
               COALESCE(extra_sms_balance, 0) AS extra_sms_balance,
               COALESCE(extra_storage_bytes, 0) AS extra_storage_bytes`,
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
     RETURNING user_id, students_count, storage_used_mb, storage_used_bytes, sms_used_monthly, sms_period_ym,
               COALESCE(extra_sms_balance, 0) AS extra_sms_balance,
               COALESCE(extra_storage_bytes, 0) AS extra_storage_bytes`,
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

function ceilDaysLeft(endsAt) {
  const endMs = new Date(endsAt).getTime();
  if (!Number.isFinite(endMs)) return 0;
  const diff = endMs - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function isWarnPercent(rem, lim, thresholdPct /*0-1*/) {
  if (lim == null) return false;
  const l = Number(lim);
  const r = Number(rem);
  if (!Number.isFinite(l) || !Number.isFinite(r) || l <= 0) return false;
  return r / l <= thresholdPct;
}

function storageWarn80(limits, used) {
  const limB = limits.storage_limit_bytes;
  if (limB == null || !Number.isFinite(Number(limB))) return false;
  const cap = Number(limB);
  const u = Number(used.storage_bytes ?? 0) || 0;
  if (cap <= 0) return false;
  return u / cap >= 0.8;
}

function buildStatus({
  phone_verified,
  is_active,
  limits,
  used,
  remainingObj,
}) {
  // Priority:
  // 1) subscription not active (billing) -> expired
  // 2) any hard usage cap reached -> blocked
  // 3) any ~80% usage warn -> warning
  // 4) otherwise -> active
  if (!is_active) return 'expired';

  const reachedStudents = limits.students != null && used.students >= limits.students;
  const reachedSms = limits.sms_monthly != null && used.sms_monthly >= limits.sms_monthly;
  const reachedStorageMb = limits.storage_mb != null && used.storage_mb >= limits.storage_mb;
  const reachedStorageBytes =
    limits.storage_limit_bytes != null &&
    Number(used.storage_bytes ?? 0) >= Number(limits.storage_limit_bytes);
  const reachedStorage = reachedStorageMb || reachedStorageBytes;
  if (reachedStudents || reachedStorage || reachedSms) return 'blocked';

  const warnStudents = isWarnPercent(remainingObj.students, limits.students, 0.2);
  const warnSms = isWarnPercent(remainingObj.sms_monthly, limits.sms_monthly, 0.2);
  const warnStorageMb = isWarnPercent(remainingObj.storage_mb, limits.storage_mb, 0.2);
  const warnStorage = warnStorageMb || storageWarn80(limits, used);
  if (warnStudents || warnSms || warnStorage) return 'warning';

  return 'active';
}

function fmtBytes(n) {
  const x = Number(n) || 0;
  if (x < 1024) return `${Math.round(x)} B`;
  if (x < 1024 * 1024) return `${Math.round(x / 102.4) / 10} KB`;
  return `${Math.round(x / (1024 * 102.4)) / 10} MB`;
}

function buildMessages(status, ctx) {
  const {
    phone_verified,
    limits,
    used,
    remainingObj,
    details,
    plan,
    plansMap,
    pendingTopup,
  } = ctx || {};

  const highest = isHighestTierPlan(plan, plansMap);
  const onlySms =
    details?.reachedSms && !details?.reachedStudents && !details?.reachedStorage;
  const onlyStorage =
    details?.reachedStorage && !details?.reachedStudents && !details?.reachedSms;

  if (pendingTopup?.hasPendingAny && (status === 'blocked' || status === 'warning')) {
    if (pendingTopup.hasPendingSms && onlySms) {
      return {
        banner:
          'Ödənişiniz admin təsdiqi gözləyir. Tezliklə SMS balansınız yenilənəcək.',
        cta: { label: 'Ödəniş tarixçəsi', action: 'OPEN_SETTINGS_PAYMENTS' },
        suppress_limit_bar: true,
        tone: 'pending',
      };
    }
    if (pendingTopup.hasPendingStorage && onlyStorage) {
      return {
        banner: 'Ödənişiniz admin təsdiqi gözləyir. Tezliklə yaddaş limitiniz artırılacaq.',
        cta: { label: 'Ödəniş tarixçəsi', action: 'OPEN_SETTINGS_PAYMENTS' },
        suppress_limit_bar: true,
        tone: 'pending',
      };
    }
    if (pendingTopup.hasPendingPlan) {
      const pendingTitle =
        plansMap?.[pendingTopup.pending_plan_slug || '']?.title ||
        String(pendingTopup.pending_plan_slug || 'paket').toUpperCase();
      return {
        banner: `Ödənişiniz admin təsdiqi gözləyir. Təsdiqlənəndən sonra ${pendingTitle} paketi və limitləri aktiv olacaq.`,
        cta: { label: 'Ödəniş tarixçəsi', action: 'OPEN_SETTINGS_PAYMENTS' },
        suppress_limit_bar: true,
        tone: 'pending',
      };
    }
  }

  if (status === 'warning') {
    const parts = [];
    if (limits.students != null && isWarnPercent(remainingObj.students, limits.students, 0.2)) {
      parts.push(`Tələbə limitinə yaxınlasırsınız (${used.students}/${limits.students})`);
    }
    const smsLine = smsUsageLine(used.sms_monthly, limits);
    if (smsLine && limits.sms_monthly != null && isWarnPercent(remainingObj.sms_monthly, limits.sms_monthly, 0.2)) {
      parts.push(smsLine.warnMessage);
    }
    const stLine = storageUsageLine(used, limits);
    if (stLine) {
      const cap = limits.storage_limit_bytes;
      const u = Number(used.storage_bytes ?? 0) || 0;
      const nearBytes = cap != null && Number(cap) > 0 && u / Number(cap) >= 0.8;
      const nearMb =
        limits.storage_mb != null && isWarnPercent(remainingObj.storage_mb, limits.storage_mb, 0.2);
      if (nearBytes || nearMb) parts.push(stLine.warnMessage);
    }
    const banner = parts.length ? parts.join(' ') : 'Limitlərə yaxınlasırsınız';
    const cta = pickLimitCta({
      plan,
      plansMap,
      reachedSms: Boolean(smsLine && smsLine.pct >= 80),
      reachedStorage: Boolean(stLine && stLine.pct >= 80),
      reachedStudents: false,
    });
    return { banner, cta };
  }
  if (status === 'grace') {
    return {
      banner: 'Ödəniş gecikib. Davam üçün paket vəziyyətini yeniləyin.',
      cta: { label: 'Paketlərə bax', action: 'OPEN_SETTINGS_PLANS' },
    };
  }
  if (status === 'blocked') {
    const onBasic = normalizePlanSlug(plan) === 'basic';
    if (onlySms && highest && !onBasic) {
      return {
        banner:
          'Aylıq SMS limitinizə çatdınız. İstifadəyə davam etmək üçün əlavə SMS paketi əldə edə bilərsiniz.',
        cta: { label: 'SMS Balansı Artır', action: 'OPEN_SMS_TOPUP' },
      };
    }
    if (onlyStorage && highest && !onBasic) {
      return {
        banner:
          'Yaddaş limitiniz dolub. Davam etmək üçün əlavə yaddaş paketi alın və ya köhnə faylları silin.',
        cta: { label: 'Yaddaş al', action: 'OPEN_STORAGE_TOPUP' },
      };
    }
    if (onBasic && (details?.reachedSms || details?.reachedStorage)) {
      return {
        banner:
          'SADƏ sınaq limitinə çatdınız. Əlavə SMS/yaddaş bu paketdə mövcud deyil — PRO və ya daha yüksək paket seçin.',
        cta: { label: 'Paketlərə bax', action: 'OPEN_SETTINGS_PLANS' },
      };
    }
    const reasons = [];
    if (details?.reachedStudents) reasons.push('tələbə limiti');
    if (details?.reachedStorage) reasons.push('yaddaş limiti');
    if (details?.reachedSms) reasons.push('SMS limiti');
    const detail = reasons.length ? ` (${reasons.join(', ')})` : '';
    return {
      banner: `Limitə çatdınız${detail}. Davam etmək üçün paket seçməlisiniz.`,
      cta: pickLimitCta({
        plan,
        plansMap,
        reachedSms: details?.reachedSms,
        reachedStorage: details?.reachedStorage,
        reachedStudents: details?.reachedStudents,
      }),
    };
  }
  if (status === 'expired') {
    const onBasic = normalizePlanSlug(plan) === 'basic';
    const ipDenied = Boolean(ctx?.basic_trial_ip_denied);
    return {
      banner: onBasic
        ? ipDenied
          ? 'Bu cihazdan artıq pulsuz SADƏ sınaq istifadə olunub. Davam etmək üçün PRO və ya daha yüksək paket seçin.'
          : '14 günlük SADƏ sınaq müddəti bitib. Davam etmək üçün PRO və ya daha yüksək paket seçin.'
        : 'Abunəlik aktiv deyil və ya ödəniş müddəti keçib. Davam etmək üçün paket seçin.',
      cta: { label: 'Paketlərə bax', action: 'OPEN_SETTINGS_PLANS' },
    };
  }
  return { banner: null, cta: null };
}

/** Son ödənilmiş paket abunəlikdən yüksəkdirsə — aktiv planı uyğunlaşdır (Premium ödənişi PRO-da qalmış hallar). */
async function reconcileSubscriptionPlanFromLastPaidPlan(dbConn, userId) {
  try {
    const { rows } = await dbConn.query(
      `SELECT plan FROM billing_payments
       WHERE user_id = $1::uuid
         AND status = 'paid'
         AND COALESCE(product_type, 'plan') = 'plan'
         AND plan IS NOT NULL
         AND TRIM(plan) <> ''
       ORDER BY COALESCE(paid_at, reviewed_at, created_at) DESC
       LIMIT 1`,
      [userId]
    );
    const paidPlan = rows[0]?.plan ? normalizePlanSlug(rows[0].plan) : null;
    if (!paidPlan || paidPlan === 'basic') return null;

    const sub = await getCurrentPlan(dbConn, userId);
    const cur = normalizePlanSlug(sub?.plan || 'basic');
    if (planRank(paidPlan) <= planRank(cur)) return null;

    await dbConn.query(
      `UPDATE subscriptions
       SET plan = $2,
           status = 'active',
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, paidPlan]
    );
    return paidPlan;
  } catch {
    return null;
  }
}

async function resolveEntitlements(userId) {
  const basics = await getUserBasics(db, userId);
  if (!basics || !basics.is_active) throw httpError('USER_NOT_FOUND', 404, 'USER_NOT_FOUND');
  if (basics.role !== 'instructor') throw httpError('FORBIDDEN', 403, 'FORBIDDEN');

  const phone_verified = Boolean(basics.phone_verified);

  const usage = await ensureSmsPeriodUpToDate(db, userId);
  await ensureSubscriptionRow(db, userId);
  await reconcileSubscriptionPlanFromLastPaidPlan(db, userId);
  const sub2 = await getCurrentPlan(db, userId);
  // IMPORTANT:
  // Limits are plan-driven only (subscriptions + subscription_plans).
  // Legacy instructor_profiles limits and trials are treated as deprecated for limits.

  const planSlug = normalizePlanSlug(sub2?.plan);
  const plansMap = await getActivePlansMap();
  const planLimits =
    plansMap[planSlug]?.limits ||
    plansMap.basic?.limits ||
    { students: 5, storage_mb: null, storage_limit_bytes: 5 * 1024 * 1024, sms_monthly: 5, ram_limit_mb: null };

  const extraSmsBalance = Number(usage?.extra_sms_balance || 0) || 0;
  const baseSmsLimit = planLimits.sms_monthly;
  const effectiveSmsLimit =
    baseSmsLimit == null ? null : Math.max(0, Number(baseSmsLimit) + extraSmsBalance);

  const extraStorageBytes = Number(usage?.extra_storage_bytes || 0) || 0;
  const baseStorageBytes =
    planLimits.storage_limit_bytes == null ? null : Number(planLimits.storage_limit_bytes);
  const effectiveStorageBytes =
    baseStorageBytes == null ? null : Math.max(0, baseStorageBytes + extraStorageBytes);

  const limits = {
    students: planLimits.students,
    storage_mb: planLimits.storage_mb,
    storage_limit_bytes: effectiveStorageBytes,
    storage_limit_bytes_plan: baseStorageBytes,
    extra_storage_bytes: extraStorageBytes,
    sms_monthly: effectiveSmsLimit,
    sms_monthly_plan: baseSmsLimit,
    extra_sms_balance: extraSmsBalance,
    ram_limit_mb: planLimits.ram_limit_mb ?? null,
  };

  const used = {
    students: Number(usage?.students_count || 0) || 0,
    storage_mb: Number(usage?.storage_used_mb || 0) || 0,
    storage_bytes: Number(usage?.storage_used_bytes ?? 0) || 0,
    sms_monthly: Number(usage?.sms_used_monthly || 0) || 0,
    extra_sms_balance: extraSmsBalance,
    extra_storage_bytes: extraStorageBytes,
  };

  const rem = {
    students: remaining(limits.students, used.students),
    storage_mb: remaining(limits.storage_mb, used.storage_mb),
    sms_monthly: remaining(limits.sms_monthly, used.sms_monthly),
    storage_bytes:
      limits.storage_limit_bytes == null
        ? null
        : remaining(limits.storage_limit_bytes, used.storage_bytes),
  };

  const subStatus = String(sub2?.status || 'active');
  const periodEndMs = sub2?.current_period_end ? new Date(sub2.current_period_end).getTime() : null;
  const nowMs = Date.now();
  const graceUntilMs = sub2?.grace_until ? new Date(sub2.grace_until).getTime() : null;
  const inGrace =
    subStatus === 'past_due' &&
    (graceUntilMs == null ? false : nowMs <= graceUntilMs);

  const subscription_active =
    subStatus === 'active' &&
    (!periodEndMs || periodEndMs >= nowMs);

  // Grace period: do not block actions, but show a "grace" state.
  const is_active = subscription_active || inGrace;
  const status = buildStatus({
    phone_verified,
    is_active,
    limits,
    used,
    remainingObj: rem,
  });

  const status2 = inGrace ? 'grace' : status;
  const reachedStudents = limits.students != null && used.students >= limits.students;
  const reachedStorageMb = limits.storage_mb != null && used.storage_mb >= limits.storage_mb;
  const reachedStorageBytes =
    limits.storage_limit_bytes != null && used.storage_bytes >= Number(limits.storage_limit_bytes);
  const reachedStorage = reachedStorageMb || reachedStorageBytes;
  const reachedSms = limits.sms_monthly != null && used.sms_monthly >= limits.sms_monthly;

  const should_warn = status === 'warning';
  const should_block = (status2 === 'blocked' || status2 === 'expired'); // grace is NOT blocking
  const days_left = sub2?.current_period_end ? ceilDaysLeft(sub2.current_period_end) : null;
  const pendingTopup = await fetchPendingTopups(db, userId);
  const periodMeta = downgradePeriodMeta(sub2?.current_period_start);
  const basic_trial_ip_denied = planSlug === 'basic' ? await hasBasicTrialIpDenial(db, userId) : false;
  const messages = buildMessages(status2, {
    phone_verified,
    limits,
    used,
    remainingObj: rem,
    details: { reachedStudents, reachedStorage, reachedSms },
    plan: planSlug,
    plansMap,
    pendingTopup,
    basic_trial_ip_denied,
  });

  const can_buy_addons = planSlug !== 'basic' && subscription_active;
  const can_renew_basic = false;

  return {
    plan: planSlug,
    can_buy_addons,
    can_renew_basic,
    basic_trial_ip_denied,
    is_highest_tier: isHighestTierPlan(planSlug, plansMap),
    pending_topup: pendingTopup,
    pending_plan_slug: pendingTopup?.pending_plan_slug || null,
    subscription: {
      status: subStatus,
      current_period_start: sub2?.current_period_start
        ? new Date(sub2.current_period_start).toISOString()
        : null,
      current_period_end: sub2?.current_period_end ? new Date(sub2.current_period_end).toISOString() : null,
      grace_until: sub2?.grace_until ? new Date(sub2.grace_until).toISOString() : null,
      days_left,
      pending_plan: sub2?.pending_plan || null,
      downgrade_period_met: periodMeta.period_met,
      days_until_downgrade: periodMeta.days_until_downgrade,
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

function downgradePeriodMeta(periodStart) {
  if (!periodStart) {
    return { period_met: false, days_until_downgrade: null };
  }
  const startMs = new Date(periodStart).getTime();
  if (!Number.isFinite(startMs)) {
    return { period_met: false, days_until_downgrade: null };
  }
  const elapsed = Date.now() - startMs;
  if (elapsed >= DOWNGRADE_MIN_PERIOD_MS) {
    return { period_met: true, days_until_downgrade: 0 };
  }
  const days = Math.ceil((DOWNGRADE_MIN_PERIOD_MS - elapsed) / 86400000);
  return { period_met: false, days_until_downgrade: days };
}

/**
 * Aşağı paketə keçid: 1 ay tamam + tələbə/SMS/yaddaş hədəf paketə uyğun.
 */
async function assertDowngradeAllowed(dbConn, userId, targetPlanSlug) {
  const target = normalizePlanSlug(targetPlanSlug);
  const cur = await getCurrentPlan(dbConn, userId);
  const from = normalizePlanSlug(cur?.plan || 'basic');
  if (planRank(target) >= planRank(from)) return;

  const { rows } = await dbConn.query(
    `SELECT current_period_start FROM subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  const meta = downgradePeriodMeta(rows[0]?.current_period_start);
  if (!meta.period_met) {
    const days = meta.days_until_downgrade;
    const hint =
      days != null && days > 0
        ? ` Təxminən ${days} gün sonra yenidən yoxlayın.`
        : '';
    throw httpError(
      'PLAN_DOWNGRADE_PERIOD',
      400,
      `Cari paket dövrü tam deyil (ən azı 1 ay).${hint}`
    );
  }
  await assertPlanFitsUsage(dbConn, userId, target);
}

/**
 * Paketə keçid / endirmə: cari istifadə hədəf paket limitlərini aşırsa blokla.
 */
async function assertPlanFitsUsage(dbConn, userId, targetPlanSlug) {
  const slug = normalizePlanSlug(targetPlanSlug);
  const usage = await ensureSmsPeriodUpToDate(dbConn, userId);
  const plansMap = await getActivePlansMap();
  const lim =
    plansMap[slug]?.limits ||
    plansMap.basic?.limits ||
    { students: 5, storage_limit_bytes: 512 * 1024, sms_monthly: 5 };

  const students = Number(usage?.students_count || 0) || 0;
  if (lim.students != null && students > Number(lim.students)) {
    throw httpError(
      'PLAN_USAGE_EXCEEDS',
      400,
      'Sizin tələbə sayınız bu paketin limitini aşır'
    );
  }

  const storageBytes = Number(usage?.storage_used_bytes ?? 0) || 0;
  if (lim.storage_limit_bytes != null && storageBytes > Number(lim.storage_limit_bytes)) {
    throw httpError(
      'PLAN_USAGE_EXCEEDS',
      400,
      'Cari yaddaş istifadəniz bu paketin limitindən çoxdur'
    );
  }

  const storageMb = Number(usage?.storage_used_mb || 0) || 0;
  if (lim.storage_mb != null && lim.storage_limit_bytes == null && storageMb > Number(lim.storage_mb)) {
    throw httpError(
      'PLAN_USAGE_EXCEEDS',
      400,
      'Cari yaddaş istifadəniz bu paketin limitindən çoxdur'
    );
  }

  const smsUsed = Number(usage?.sms_used_monthly || 0) || 0;
  if (lim.sms_monthly != null && smsUsed > Number(lim.sms_monthly)) {
    throw httpError(
      'PLAN_USAGE_EXCEEDS',
      400,
      'Bu ay göndərilmiş SMS sayınız hədəf paketin limitindən çoxdur'
    );
  }
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
  assertPlanFitsUsage,
  assertDowngradeAllowed,
  bumpUsageCountersTx,
  logBillingEvent,
};

