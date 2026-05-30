const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { sign, signOTP } = require('../utils/jwt');
const { OAuth2Client } = require('google-auth-library');
const { sendSms, sendOtpSms } = require('../services/smsService');
const { checkSmsQuota } = require('../services/smsQuotaService');
const {
  issueEmailVerification,
  clearVerificationFields,
  findUserForVerification,
  isVerificationExpired,
} = require('../services/emailVerificationIssue');
const { resolveLoginUserOrError, resolveSmsBillingInstructorId: resolveSmsBillingForLogin } = require('../services/authService');
const { guardEmailVerifiedBeforeToken } = require('../services/emailVerificationGuard');
const { getActiveRoles, grantUserRole, grantCourseRoleToUser } = require('../services/userRolesService');

const PHONE_NORM = "regexp_replace(COALESCE(phone::text, ''), '[^0-9]', '', 'g')";
const LOGIN_ROLES = new Set(['instructor', 'student', 'parent', 'course']);

const SIGNUP_ROLES = new Set(['instructor', 'course']);
const ONBOARDING_ROLES = new Set(['instructor', 'student', 'course']);

function normalizeEmailInput(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

async function logRisk(userId, req, context, riskScore = 10) {
  try {
    await db.query(
      `INSERT INTO risk_logs (user_id, ip, device_id, risk_score, context)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        userId || null,
        String(req?.headers?.['x-forwarded-for'] || req?.ip || ''),
        String(req?.headers?.['x-device-id'] || ''),
        Number(riskScore) || 0,
        JSON.stringify(context || {}),
      ]
    );
  } catch {
    // ignore
  }
}

async function attachInstructorPublicLabel(userLite) {
  if (!userLite || userLite.role !== 'instructor') return userLite;
  const { rows } = await db.query(
    `SELECT COALESCE(NULLIF(TRIM(public_label), ''), 'instructor') AS public_label
     FROM instructor_profiles WHERE user_id = $1`,
    [userLite.id]
  );
  const raw = String(rows[0]?.public_label || 'instructor').toLowerCase();
  const public_label = raw === 'trainer' ? 'trainer' : 'instructor';
  return { ...userLite, public_label };
}

async function attachCourseProfile(userLite) {
  if (!userLite || userLite.role !== 'course') return userLite;
  const { rows } = await db.query(
    `SELECT course_name, logo_url, branch_address
     FROM course_profiles WHERE user_id = $1`,
    [userLite.id]
  );
  const p = rows[0] || {};
  return {
    ...userLite,
    course_name: p.course_name || null,
    course_logo_url: p.logo_url || null,
    course_branch_address: p.branch_address || null,
  };
}

async function enrichUserForClient(userLite, sessionRole = null) {
  if (!userLite) return userLite;
  const roles = await getActiveRoles(userLite.id);
  const legacyRoles =
    roles.length > 0
      ? roles
      : userLite.role && LOGIN_ROLES.has(userLite.role)
        ? [userLite.role]
        : [];
  const role = sessionRole || userLite.role;
  let out = { ...userLite, role, roles: legacyRoles };
  if (role === 'instructor') out = await attachInstructorPublicLabel(out);
  if (role === 'course') out = await attachCourseProfile(out);
  return out;
}

async function userNeedsRoleSelection(userId, fallbackRole = null) {
  try {
    const { rows } = await db.query('SELECT role_selected FROM users WHERE id = $1 LIMIT 1', [userId]);
    if (rows[0]?.role_selected === false) return true;
  } catch {
    // ignore
  }
  const roles = await getActiveRoles(userId);
  if (roles.length > 0) return false;
  const raw = String(fallbackRole || '').trim().toLowerCase();
  if (raw && LOGIN_ROLES.has(raw)) return false;
  return true;
}

async function loadUserLiteById(userId) {
  const { rows } = await db.query(
    'SELECT id, full_name, email, phone, role, phone_verified, is_active, is_verified, role_selected FROM users WHERE id = $1 LIMIT 1',
    [userId],
  );
  return rows[0] || null;
}

function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

function canonicalPhone(phone) {
  const clean = normalizePhone(phone);
  if (!clean) return null;
  // project convention: keep +994... for display + consistent uniqueness
  if (clean.startsWith('994')) return `+${clean}`;
  // fallback: still return digits (better than random formatting)
  return clean;
}

function canonicalStudentEmail(email) {
  const raw = String(email || '').trim().toLowerCase();
  if (!raw) return null;
  // basic sanity guard (DB unique index is lower(trim(email)))
  if (raw.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;
  return raw;
}

async function assertGoogleSubFreeForOtherUser(googleSub, keepUserId) {
  const sub = String(googleSub || '').trim();
  if (!sub) return;
  const { rows } = await db.query(
    `SELECT id FROM users
     WHERE is_active = TRUE
       AND google_sub = $1
       AND id <> $2
     LIMIT 1`,
    [sub, keepUserId]
  );
  if (rows[0]?.id) {
    const err = new Error('Bu Google hesabı artıq başqa istifadəçiyə bağlıdır');
    err.statusCode = 409;
    throw err;
  }
}

function hasStoredPin(pinHash) {
  return pinHash != null && String(pinHash).trim().length > 0;
}

const PHONE_VERIFY_ROLES = new Set(['instructor', 'student', 'course']);

function phoneLinkRolesCompatible(sessionRole, ownerRole) {
  if (sessionRole === ownerRole) return true;
  if (
    (sessionRole === 'instructor' && ownerRole === 'course') ||
    (sessionRole === 'course' && ownerRole === 'instructor')
  ) {
    return true;
  }
  return false;
}

function buildAuthUserPayload(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    role: user.role,
    email: user.email,
    phone: user.phone,
    phone_verified: Boolean(user.phone_verified),
  };
}

function generateLoginPin() {
  let p = '';
  for (let i = 0; i < 6; i++) p += String(Math.floor(Math.random() * 10));
  if (/^0+$/.test(p)) return generateLoginPin();
  return p;
}

async function assertSmsOk(billingId) {
  const quota = await checkSmsQuota(billingId, { requireProfile: false });
  if (!quota.ok) {
    const err = new Error('SMS_LIMIT');
    err.statusCode = quota.statusCode;
    err.body = quota.body;
    throw err;
  }
}

/**
 * Daimi giriş PIN-i: düz mətn SMS (bir dəfə), DB-də bcrypt hash.
 * @param {{ force?: boolean }} opts force=true → köhnə PIN əvəzlənir (unutdum)
 */
async function deliverPermanentPinSms(user, cleanPhone, opts = {}) {
  const force = opts.force === true;
  const loginRole = opts.loginRole || null;
  const billingId = await resolveSmsBillingForLogin(user, loginRole);
  await assertSmsOk(billingId);

  if (!force && hasStoredPin(user.pin_hash)) {
    return { alreadyHadPin: true };
  }

  const plain = generateLoginPin();
  const hash = await bcrypt.hash(plain, 12);

  if (!force) {
    const { rowCount } = await db.query(
      `UPDATE users SET pin_hash = $1 WHERE id = $2
       AND (pin_hash IS NULL OR TRIM(COALESCE(pin_hash::text, '')) = '')`,
      [hash, user.id]
    );
    if (rowCount === 0) {
      const u2 = await findUserByPhoneAndRole(cleanPhone, user.role);
      if (u2 && hasStoredPin(u2.pin_hash)) return { alreadyHadPin: true };
      const err = new Error('PIN_RETRY');
      err.statusCode = 409;
      err.body = { success: false, message: '"Davam et" ilə bir daha cəhd edin.' };
      throw err;
    }
  } else {
    await db.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [hash, user.id]);
  }

  const message = `Mentorix: Sizin daimi Mentorix giriş PIN-iniz: ${plain}. Növbəti girişlərdə yalnız bu 6 rəqəmi daxil edin (OTP yox). Kodu heç kəsə deməyin.`;
  const smsRes = await sendSms({
    instructorId: billingId || null,
    phone: cleanPhone,
    message,
  });

  if (!smsRes.success) {
    await db.query('UPDATE users SET pin_hash = NULL WHERE id = $1', [user.id]).catch(() => {});
    const err = new Error('SMS_FAIL');
    err.statusCode = 502;
    err.body = {
      success: false,
      message: smsRes.error || 'SMS göndərilə bilmədi. Bir az sonra yenidən cəhd edin.',
    };
    throw err;
  }

  await db.query('UPDATE users SET phone_verified = TRUE WHERE id = $1', [user.id]);
  return {
    pinSmsSent: true,
    sms: {
      httpStatus: smsRes.httpStatus,
      status: smsRes.status,
      logStatus: smsRes.logStatus,
      msisdn: smsRes.msisdn,
      result: smsRes.result,
    },
  };
}

async function findUserByPhoneAndRole(cleanPhone, role) {
  const { rows } = await db.query(
    `SELECT * FROM users WHERE ${PHONE_NORM} = $1 AND is_active = TRUE AND role = $2`,
    [cleanPhone, role],
  );
  return rows[0] || null;
}

async function resolveSmsBillingInstructorId(user) {
  if (user.role === 'instructor') return user.id;
  if (user.role === 'student') {
    const { rows } = await db.query(
      `SELECT e.instructor_id FROM enrollments e
       WHERE e.student_id = $1 AND e.status = 'active'
       ORDER BY e.enrolled_at DESC NULLS LAST
       LIMIT 1`,
      [user.id],
    );
    return rows[0]?.instructor_id || null;
  }
  if (user.role === 'parent') {
    const { rows } = await db.query(
      `SELECT e.instructor_id FROM enrollments e
       INNER JOIN student_profiles sp ON sp.user_id = e.student_id
       WHERE sp.parent_id = $1 AND e.status = 'active'
       ORDER BY e.enrolled_at DESC NULLS LAST
       LIMIT 1`,
      [user.id],
    );
    return rows[0]?.instructor_id || null;
  }
  return null;
}

/**
 * PIN yoxdursa: bir dəfə 6 rəqəm yaradılır, SMS göndərilir, hash saxlanılır.
 * PIN varsa: birbaşa PIN ekranı (SMS yox).
 */
const phoneNextStep = async (req, res) => {
  try {
    const { phone, role } = req.body;
    const clean = normalizePhone(phone);
    if (!clean) return res.status(400).json({ success: false, message: 'Telefon nömrəsi tələb olunur' });
    if (!role || !LOGIN_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: 'Rol seçin: müəllim, tələbə və ya kurs' });
    }
    const resolved = await resolveLoginUserOrError(clean, role);
    if (resolved.status) {
      return res.status(resolved.status).json(resolved.body);
    }
    const user = resolved.user;
    const loginRole = resolved.loginRole || role;

    if (!guardEmailVerifiedBeforeToken(res, user)) return;

    if (!hasStoredPin(user.pin_hash)) {
      try {
        const r = await deliverPermanentPinSms(user, clean, { force: false, loginRole });
        if (r.alreadyHadPin) {
          return res.json({
            success: true,
            next: 'pin',
            message: 'PIN kodunuzu daxil edin.',
            available_roles: resolved.availableRoles || [],
          });
        }
        return res.json({
          success: true,
          next: 'pin',
          pin_sms_sent: true,
          message:
            'Nömrənizə daimi 6 rəqəmli PIN SMS ilə göndərildi. Gələn kodu aşağıya daxil edin (OTP yox).',
          sms_debug: r?.sms || null,
          available_roles: resolved.availableRoles || [],
        });
      } catch (e) {
        if (e.statusCode && e.body) return res.status(e.statusCode).json(e.body);
        throw e;
      }
    }

    return res.json({
      success: true,
      next: 'pin',
      message: 'PIN kodunuzu daxil edin (əlavə SMS göndərilmir).',
      available_roles: resolved.availableRoles || [],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PIN unutdum: yeni daimi PIN bir SMS (OTP yox) */
const forgotPinSms = async (req, res) => {
  try {
    const { phone, role } = req.body;
    const clean = normalizePhone(phone);
    if (!clean) return res.status(400).json({ success: false, message: 'Telefon nömrəsi tələb olunur' });
    if (!role || !LOGIN_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: 'Rol seçilməlidir' });
    }
    const resolved = await resolveLoginUserOrError(clean, role);
    if (resolved.status) {
      return res.status(resolved.status).json(resolved.body);
    }
    const user = resolved.user;
    if (!guardEmailVerifiedBeforeToken(res, user)) return;
    try {
      const r = await deliverPermanentPinSms(user, clean, { force: true });
      return res.json({
        success: true,
        message: 'Yeni daimi PIN nömrənizə SMS ilə göndərildi. OTP tələb olunmur.',
        sms_debug: r?.sms || null,
      });
    } catch (e) {
      if (e.statusCode && e.body) return res.status(e.statusCode).json(e.body);
      throw e;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, phone, identifier, password } = req.body;
    const raw = identifier != null && String(identifier).trim() !== '' ? identifier : email != null ? email : phone;
    const s = raw != null ? String(raw).trim() : '';
    if (!s) return res.status(400).json({ success: false, message: 'Telefon və ya email tələb olunur' });
    const pass = password != null ? String(password) : '';
    if (!pass) return res.status(400).json({ success: false, message: 'Şifrə tələb olunur' });

    const clean = normalizePhone(s);
    const looksPhone = Boolean(clean) && clean.length >= 9;

    const { rows } = looksPhone
      ? await db.query(
          `SELECT *
           FROM users
           WHERE is_active = TRUE
             AND ${PHONE_NORM} = $1
           LIMIT 1`,
          [clean]
        )
      : await db.query('SELECT * FROM users WHERE is_active = TRUE AND lower(trim(email)) = lower(trim($1)) LIMIT 1', [s]);

    const user = rows[0];
    if (!user || !user.password_hash || !(await bcrypt.compare(pass, user.password_hash)))
      return res.status(401).json({ success: false, message: 'Giriş məlumatları yanlışdır' });
    if (user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Yalnız admin bu girişlə daxil ola bilər' });
    if (!guardEmailVerifiedBeforeToken(res, user)) return;
    const token = sign({ id: user.id, role: user.role });
    res.json({
      success: true,
      token,
      user: { id: user.id, full_name: user.full_name, role: user.role, email: user.email, phone: user.phone },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** OTP — yalnız rol uyğunluğu + SMS limiti (PIN girişində istifadə olunmur) */
const sendOtp = async (req, res) => {
  try {
    const { phone, role } = req.body;
    const clean = normalizePhone(phone);
    if (!clean) return res.status(400).json({ success: false, message: 'Telefon nömrəsi tələb olunur' });
    if (!role || !LOGIN_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: 'Giriş üçün rol seçilməlidir' });
    }
    const user = await findUserByPhoneAndRole(clean, role);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Bu nömrə seçilmiş rol üçün qeydiyyatda yoxdur' });
    }
    if (!guardEmailVerifiedBeforeToken(res, user)) return;

    const billingId = await resolveSmsBillingInstructorId(user);
    const quota = await checkSmsQuota(billingId, { requireProfile: false });
    if (!quota.ok) return res.status(quota.statusCode).json(quota.body);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);
    await db.query('DELETE FROM otp_codes WHERE phone = $1', [clean]);
    await db.query('INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)', [
      clean,
      code,
      expiresAt,
    ]);
    const sms = await sendOtpSms(clean, code);
    if (!sms?.success) {
      await db.query('DELETE FROM otp_codes WHERE phone = $1 AND code = $2', [clean, code]);
      return res.status(502).json({
        success: false,
        message: sms?.error || 'OTP SMS göndərilə bilmədi. SMS provayder cavabını yoxlayın və ya bir az sonra yenidən cəhd edin.',
      });
    }
    res.json({ success: true, message: 'OTP göndərildi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { phone, code, role, save_otp_as_pin, forgot_pin_reset } = req.body;
    const clean = normalizePhone(phone);
    const codeStr = String(code ?? '').trim();
    if (!clean || !codeStr) {
      return res.status(400).json({ success: false, message: 'Telefon və kod tələb olunur' });
    }
    if (!role || !LOGIN_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: 'Rol tələb olunur' });
    }

    const { rows } = await db.query(
      'SELECT * FROM otp_codes WHERE phone = $1 AND code = $2 AND is_used = FALSE AND expires_at > NOW()',
      [clean, codeStr],
    );
    if (!rows[0]) return res.status(400).json({ success: false, message: 'Kod yanlışdır və ya müddəti bitib' });
    await db.query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1', [rows[0].id]);

    const user = await findUserByPhoneAndRole(clean, role);
    if (!user) return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    if (!guardEmailVerifiedBeforeToken(res, user)) return;

    await db.query('UPDATE users SET phone_verified = TRUE WHERE id = $1', [user.id]);

    const isForgotReset =
      forgot_pin_reset === true || forgot_pin_reset === 'true' || forgot_pin_reset === 1;
    if (isForgotReset) {
      await db.query('UPDATE users SET pin_hash = NULL WHERE id = $1', [user.id]);
    }

    const { rows: fresh } = await db.query('SELECT pin_hash FROM users WHERE id = $1', [user.id]);
    let hasPin = hasStoredPin(fresh[0]?.pin_hash);

    const declineOtpAsPin =
      save_otp_as_pin === false || save_otp_as_pin === 'false' || save_otp_as_pin === 0;
    const shouldSaveOtpAsPin =
      !hasPin && /^\d{6}$/.test(codeStr) && !declineOtpAsPin && !isForgotReset;

    if (shouldSaveOtpAsPin) {
      const hash = await bcrypt.hash(codeStr, 12);
      await db.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [hash, user.id]);
    }

    const { rows: afterPin } = await db.query('SELECT pin_hash FROM users WHERE id = $1', [user.id]);
    const pinReady = hasStoredPin(afterPin[0]?.pin_hash);

    const token = signOTP({ id: user.id, role: user.role });
    const baseUser = { id: user.id, full_name: user.full_name, role: user.role, phone: user.phone };
    const userOut = await enrichUserForClient(baseUser);
    res.json({
      success: true,
      token,
      user: userOut,
      needs_pin_setup: !pinReady,
      pin_was_reset: isForgotReset,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


const register = async (req, res) => {
  try {
    const { full_name, email, phone, password, role, subject, billing_type, parent_id } = req.body;
    const phoneCanon = canonicalPhone(phone);
    if (!phoneCanon) return res.status(400).json({ success: false, message: 'Telefon tələb olunur' });
    const hash = await bcrypt.hash(password || 'Pass@123', 12);
    const emailCanon = role === 'student' ? canonicalStudentEmail(email) : email?.toLowerCase() || null;
    if (role === 'student' && email && !emailCanon) {
      return res.status(400).json({ success: false, message: 'Email formatı düzgün deyil' });
    }

    const wantsEmailVerification = Boolean(emailCanon);
    let emailVerificationSent = false;
    let emailVerificationError = null;

    const user = await db.transaction(async (client) => {
      let created = null;

      const cleanPhone = normalizePhone(phoneCanon);

      // Instructor add-student flow should not create duplicate users for the same phone.
      if (role === 'student') {
        // 1) Email-first merge (Google unique identifier), if provided.
        if (emailCanon) {
          const { rows: activeByEmail } = await client.query(
            `SELECT id, full_name, email, role, phone, is_active, ${PHONE_NORM} AS phone_digits
             FROM users
             WHERE role = 'student'
               AND is_active = TRUE
               AND email IS NOT NULL
               AND LOWER(TRIM(email)) = LOWER(TRIM($1))
             LIMIT 1`,
            [emailCanon]
          );
          const byEmail = activeByEmail[0] || null;
          if (byEmail) {
            const otherPhoneSame = String(byEmail.phone_digits || '') === String(cleanPhone);
            if (!otherPhoneSame) {
              const { rows: phoneOwner } = await client.query(
                `SELECT id FROM users
                 WHERE role = 'student'
                   AND is_active = TRUE
                   AND ${PHONE_NORM} = $1
                   AND id <> $2
                 LIMIT 1`,
                [cleanPhone, byEmail.id]
              );
              if (phoneOwner[0]?.id) {
                const err = new Error(
                  'Bu telefon nömrəsi artıq başqa tələbə hesabına bağlıdır. Eyni tələbə üçün email və telefon uyğun olmalıdır.'
                );
                err.statusCode = 409;
                throw err;
              }
            }

            const { rows: up } = await client.query(
              `UPDATE users
               SET full_name = $2,
                   phone = $3,
                   password_hash = $4,
                   role = 'student',
                   is_active = TRUE,
                   phone_verified = FALSE,
                   account_status = CASE
                     WHEN google_sub IS NULL OR TRIM(COALESCE(google_sub::text, '')) = '' THEN 'pending_google'
                     ELSE 'active'
                   END
               WHERE id = $1
               RETURNING id, full_name, email, role, phone`,
              [byEmail.id, full_name, phoneCanon, hash]
            );
            created = up[0];
          }
        }

        // 2) Phone merge (PIN-first), if no email match.
        if (!created) {
          const { rows: activeByPhone } = await client.query(
            `SELECT id, full_name, email, role, phone, is_active
             FROM users
             WHERE role = 'student'
               AND is_active = TRUE
               AND ${PHONE_NORM} = $1
             LIMIT 1`,
            [cleanPhone]
          );
          if (activeByPhone[0]) {
            const { rows: up } = await client.query(
              `UPDATE users
               SET full_name = $2,
                   email = COALESCE($3, email),
                   phone = $4,
                   password_hash = $5,
                   role = 'student',
                   is_active = TRUE,
                   phone_verified = FALSE,
                   account_status = CASE
                     WHEN ($3::text IS NOT NULL AND TRIM($3::text) <> '' AND (google_sub IS NULL OR TRIM(COALESCE(google_sub::text, '')) = ''))
                       THEN 'pending_google'
                     ELSE account_status
                   END
               WHERE id = $1
               RETURNING id, full_name, email, role, phone`,
              [activeByPhone[0].id, full_name, emailCanon, phoneCanon, hash]
            );
            created = up[0];
          }
        }
      }

      if (!created) {
        try {
          const accountStatus =
            role === 'student' && emailCanon ? 'pending_google' : 'active';
          const { rows } = await client.query(
            `INSERT INTO users (full_name, email, phone, password_hash, role, account_status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, full_name, email, role, phone`,
            [full_name, emailCanon, phoneCanon, hash, role, accountStatus]
          );
          created = rows[0];
        } catch (e) {
          // If an old inactive student row still holds UNIQUE email/phone, revive it instead of failing.
          if (e?.code === '23505' && role === 'student') {
            const clean = normalizePhone(phoneCanon);
            const { rows: candidates } = await client.query(
              `SELECT id, full_name, email, role, phone, is_active
               FROM users
               WHERE role = 'student'
                 AND is_active = FALSE
                 AND (
                   (${PHONE_NORM} = $1)
                   OR ($2::text IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($2::text))))
               ORDER BY
                 CASE WHEN ($2::text IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($2::text))) THEN 0 ELSE 1 END,
                 created_at NULLS LAST
               LIMIT 5`,
              [clean, emailCanon]
            );

            const pick =
              candidates.find((r) => emailCanon && String(r.email || '').toLowerCase() === String(emailCanon).toLowerCase()) ||
              candidates.find((r) => normalizePhone(r.phone) === clean) ||
              candidates[0] ||
              null;

            if (!pick) throw e;

            // Free UNIQUE collisions caused by other inactive "ghost" rows still holding the same email/phone.
            await client.query(
              `UPDATE users
               SET email = NULL
               WHERE role = 'student'
                 AND is_active = FALSE
                 AND id <> $1
                 AND $2::text IS NOT NULL
                 AND LOWER(TRIM(email)) = LOWER(TRIM($2::text))`,
              [pick.id, emailCanon]
            );
            await client.query(
              `UPDATE users
               SET phone = NULL
               WHERE role = 'student'
                 AND is_active = FALSE
                 AND id <> $1
                 AND ${PHONE_NORM} = $2`,
              [pick.id, clean]
            );

            const { rows: up } = await client.query(
              `UPDATE users
               SET full_name = $2,
                   email = $3,
                   phone = $4,
                   password_hash = $5,
                   role = 'student',
                   is_active = TRUE,
                   phone_verified = FALSE,
                   account_status = CASE
                     WHEN ($3::text IS NOT NULL AND TRIM($3::text) <> '' AND (google_sub IS NULL OR TRIM(COALESCE(google_sub::text, '')) = ''))
                       THEN 'pending_google'
                     ELSE COALESCE(account_status, 'active')
                   END
               WHERE id = $1
               RETURNING id, full_name, email, role, phone`,
              [pick.id, full_name, emailCanon, phoneCanon, hash]
            );
            created = up[0];
          } else {
            throw e;
          }
        }
      }

      await client.query(
        `INSERT INTO user_roles (user_id, role, is_active) VALUES ($1, $2, TRUE)
         ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE`,
        [created.id, role],
      );

      if (role === 'instructor') {
        await client.query(
          'INSERT INTO instructor_profiles (user_id, subject, billing_type) VALUES ($1, $2, $3)',
          [created.id, subject || null, billing_type || '8_lessons'],
        );
        await client.query(
          `INSERT INTO user_roles (user_id, role, is_active) VALUES ($1, 'course', TRUE)
           ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE`,
          [created.id],
        );
        await client.query(
          `INSERT INTO course_profiles (user_id, course_name) VALUES ($1, $2)
           ON CONFLICT (user_id) DO NOTHING`,
          [created.id, full_name || 'Kurs'],
        );
      } else if (role === 'course') {
        await client.query(
          `INSERT INTO course_profiles (user_id, course_name) VALUES ($1, $2)
           ON CONFLICT (user_id) DO NOTHING`,
          [created.id, full_name || 'Kurs'],
        );
      } else if (role === 'student') {
        // Avoid requiring a UNIQUE constraint on student_profiles.user_id for older DBs.
        const up = await client.query('UPDATE student_profiles SET parent_id = $2 WHERE user_id = $1', [
          created.id,
          parent_id || null,
        ]);
        if (up.rowCount === 0) {
          await client.query('INSERT INTO student_profiles (user_id, parent_id) VALUES ($1, $2)', [
            created.id,
            parent_id || null,
          ]);
        }
      }

      return created;
    });

    if (wantsEmailVerification && user?.email) {
      const { mail } = await issueEmailVerification(user.id, user.email);
      if (!mail?.ok) {
        emailVerificationError = mail?.error || 'E-poçt təsdiqi göndərilə bilmədi';
      } else {
        emailVerificationSent = true;
      }
    }

    res.status(201).json({
      success: true,
      user,
      email_verification_sent: emailVerificationSent,
      email_verification_error: emailVerificationError,
    });
  } catch (err) {
    if (err.code === '23505') {
      const c = String(err.constraint || '');
      if (c.includes('users_email')) {
        return res.status(409).json({ success: false, message: 'Bu email artıq mövcuddur' });
      }
      return res.status(409).json({ success: false, message: 'Bu nömrə artıq mövcuddur' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};



/** Email verifikasiyası — link (token) və ya email + 6 rəqəmli kod */
const verifyEmail = async (req, res) => {
  try {
    const { token, email, code } = req.body || {};
    const hasToken = String(token || '').trim().length > 0;
    const hasCode = String(email || '').trim() && String(code || '').trim();

    if (!hasToken && !hasCode) {
      return res.status(400).json({
        success: false,
        message: 'Token və ya email + təsdiq kodu tələb olunur',
      });
    }

    const user = await findUserForVerification({ token, email, code });
    if (!user) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Yanlış və ya etibarsız təsdiq linki / kod',
      });
    }

    if (user.is_verified === true) {
      await clearVerificationFields(user.id).catch(() => {});
      return res.json({ success: true, code: 'ALREADY_VERIFIED', message: 'Bu hesab artıq təsdiqlənib' });
    }

    if (isVerificationExpired(user)) {
      return res.status(400).json({
        success: false,
        code: 'EXPIRED_TOKEN',
        message: 'Təsdiq linkinin və ya kodun müddəti bitib. Yenidən göndərin.',
      });
    }

    await clearVerificationFields(user.id);
    const u = await loadUserLiteById(user.id);
    const needsRole = await userNeedsRoleSelection(user.id, u?.role);
    const sessionRole = needsRole ? null : (u?.role || null);
    const sessionToken = sign({ id: user.id, role: sessionRole });
    const userOut = u ? await enrichUserForClient(u, sessionRole) : null;

    return res.json({
      success: true,
      message: 'Email təsdiqləndi',
      needs_role: needsRole,
      token: sessionToken,
      user:
        userOut
          ? { ...userOut, role: needsRole ? null : userOut.role }
          : { id: user.id, email: u?.email || null, role: sessionRole },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Email OTP verifikasiyasından sonra rol seçimi (müəllim / tələbə / kurs) */
const selectOnboardingRole = async (req, res) => {
  try {
    const picked = String(req.body?.role || '').trim().toLowerCase();
    if (!picked || !ONBOARDING_ROLES.has(picked)) {
      return res.status(400).json({ success: false, message: 'Rol seçin: müəllim, tələbə və ya kurs' });
    }

    const me = await loadUserLiteById(req.user.id);
    if (!me || me.is_active === false) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (!guardEmailVerifiedBeforeToken(res, me)) return;

    const needsRole = await userNeedsRoleSelection(me.id, me.role);
    const effectiveRole = needsRole ? picked : (me.role || (await getActiveRoles(me.id))[0] || picked);

    if (needsRole) {
      await db.transaction(async (client) => {
        await client.query(
          `UPDATE users
           SET role = $2,
               role_selected = TRUE
           WHERE id = $1`,
          [me.id, picked],
        );
        await grantUserRole(me.id, picked, client);

        if (picked === 'instructor') {
          await client.query(
            `INSERT INTO instructor_profiles (user_id, subject, billing_type)
             VALUES ($1, NULL, '8_lessons')
             ON CONFLICT (user_id) DO NOTHING`,
            [me.id],
          );
          // Instructor hesabı üçün kurs paneli də açıq olsun.
          await grantCourseRoleToUser(me.id, me.full_name || 'Kurs');
        } else if (picked === 'course') {
          await client.query(
            `INSERT INTO course_profiles (user_id, course_name)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO NOTHING`,
            [me.id, me.full_name || 'Kurs'],
          );
        } else if (picked === 'student') {
          const up = await client.query('UPDATE student_profiles SET updated_at = NOW() WHERE user_id = $1', [me.id]);
          if (up.rowCount === 0) {
            await client.query('INSERT INTO student_profiles (user_id) VALUES ($1)', [me.id]).catch(() => {});
          }
        }
      });
    }

    const fresh = await loadUserLiteById(me.id);
    const role = String(effectiveRole || fresh?.role || picked).trim().toLowerCase();
    const token = sign({ id: me.id, role });
    const userOut = await enrichUserForClient(fresh || me, role);
    return res.json({ success: true, token, user: userOut });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** İctimai qeydiyyat — müəllim / kurs (öz Gmail ilə) */
const signup = async (req, res) => {
  try {
    const { full_name, email, password, phone, role: roleRaw } = req.body || {};
    const role = String(roleRaw || '').trim().toLowerCase();
    const roleSelected = Boolean(role) && ONBOARDING_ROLES.has(role);
    const initialRole = roleSelected ? role : 'student';

    const emailCanon = normalizeEmailInput(email);
    if (!emailCanon) return res.status(400).json({ success: false, message: 'Düzgün email daxil edin' });

    const name = String(full_name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Ad soyad tələb olunur' });

    const pass = String(password || '');
    if (pass.length < 8) {
      return res.status(400).json({ success: false, message: 'Şifrə ən azı 8 simvol olmalıdır' });
    }

    const phoneCanon = phone ? canonicalPhone(phone) : null;
    const hash = await bcrypt.hash(pass, 12);

    const { rows: existing } = await db.query(
      `SELECT id FROM users WHERE lower(trim(email)) = $1 AND is_active = TRUE LIMIT 1`,
      [emailCanon],
    );
    if (existing[0]) {
      return res.status(409).json({ success: false, message: 'Bu email artıq qeydiyyatdadır' });
    }

    const user = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role, is_verified, account_status, role_selected)
         VALUES ($1, $2, $3, $4, $5, FALSE, 'active', $6)
         RETURNING id, full_name, email, role, phone, role_selected`,
        [name, emailCanon, phoneCanon, hash, initialRole, roleSelected],
      );
      const created = rows[0];

      if (roleSelected) {
        await client.query(
          `INSERT INTO user_roles (user_id, role, is_active) VALUES ($1, $2, TRUE)
           ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE`,
          [created.id, initialRole],
        );
      }

      if (initialRole === 'instructor') {
        await client.query(
          'INSERT INTO instructor_profiles (user_id, subject, billing_type) VALUES ($1, NULL, $2)',
          [created.id, '8_lessons'],
        );
        await client.query(
          `INSERT INTO user_roles (user_id, role, is_active) VALUES ($1, 'course', TRUE)
           ON CONFLICT (user_id, role) DO UPDATE SET is_active = TRUE`,
          [created.id],
        );
        await client.query(
          `INSERT INTO course_profiles (user_id, course_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
          [created.id, name],
        );
      } else if (initialRole === 'course') {
        await client.query(
          `INSERT INTO course_profiles (user_id, course_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
          [created.id, name],
        );
      } else if (initialRole === 'student') {
        // Ensure student profile exists (optional fields later)
        await client.query('INSERT INTO student_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [created.id]).catch(() => {});
      }

      return created;
    });

    const { mail } = await issueEmailVerification(user.id, emailCanon);
    if (!mail?.ok) {
      return res.status(500).json({
        success: false,
        message: mail?.error || 'Təsdiq emaili göndərilə bilmədi',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Qeydiyyat uğurludur. Email ünvanınıza təsdiq kodu və link göndərildi.',
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role_selected ? user.role : null },
      email_verification_sent: true,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'Bu email və ya telefon artıq mövcuddur' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Email + şifrə ilə giriş (müəllim / kurs) */
const loginWithEmail = async (req, res) => {
  try {
    const { email, password, role: roleRaw } = req.body || {};
    const emailCanon = normalizeEmailInput(email);
    if (!emailCanon) return res.status(400).json({ success: false, message: 'Düzgün email daxil edin' });
    const pass = String(password || '');
    if (!pass) return res.status(400).json({ success: false, message: 'Şifrə tələb olunur' });

    const requestedRole = String(roleRaw || '').trim().toLowerCase();

    const { rows } = await db.query(
      `SELECT u.*
       FROM users u
       WHERE u.is_active = TRUE
         AND lower(trim(u.email)) = $1
       LIMIT 1`,
      [emailCanon],
    );
    const user = rows[0];
    if (!user || !user.password_hash || !(await bcrypt.compare(pass, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Email və ya şifrə yanlışdır' });
    }

    const roles = await getActiveRoles(user.id);
    const allowed = roles.length ? roles : user.role ? [user.role] : [];
    if (allowed.length === 0) {
      if (!guardEmailVerifiedBeforeToken(res, user)) return;
      const token = sign({ id: user.id, role: null });
      return res.json({
        success: true,
        needs_role: true,
        token,
        user: { id: user.id, full_name: user.full_name, email: user.email, role: null, phone: user.phone },
      });
    }

    const role = requestedRole || String(allowed[0] || '').trim().toLowerCase();
    if (!role || !LOGIN_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: 'Rol seçin: müəllim, tələbə və ya kurs' });
    }
    if (!allowed.includes(role)) {
      return res.status(403).json({ success: false, message: `Bu hesab "${role}" rolu ilə giriş üçün uyğun deyil` });
    }

    if (!guardEmailVerifiedBeforeToken(res, user)) return;

    const token = sign({ id: user.id, role });
    const baseUser = { id: user.id, full_name: user.full_name, role, email: user.email, phone: user.phone };
    const userOut = await enrichUserForClient(baseUser, role);
    return res.json({ success: true, token, user: userOut });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Təsdiq emailini təkrar göndər */
const resendVerificationEmail = async (req, res) => {
  try {
    const emailCanon = normalizeEmailInput(req.body?.email);
    if (!emailCanon) return res.status(400).json({ success: false, message: 'Email tələb olunur' });

    const { rows } = await db.query(
      `SELECT id, email, is_verified FROM users
       WHERE is_active = TRUE AND lower(trim(email)) = $1
       LIMIT 1`,
      [emailCanon],
    );
    const user = rows[0];

    if (!user) {
      return res.json({
        success: true,
        message: 'Əgər hesab mövcuddursa, təsdiq emaili göndərildi',
      });
    }

    if (user.is_verified === true) {
      return res.json({ success: true, code: 'ALREADY_VERIFIED', message: 'Email artıq təsdiqlənib' });
    }

    const { mail } = await issueEmailVerification(user.id, user.email);
    if (!mail?.ok) {
      return res.status(500).json({ success: false, message: mail?.error || 'Email göndərilə bilmədi' });
    }

    return res.json({ success: true, message: 'Təsdiq emaili yenidən göndərildi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


const me = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, full_name, email, phone, role, phone_verified, is_active, is_verified, role_selected FROM users WHERE id = $1',
      [req.user.id],
    );
    const u = rows[0];
    if (!u || u.is_active === false) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (!guardEmailVerifiedBeforeToken(res, u)) return;
    const sessionRole = u.role_selected === false ? null : req.user.role;
    const userOut = await enrichUserForClient(u, sessionRole);
    if (u.role_selected === false) userOut.role = null;
    res.json({ success: true, user: userOut });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Google qeydiyyatından sonra telefon təsdiqi (müəllim / tələbə / kurs).
 * OTP ilə mövcud telefon hesabına google_sub bağlanır (köhnə mobil qeydiyyat sinxronu).
 */
const sendMyPhoneVerifyOtp = async (req, res) => {
  try {
    const sessionRole = req.user?.role;
    if (!PHONE_VERIFY_ROLES.has(sessionRole)) {
      return res.status(403).json({ success: false, message: 'Bu rol üçün telefon təsdiqi mövcud deyil' });
    }
    const phoneCanon = canonicalPhone(req.body?.phone);
    if (!phoneCanon) return res.status(400).json({ success: false, message: 'Telefon tələb olunur' });
    const clean = normalizePhone(phoneCanon);

    const { rows: meRows } = await db.query(
      `SELECT id, email, phone, phone_verified, google_sub, role
       FROM users
       WHERE id = $1 AND is_active = TRUE
       LIMIT 1`,
      [req.user.id]
    );
    const meUser = meRows[0];
    if (!meUser) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    const { rows: ownerRows } = await db.query(
      `SELECT id, email, role, google_sub, phone_verified, is_active
       FROM users
       WHERE ${PHONE_NORM} = $1`,
      [clean]
    );
    const owner =
      ownerRows.find((u) => u && String(u.id) !== String(req.user.id) && u.is_active === true) || null;
    if (owner) {
      if (!phoneLinkRolesCompatible(sessionRole, owner.role)) {
        await logRisk(req.user.id, req, { kind: 'phone_role_mismatch', phone: phoneCanon, owner_id: owner.id }, 35);
        return res.status(409).json({
          success: false,
          message: 'Bu telefon başqa rol üçün qeydiyyatdadır. Düzgün rolu seçin və ya müəlliminizlə əlaqə saxlayın.',
        });
      }
      if (
        owner.google_sub &&
        meUser.google_sub &&
        String(owner.google_sub).trim() !== '' &&
        String(owner.google_sub) !== String(meUser.google_sub)
      ) {
        await logRisk(req.user.id, req, { kind: 'phone_google_sub_clash', phone: phoneCanon, owner_id: owner.id }, 45);
        return res.status(409).json({
          success: false,
          message: 'Bu telefon artıq başqa Google hesabına bağlıdır',
        });
      }
      await logRisk(req.user.id, req, { kind: 'phone_link_existing', phone: phoneCanon, owner_id: owner.id }, 10);
    }

    const billingId = await resolveSmsBillingForLogin(meUser, sessionRole);
    await assertSmsOk(billingId);

    // Köhnə mobil hesab varsa telefonu indi yazma — UNIQUE pozulur; OTP təsdiqindən sonra birləşdirilir.
    if (!owner) {
      await db.query(
        `UPDATE users
         SET phone = $2,
             phone_verified = FALSE
         WHERE id = $1`,
        [req.user.id, phoneCanon]
      );
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);
    await db.query('DELETE FROM otp_codes WHERE phone = $1', [clean]);
    await db.query('INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)', [clean, code, expiresAt]);

    const sms = await sendOtpSms(clean, code);
    if (!sms?.success) {
      await db.query('DELETE FROM otp_codes WHERE phone = $1 AND code = $2', [clean, code]);
      return res.status(502).json({
        success: false,
        message: sms?.error || 'OTP SMS göndərilə bilmədi',
      });
    }
    res.json({
      success: true,
      message: 'OTP göndərildi',
      will_link_existing: Boolean(owner),
    });
  } catch (err) {
    if (err.code === '23505' && /phone/i.test(String(err.constraint || err.detail || err.message))) {
      return res.status(409).json({
        success: false,
        message:
          'Bu telefon artıq başqa hesabda qeydiyyatdadır. OTP göndərilməsi üçün yenidən cəhd edin — sistem hesabları birləşdirəcək.',
      });
    }
    if (err.statusCode && err.body) return res.status(err.statusCode).json(err.body);
    res.status(500).json({ success: false, message: err.message });
  }
};

const verifyMyPhoneVerifyOtp = async (req, res) => {
  try {
    const sessionRole = req.user?.role;
    if (!PHONE_VERIFY_ROLES.has(sessionRole)) {
      return res.status(403).json({ success: false, message: 'Bu rol üçün telefon təsdiqi mövcud deyil' });
    }
    const phoneCanon = canonicalPhone(req.body?.phone);
    const clean = phoneCanon ? normalizePhone(phoneCanon) : '';
    const codeStr = String(req.body?.code ?? '').trim();
    if (!clean || !codeStr) return res.status(400).json({ success: false, message: 'Telefon və kod tələb olunur' });

    const { rows } = await db.query(
      'SELECT * FROM otp_codes WHERE phone = $1 AND code = $2 AND is_used = FALSE AND expires_at > NOW()',
      [clean, codeStr]
    );
    if (!rows[0]) return res.status(400).json({ success: false, message: 'Kod yanlışdır və ya müddəti bitib' });
    await db.query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1', [rows[0].id]);

    const out = await db.transaction(async (client) => {
      const { rows: meRows } = await client.query(
        `SELECT id, email, google_sub, pin_hash, full_name, role
         FROM users
         WHERE id = $1 AND is_active = TRUE
         LIMIT 1`,
        [req.user.id]
      );
      const meUser = meRows[0];
      if (!meUser) throw new Error('Tapılmadı');

      const { rows: ownerRows } = await client.query(
        `SELECT id, email, google_sub, role, full_name
         FROM users
         WHERE is_active = TRUE
           AND ${PHONE_NORM} = $1
         LIMIT 2`,
        [clean]
      );
      const owner = ownerRows.find((u) => u && String(u.id) !== String(req.user.id)) || null;

      if (owner) {
        if (!phoneLinkRolesCompatible(sessionRole, owner.role)) {
          const err = new Error('Bu telefon başqa rol üçün qeydiyyatdadır');
          err.statusCode = 409;
          throw err;
        }
        if (
          owner.google_sub &&
          meUser.google_sub &&
          String(owner.google_sub).trim() !== '' &&
          String(owner.google_sub) !== String(meUser.google_sub)
        ) {
          await logRisk(req.user.id, req, { kind: 'phone_verify_google_clash', phone: phoneCanon, owner_id: owner.id }, 50);
          const err = new Error('Bu telefon artıq başqa Google hesabına bağlıdır');
          err.statusCode = 409;
          throw err;
        }

        await assertGoogleSubFreeForOtherUser(meUser.google_sub, owner.id);

        await client.query(
          `UPDATE users
           SET google_sub = COALESCE(NULLIF(TRIM(google_sub), ''), $2),
               email = COALESCE(NULLIF(TRIM(email), ''), $3),
               auth_provider = COALESCE(auth_provider, 'google'),
               phone_verified = TRUE,
               full_name = CASE
                 WHEN TRIM(COALESCE(full_name, '')) = '' THEN COALESCE($4, full_name)
                 ELSE full_name
               END
           WHERE id = $1`,
          [owner.id, meUser.google_sub, meUser.email, meUser.full_name || null]
        );

        await client
          .query(
            `UPDATE users
             SET is_active = FALSE,
                 deleted_at = NOW(),
                 phone = NULL,
                 email = NULL,
                 google_sub = NULL,
                 phone_verified = FALSE
             WHERE id = $1`,
            [req.user.id]
          )
          .catch(() => {});

        const { rows: linkedRows } = await client.query(
          `SELECT id, full_name, email, phone, role, phone_verified
           FROM users
           WHERE id = $1`,
          [owner.id]
        );
        return { user: linkedRows[0], linkedUserId: owner.id, merged: true };
      }

      await client.query(
        `UPDATE users
         SET phone = $2,
             phone_verified = TRUE
         WHERE id = $1`,
        [req.user.id, phoneCanon]
      );

      if (!hasStoredPin(meUser.pin_hash) && /^\d{6}$/.test(codeStr)) {
        const hash = await bcrypt.hash(codeStr, 12);
        await client.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [hash, req.user.id]).catch(() => {});
      }

      const { rows: fresh } = await client.query(
        'SELECT id, full_name, email, phone, role, phone_verified FROM users WHERE id = $1',
        [req.user.id]
      );
      return { user: fresh[0], linkedUserId: null, merged: false };
    });

    const sessionUser = out.user;
    const token = sign({ id: sessionUser.id, role: sessionUser.role });
    const userOut = await enrichUserForClient(sessionUser, sessionUser.role);
    res.json({
      success: true,
      token,
      user: userOut,
      linked_user_id: out.linkedUserId,
      merged: out.merged,
    });
  } catch (err) {
    const st = err.statusCode || 500;
    res.status(st).json({ success: false, message: err.message });
  }
};

/** İlk giriş OTP-dən sonra və ya unutmaqdan sonra — 6 rəqəm */
const setPin = async (req, res) => {
  try {
    const { pin } = req.body;
    const p = pin != null ? String(pin).trim() : '';
    if (!/^\d{6}$/.test(p)) {
      return res.status(400).json({ success: false, message: 'Tam 6 rəqəmli PIN daxil edin' });
    }
    const hash = await bcrypt.hash(p, 12);
    await db.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true, message: 'PIN saxlanıldı' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PIN ilə giriş — SMS yox */
const loginWithPin = async (req, res) => {
  try {
    const { phone, pin, role } = req.body;
    const clean = normalizePhone(phone);
    const p = pin != null ? String(pin).trim() : '';
    if (!clean || !role || !LOGIN_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: 'Telefon, rol və PIN tələb olunur' });
    }
    if (!/^\d{6}$/.test(p)) {
      return res.status(400).json({ success: false, message: '6 rəqəmli PIN daxil edin' });
    }
    const resolved = await resolveLoginUserOrError(clean, role);
    if (resolved.status) {
      return res.status(resolved.status).json(resolved.body);
    }
    const user = resolved.user;
    if (!hasStoredPin(user.pin_hash)) {
      return res.status(400).json({
        success: false,
        needs_setup: true,
        message:
          'Əvvəlcə "Davam et" basın — nömrənizə daimi 6 rəqəmli PIN bir dəfə SMS ilə göndəriləcək. OTP tələb olunmur.',
      });
    }
    const valid = await bcrypt.compare(p, user.pin_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'PIN yanlışdır' });
    if (!guardEmailVerifiedBeforeToken(res, user)) return;
    await db.query('UPDATE users SET phone_verified = TRUE WHERE id = $1', [user.id]);
    const token = signOTP({ id: user.id, role });
    const baseUser = { id: user.id, full_name: user.full_name, role, phone: user.phone };
    const userOut = await enrichUserForClient(baseUser, role);
    res.json({
      success: true,
      token,
      user: userOut,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

function googleClient() {
  const cid = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!cid) return null;
  return new OAuth2Client(cid);
}

async function verifyGoogleIdTokenOrThrow(credential) {
  const token = String(credential || '').trim();
  if (!token) {
    const err = new Error('Google credential tələb olunur');
    err.statusCode = 400;
    throw err;
  }
  const client = googleClient();
  if (!client) {
    const err = new Error('GOOGLE_CLIENT_ID konfiqurasiya olunmayıb');
    err.statusCode = 500;
    throw err;
  }
  const cid = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const ticket = await client.verifyIdToken({ idToken: token, audience: cid });
  const payload = ticket.getPayload() || {};
  const sub = payload.sub ? String(payload.sub) : '';
  const email = payload.email ? String(payload.email).trim().toLowerCase() : '';
  const name = payload.name ? String(payload.name).trim() : '';
  const email_verified = payload.email_verified === true || String(payload.email_verified || '').toLowerCase() === 'true';
  if (!sub) {
    const err = new Error('Google token etibarsızdır');
    err.statusCode = 401;
    throw err;
  }
  return { sub, email: email || null, name: name || null, email_verified, raw: payload };
}

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    const g = await verifyGoogleIdTokenOrThrow(credential);

    const bySub = await db.query(
      `SELECT id, full_name, email, role, phone, phone_verified, auth_provider, google_sub, account_status, is_active, is_verified
       FROM users
       WHERE is_active = TRUE
         AND google_sub = $1
       LIMIT 1`,
      [g.sub]
    );
    let user = bySub.rows[0] || null;

    if (!user && g.email) {
      const byEmail = await db.query(
        `SELECT id, full_name, email, role, phone, phone_verified, auth_provider, google_sub, account_status, is_active, is_verified
         FROM users
         WHERE email IS NOT NULL
           AND LOWER(TRIM(email)) = LOWER(TRIM($1))
         ORDER BY
           CASE WHEN is_active = TRUE THEN 0 ELSE 1 END,
           CASE WHEN role = 'student' THEN 0 ELSE 1 END,
           created_at DESC NULLS LAST
         LIMIT 1`,
        [g.email]
      );
      user = byEmail.rows[0] || null;
      if (user) {
        if (!g.email_verified) {
          const err = new Error('Google email təsdiqlənməyib');
          err.statusCode = 409;
          throw err;
        }
        if (user.role && user.role !== 'student') {
          const err = new Error('Bu Google email artıq başqa rol üçün qeydiyyatdan keçib');
          err.statusCode = 409;
          throw err;
        }
        if (user.google_sub && String(user.google_sub) !== String(g.sub)) {
          const err = new Error('Bu email artıq başqa Google hesabına bağlıdır');
          err.statusCode = 409;
          throw err;
        }

        await assertGoogleSubFreeForOtherUser(g.sub, user.id);

        await db.query(
          `UPDATE users
           SET google_sub = $2,
               auth_provider = 'google',
               is_active = TRUE,
               account_status = 'active',
               full_name = CASE
                 WHEN TRIM(COALESCE(full_name, '')) = '' THEN COALESCE($3, full_name)
                 ELSE full_name
               END
           WHERE id = $1`,
          [user.id, g.sub, g.name || null]
        );
      }
    }

    if (!user || !user.role) {
      if (g.email) {
        return res.json({
          success: true,
          needs_phone_link: true,
          profile: {
            email: g.email,
            full_name: g.name,
            google_sub: g.sub,
          },
        });
      }
      return res.json({
        success: true,
        needs_role: true,
        profile: { email: user?.email || null, full_name: user?.full_name || g.name, google_sub: g.sub },
      });
    }

    if (!guardEmailVerifiedBeforeToken(res, user)) return;

    const token = sign({ id: user.id, role: user.role });
    return res.json({
      success: true,
      token,
      user: buildAuthUserPayload(user),
    });
  } catch (err) {
    const st = err.statusCode || 500;
    res.status(st).json({ success: false, message: err.message });
  }
};

/**
 * Tələbə: Google email bazada yoxdursa — OTP ilə mövcud telefon hesabına google_sub bağlama (credential hər addımda yoxlanılır).
 */
const googleLinkSendOtp = async (req, res) => {
  try {
    const { credential, phone } = req.body;
    const g = await verifyGoogleIdTokenOrThrow(credential);
    if (!g.email) {
      return res.status(400).json({ success: false, message: 'Google email mövcud deyil' });
    }
    if (!g.email_verified) {
      return res.status(409).json({ success: false, message: 'Google email təsdiqlənməyib' });
    }
    const clean = normalizePhone(phone);
    if (!clean) return res.status(400).json({ success: false, message: 'Telefon nömrəsi tələb olunur' });

    const user = await findUserByPhoneAndRole(clean, 'student');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Bu nömrə ilə aktiv tələbə hesabı tapılmadı. Müəllimin səni əvvəlcə sistemə əlavə etməsini xahiş et.',
      });
    }
    if (user.google_sub && String(user.google_sub).trim() !== '') {
      if (String(user.google_sub) === String(g.sub)) {
        return res.status(409).json({
          success: false,
          message: 'Bu hesab artıq bu Google ilə bağlıdır. Birbaşa «Google ilə daxil ol»dan istifadə edin.',
        });
      }
      return res.status(409).json({
        success: false,
        message: 'Bu telefon nömrəsi artıq başqa Google hesabına bağlıdır',
      });
    }

    const billingId = await resolveSmsBillingInstructorId(user);
    const quota = await checkSmsQuota(billingId, { requireProfile: false });
    if (!quota.ok) return res.status(quota.statusCode).json(quota.body);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);
    await db.query('DELETE FROM otp_codes WHERE phone = $1', [clean]);
    await db.query('INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)', [
      clean,
      code,
      expiresAt,
    ]);
    const sms = await sendOtpSms(clean, code);
    if (!sms?.success) {
      await db.query('DELETE FROM otp_codes WHERE phone = $1 AND code = $2', [clean, code]);
      return res.status(502).json({
        success: false,
        message: sms?.error || 'OTP SMS göndərilə bilmədi. Bir az sonra yenidən cəhd edin.',
      });
    }
    res.json({ success: true, message: 'OTP göndərildi' });
  } catch (err) {
    const st = err.statusCode || 500;
    res.status(st).json({ success: false, message: err.message });
  }
};

const googleLinkVerify = async (req, res) => {
  try {
    const { credential, phone, code } = req.body;
    const g = await verifyGoogleIdTokenOrThrow(credential);
    if (!g.email || !g.email_verified) {
      return res.status(409).json({ success: false, message: 'Google email təsdiqlənməyib' });
    }
    const clean = normalizePhone(phone);
    const codeStr = String(code ?? '').trim();
    if (!clean || !codeStr) {
      return res.status(400).json({ success: false, message: 'Telefon və kod tələb olunur' });
    }

    const { rows: otpRows } = await db.query(
      'SELECT * FROM otp_codes WHERE phone = $1 AND code = $2 AND is_used = FALSE AND expires_at > NOW()',
      [clean, codeStr],
    );
    if (!otpRows[0]) {
      return res.status(400).json({ success: false, message: 'Kod yanlışdır və ya müddəti bitib' });
    }

    const user = await findUserByPhoneAndRole(clean, 'student');
    if (!user) {
      return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }
    if (user.google_sub && String(user.google_sub).trim() !== '') {
      if (String(user.google_sub) === String(g.sub)) {
        return res.status(409).json({
          success: false,
          message: 'Bu hesab artıq bu Google ilə bağlıdır.',
        });
      }
      return res.status(409).json({
        success: false,
        message: 'Bu telefon nömrəsi artıq başqa Google hesabına bağlıdır',
      });
    }

    await assertGoogleSubFreeForOtherUser(g.sub, user.id);

    const emailCanon = canonicalStudentEmail(g.email);
    if (!emailCanon) {
      return res.status(400).json({ success: false, message: 'Google email etibarsızdır' });
    }

    const { rows: clash } = await db.query(
      `SELECT id FROM users
       WHERE is_active = TRUE
         AND id <> $1
         AND email IS NOT NULL
         AND LOWER(TRIM(email)) = LOWER(TRIM($2))
       LIMIT 1`,
      [user.id, emailCanon],
    );
    if (clash[0]?.id) {
      return res.status(409).json({
        success: false,
        message: 'Bu Gmail ünvanı artıq başqa hesaba bağlıdır',
      });
    }

    const otpId = otpRows[0].id;
    try {
      await db.transaction(async (client) => {
        const { rows: otpFresh } = await client.query(
          `SELECT id FROM otp_codes
           WHERE id = $1 AND phone = $2 AND code = $3 AND is_used = FALSE AND expires_at > NOW()
           FOR UPDATE`,
          [otpId, clean, codeStr],
        );
        if (!otpFresh[0]) {
          const err = new Error('Kod yanlışdır və ya müddəti bitib');
          err.statusCode = 400;
          throw err;
        }
        await client.query(
          `UPDATE users
           SET google_sub = $2,
               email = $3,
               auth_provider = 'google',
               phone_verified = TRUE,
               is_active = TRUE,
               account_status = 'active',
               full_name = CASE
                 WHEN TRIM(COALESCE(full_name, '')) = '' THEN COALESCE($4, full_name)
                 ELSE full_name
               END
           WHERE id = $1`,
          [user.id, g.sub, emailCanon, g.name || null],
        );
        await client.query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1', [otpId]);
      });
    } catch (e) {
      if (e.statusCode) {
        return res.status(e.statusCode).json({ success: false, message: e.message });
      }
      throw e;
    }

    const { rows: fresh } = await db.query(
      `SELECT id, full_name, email, role, phone, phone_verified, is_verified
       FROM users WHERE id = $1`,
      [user.id],
    );
    const u = fresh[0];
    if (!u || !guardEmailVerifiedBeforeToken(res, u)) return;
    const token = sign({ id: u.id, role: u.role });
    return res.json({
      success: true,
      token,
      user: {
        id: u.id,
        full_name: u.full_name,
        role: u.role,
        email: u.email,
        phone: u.phone,
        phone_verified: Boolean(u.phone_verified),
      },
    });
  } catch (err) {
    const st = err.statusCode || 500;
    res.status(st).json({ success: false, message: err.message });
  }
};

const googleComplete = async (req, res) => {
  try {
    const { credential, role } = req.body;
    const g = await verifyGoogleIdTokenOrThrow(credential);
    const r = String(role || '').trim().toLowerCase();
    if (!r || !LOGIN_ROLES.has(r)) {
      return res.status(400).json({ success: false, message: 'Rol seçin: müəllim, tələbə və ya kurs' });
    }

    const { rows: existingBySub } = await db.query(
      `SELECT id, full_name, email, role, phone, phone_verified, google_sub, account_status, is_active, is_verified
       FROM users
       WHERE is_active = TRUE
         AND google_sub = $1
       LIMIT 1`,
      [g.sub]
    );
    let user = existingBySub[0] || null;

    if (!user && g.email) {
      const { rows: byEmail } = await db.query(
        `SELECT id, full_name, email, role, phone, phone_verified, google_sub, account_status, is_active, is_verified
         FROM users
         WHERE email IS NOT NULL
           AND LOWER(TRIM(email)) = LOWER(TRIM($1))
         ORDER BY
           CASE WHEN is_active = TRUE THEN 0 ELSE 1 END,
           created_at DESC NULLS LAST
         LIMIT 1`,
        [g.email]
      );
      user = byEmail[0] || null;
      if (user) {
        if (!g.email_verified) {
          return res.status(409).json({ success: false, message: 'Google email təsdiqlənməyib' });
        }
        if (user.role && user.role !== r) {
          return res.status(409).json({
            success: false,
            message: 'Bu Google email artıq başqa rol üçün mövcuddur',
          });
        }
        if (user.google_sub && String(user.google_sub) !== String(g.sub)) {
          return res.status(409).json({ success: false, message: 'Bu email artıq başqa Google hesabına bağlıdır' });
        }
        await assertGoogleSubFreeForOtherUser(g.sub, user.id);
      }
    }

    if (!user) {
      const fullName = g.name || (g.email ? g.email.split('@')[0] : 'User');
      // Some production DBs still enforce NOT NULL on password_hash. Google users don't have a password,
      // but password-based login paths must still fail safely (bcrypt compare against a random hash).
      const oauthPasswordPlaceholder = await bcrypt.hash(
        `google_oauth:${g.sub}:${Date.now()}:${Math.random()}`,
        10
      );
      const { rows: created } = await db.query(
        `INSERT INTO users (full_name, email, role, auth_provider, google_sub, phone_verified, password_hash, account_status, is_verified)
         VALUES ($1, $2, $3, 'google', $4, FALSE, $5, 'active', TRUE)
         RETURNING id, full_name, email, role, phone, phone_verified, is_verified`,
        [fullName, g.email, r, g.sub, oauthPasswordPlaceholder]
      );
      user = created[0];
    } else if (!user.role) {
      const { rows: updated } = await db.query(
        `UPDATE users
         SET role = $2,
             auth_provider = 'google',
             google_sub = COALESCE(google_sub, $3),
             is_active = TRUE,
             account_status = 'active'
         WHERE id = $1
         RETURNING id, full_name, email, role, phone, phone_verified, is_verified`,
        [user.id, r, g.sub]
      );
      user = updated[0] || user;
    } else {
      const { rows: linked } = await db.query(
        `UPDATE users
         SET google_sub = COALESCE(google_sub, $2),
             auth_provider = 'google',
             is_active = TRUE,
             account_status = 'active'
         WHERE id = $1
         RETURNING id, full_name, email, role, phone, phone_verified, is_verified`,
        [user.id, g.sub]
      );
      if (linked[0]) user = linked[0];
    }

    if (!guardEmailVerifiedBeforeToken(res, user)) return;

    const token = sign({ id: user.id, role: user.role });
    return res.json({
      success: true,
      token,
      user: buildAuthUserPayload(user),
    });
  } catch (err) {
    const st = err.statusCode || 500;
    res.status(st).json({ success: false, message: err.message });
  }
};

module.exports = {
  login,
  phoneNextStep,
  forgotPinSms,
  sendOtp,
  verifyOtp,
  register,
  verifyEmail,
  selectOnboardingRole,
  signup,
  loginWithEmail,
  resendVerificationEmail,
  me,
  setPin,
  loginWithPin,
  deliverPermanentPinSms,
  googleLogin,
  googleComplete,
  googleLinkSendOtp,
  googleLinkVerify,
  sendMyPhoneVerifyOtp,
  verifyMyPhoneVerifyOtp,
};
