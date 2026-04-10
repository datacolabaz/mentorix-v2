const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { sign, signOTP, verify } = require('../utils/jwt');
const { sendOtpSms } = require('../services/smsService');

// Admin login - email + sifre
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ success: false, message: 'Email və ya şifrə yanlışdır' });
    if (user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Yalnız admin email ilə daxil ola bilər' });
    const token = sign({ id: user.id, role: user.role });
    res.json({ success: true, token, user: { id: user.id, full_name: user.full_name, role: user.role, email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// OTP gonder - muellim, telebe, valideyn
const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Telefon nömrəsi tələb olunur' });

    const clean = phone.replace(/\D/g, '');
    const { rows } = await db.query(
      "SELECT * FROM users WHERE REPLACE(REPLACE(phone,'+',''),'-','') = $1 AND is_active = TRUE",
      [clean]
    );

    if (!rows[0])
      return res.status(404).json({ success: false, message: 'Bu nömrə ilə istifadəçi tapılmadı' });

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);

    await db.query('DELETE FROM otp_codes WHERE phone = $1', [clean]);
    await db.query(
      'INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)',
      [clean, code, expiresAt]
    );

    await sendOtpSms(clean, code);
    res.json({ success: true, message: 'OTP göndərildi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// OTP yoxla
const verifyOtp = async (req, res) => {
  try {
    const { phone, code } = req.body;
    const clean = phone.replace(/\D/g, '');

    const { rows } = await db.query(
      'SELECT * FROM otp_codes WHERE phone = $1 AND code = $2 AND is_used = FALSE AND expires_at > NOW()',
      [clean, code]
    );

    if (!rows[0])
      return res.status(400).json({ success: false, message: 'Kod yanlış və ya müddəti bitib' });

    await db.query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1', [rows[0].id]);

    const { rows: users } = await db.query(
      "SELECT * FROM users WHERE REPLACE(REPLACE(phone,'+',''),'-','') = $1 AND is_active = TRUE",
      [clean]
    );

    const user = users[0];
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

// Qeydiyyat
const register = async (req, res) => {
  try {
    const { full_name, email, phone, password, role, subject, billing_type, parent_id } = req.body;
    const hash = await bcrypt.hash(password || 'Pass@123', 12);

    const result = await db.transaction(async (client) => {
      const { rows } = await client.query(
        'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, role, phone',
        [full_name, email?.toLowerCase() || null, phone, hash, role]
      );
      const user = rows[0];
      if (role === 'instructor') {
        await client.query(
          'INSERT INTO instructor_profiles (user_id, subject, billing_type) VALUES ($1, $2, $3)',
          [user.id, subject || null, billing_type || '8_lessons']
        );
      } else if (role === 'student') {
        await client.query(
          'INSERT INTO student_profiles (user_id, parent_id) VALUES ($1, $2)',
          [user.id, parent_id || null]
        );
      }
      return user;
    });

    res.status(201).json({ success: true, user: result });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ success: false, message: 'Bu email və ya telefon artıq mövcuddur' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// Me
const me = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, full_name, email, phone, role FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { login, sendOtp, verifyOtp, register, me };
