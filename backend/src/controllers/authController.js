const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { sign, signOTP } = require('../utils/jwt');
const { sendOtpSms } = require('../services/smsService');
const { checkSmsQuota } = require('../services/smsQuotaService');

const PHONE_NORM = "regexp_replace(COALESCE(phone::text, ''), '[^0-9]', '', 'g')";
const LOGIN_ROLES = new Set(['instructor', 'student', 'parent']);

function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

function hasStoredPin(pinHash) {
  return pinHash != null && String(pinHash).trim().length > 0;
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

/** PIN təyin olunub → növbəti girişdə SMS yox; yoxdursa OTP */
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
      return res.json({
        success: true,
        next: 'otp',
        message: 'İlk giriş: nömrənizi SMS OTP ilə təsdiqləyin.',
      });
    }
    return res.json({
      success: true,
      next: 'pin',
      message: 'PIN kodunuzu daxil edin (SMS göndərilmir).',
    });
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
    const { phone, code, role, save_otp_as_pin } = req.body;
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

    const { rows: fresh } = await db.query('SELECT pin_hash FROM users WHERE id = $1', [user.id]);
    let hasPin = hasStoredPin(fresh[0]?.pin_hash);

    const declineOtpAsPin =
      save_otp_as_pin === false || save_otp_as_pin === 'false' || save_otp_as_pin === 0;
    const shouldSaveOtpAsPin = !hasPin && /^\d{6}$/.test(codeStr) && !declineOtpAsPin;

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
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const register = async (req, res) => {
  try {
    const { full_name, email, phone, password, role, subject, billing_type, parent_id } = req.body;
    const hash = await bcrypt.hash(password || 'Pass@123', 12);
    const result = await db.transaction(async (client) => {
      const { rows } = await client.query(
        'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, role, phone',
        [full_name, email?.toLowerCase() || null, phone, hash, role],
      );
      const user = rows[0];
      if (role === 'instructor') {
        await client.query(
          'INSERT INTO instructor_profiles (user_id, subject, billing_type) VALUES ($1, $2, $3)',
          [user.id, subject || null, billing_type || '8_lessons'],
        );
      } else if (role === 'student') {
        await client.query('INSERT INTO student_profiles (user_id, parent_id) VALUES ($1, $2)', [
          user.id,
          parent_id || null,
        ]);
      }
      return user;
    });
    res.status(201).json({ success: true, user: result });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Bu nömrə artıq mövcuddur' });
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
    if (!/^\d{4,6}$/.test(p)) {
      return res.status(400).json({ success: false, message: 'PIN daxil edin' });
    }
    const user = await findUserByPhoneAndRole(clean, role);
    if (!user) return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    if (!hasStoredPin(user.pin_hash)) {
      return res.status(400).json({
        success: false,
        needs_otp: true,
        message: 'Əvvəlcə OTP ilə təsdiq və PIN təyini lazımdır',
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
  sendOtp,
  verifyOtp,
  register,
  me,
  setPin,
  loginWithPin,
};
