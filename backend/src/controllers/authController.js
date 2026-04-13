const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { sign, signOTP } = require('../utils/jwt');
const { sendSms, sendOtpSms } = require('../services/smsService');
const { checkSmsQuota } = require('../services/smsQuotaService');

const PHONE_NORM = "regexp_replace(COALESCE(phone::text, ''), '[^0-9]', '', 'g')";
const LOGIN_ROLES = new Set(['instructor', 'student', 'parent']);

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

function hasStoredPin(pinHash) {
  return pinHash != null && String(pinHash).trim().length > 0;
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
  const billingId = await resolveSmsBillingInstructorId(user);
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

  const message = `Mentorix: Sizin daimi Mentorix giris PIN-iniz: ${plain}. Novbeti girislerde yalniz bu 6 reqemi daxil edin (OTP yox). Kodu hec kese demeyin.`;
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
  return { pinSmsSent: true };
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
      return res.status(400).json({ success: false, message: 'Rol seçin: müəllim, tələbə və ya valideyn' });
    }
    const user = await findUserByPhoneAndRole(clean, role);
    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          role === 'instructor'
            ? 'Bu nömrə ilə müəllim tapılmadı.'
            : role === 'student'
              ? 'Bu nömrə ilə tələbə tapılmadı.'
              : 'Bu nömrə ilə valideyn tapılmadı.',
      });
    }

    if (!hasStoredPin(user.pin_hash)) {
      try {
        const r = await deliverPermanentPinSms(user, clean, { force: false });
        if (r.alreadyHadPin) {
          return res.json({
            success: true,
            next: 'pin',
            message: 'PIN kodunuzu daxil edin.',
          });
        }
        return res.json({
          success: true,
          next: 'pin',
          pin_sms_sent: true,
          message:
            'Nömrənizə daimi 6 rəqəmli PIN SMS ilə göndərildi. Gələn kodu aşağıya daxil edin (OTP yox).',
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
    const user = await findUserByPhoneAndRole(clean, role);
    if (!user) return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    try {
      await deliverPermanentPinSms(user, clean, { force: true });
      return res.json({
        success: true,
        message: 'Yeni daimi PIN nömrənizə SMS ilə göndərildi. OTP tələb olunmur.',
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
    const { email, password } = req.body;
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1 AND is_active = TRUE', [
      email.toLowerCase(),
    ]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ success: false, message: 'Email və ya şifrə yanlışdır' });
    if (user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Yalnız admin email ilə daxil ola bilər' });
    const token = sign({ id: user.id, role: user.role });
    res.json({
      success: true,
      token,
      user: { id: user.id, full_name: user.full_name, role: user.role, email: user.email },
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
    await sendOtpSms(clean, code);
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
    res.json({
      success: true,
      token,
      user: { id: user.id, full_name: user.full_name, role: user.role, phone: user.phone },
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
    const hash = await bcrypt.hash(password || 'Pass@123', 12);
    const phoneCanon = canonicalPhone(phone);
    if (!phoneCanon) return res.status(400).json({ success: false, message: 'Telefon tələb olunur' });
    const emailCanon = email?.toLowerCase() || null;
    const result = await db.transaction(async (client) => {
      let user = null;
      try {
        const { rows } = await client.query(
          'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, role, phone',
          [full_name, emailCanon, phoneCanon, hash, role],
        );
        user = rows[0];
      } catch (e) {
        // Allow re-using a phone if an old (inactive) student record still exists.
        // This matches the product expectation: deleted user should free phone; if not, safely "revive".
        if (e?.code === '23505' && role === 'student') {
          const clean = normalizePhone(phoneCanon);
          const { rows: found } = await client.query(
            `SELECT id, full_name, email, role, phone, is_active
             FROM users
             WHERE ${PHONE_NORM} = $1
             LIMIT 1`,
            [clean]
          );
          const existing = found[0] || null;
          if (existing && existing.role === 'student' && existing.is_active === false) {
            const { rows: up } = await client.query(
              `UPDATE users
               SET full_name = $2,
                   email = $3,
                   phone = $4,
                   password_hash = $5,
                   role = 'student',
                   is_active = TRUE,
                   phone_verified = FALSE
               WHERE id = $1
               RETURNING id, full_name, email, role, phone`,
              [existing.id, full_name, emailCanon, phoneCanon, hash]
            );
            user = up[0];
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }

      if (role === 'instructor') {
        await client.query(
          'INSERT INTO instructor_profiles (user_id, subject, billing_type) VALUES ($1, $2, $3)',
          [user.id, subject || null, billing_type || '8_lessons'],
        );
      } else if (role === 'student') {
        // Avoid requiring a UNIQUE constraint on student_profiles.user_id for older DBs.
        const up = await client.query('UPDATE student_profiles SET parent_id = $2 WHERE user_id = $1', [
          user.id,
          parent_id || null,
        ]);
        if (up.rowCount === 0) {
          await client.query('INSERT INTO student_profiles (user_id, parent_id) VALUES ($1, $2)', [
            user.id,
            parent_id || null,
          ]);
        }
      }
      return user;
    });
    res.status(201).json({ success: true, user: result });
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

const me = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, full_name, email, phone, role FROM users WHERE id = $1', [
      req.user.id,
    ]);
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    const user = await findUserByPhoneAndRole(clean, role);
    if (!user) return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
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
    await db.query('UPDATE users SET phone_verified = TRUE WHERE id = $1', [user.id]);
    const token = signOTP({ id: user.id, role: user.role });
    res.json({
      success: true,
      token,
      user: { id: user.id, full_name: user.full_name, role: user.role, phone: user.phone },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  login,
  phoneNextStep,
  forgotPinSms,
  sendOtp,
  verifyOtp,
  register,
  me,
  setPin,
  loginWithPin,
};
