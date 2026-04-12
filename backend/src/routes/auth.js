const router = require('express').Router();
const { login, sendOtp, verifyOtp, register, me, setPin, loginWithPin } = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');
const bcrypt = require('bcryptjs');
const { signOTP } = require('../utils/jwt');
const { sendOtpSms } = require('../services/smsService');
 
router.post('/login', login);
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);
router.post('/register', authenticate, authorize('admin', 'instructor'), register);
router.get('/me', authenticate, me);
router.post('/pin/set', authenticate, setPin);
router.post('/pin/login', loginWithPin);
 
// Phone-PIN: Step 1 - nomreni yoxla, PIN yoxdursa yarat ve SMS gonder
router.post('/phone-pin/phone', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Telefon nomresi teleb olunur' });
    const clean = phone.replace(/\D/g, '');
    const { rows } = await db.query(
      "SELECT * FROM users WHERE REPLACE(REPLACE(phone,'+',''),'-','') = $1 AND is_active = TRUE",
      [clean]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'Bu nomre sistemde qeydiyyatdan kecmeyib' });
 
    if (!user.pin_hash) {
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      const hash = await bcrypt.hash(pin, 12);
      await db.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [hash, user.id]);
      const smsText = 'Mentorix: Sizin giris PIN kodunuz: ' + pin + '. Zehmet olmasa daxil olanda istifade edin.';
      await sendOtpSms(clean, smsText);
      return res.json({ success: true, pinSent: true, message: 'PIN kod nomrenize SMS ile gonderildi. Daxil edin.' });
    }
 
    res.json({ success: true, pinSent: false, message: 'PIN kodunuzu daxil edin.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// Phone-PIN: Step 2 - PIN ile giris
router.post('/phone-pin/verify', async (req, res) => {
  try {
    const { phone, pin } = req.body;
    const clean = phone.replace(/\D/g, '');
    const { rows } = await db.query(
      "SELECT * FROM users WHERE REPLACE(REPLACE(phone,'+',''),'-','') = $1 AND is_active = TRUE",
      [clean]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'Istifadeci tapilmadi' });
    if (!user.pin_hash) return res.status(400).json({ success: false, message: 'Evvelce nomrenizi daxil edin' });
    const valid = await bcrypt.compare(pin, user.pin_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'PIN yanlisdir' });
    const token = signOTP({ id: user.id, role: user.role });
    res.json({ success: true, token, user: { id: user.id, full_name: user.full_name, role: user.role, phone: user.phone } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// Phone-PIN: PIN-i unut - yeni PIN yarat ve SMS gonder
router.post('/phone-pin/forgot', async (req, res) => {
  try {
    const { phone } = req.body;
    const clean = phone.replace(/\D/g, '');
    const { rows } = await db.query(
      "SELECT * FROM users WHERE REPLACE(REPLACE(phone,'+',''),'-','') = $1 AND is_active = TRUE",
      [clean]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'Istifadeci tapilmadi' });
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const hash = await bcrypt.hash(pin, 12);
    await db.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [hash, user.id]);
    const smsText = 'Mentorix: Yeni PIN kodunuz: ' + pin + '. Kohne PIN artiq etibarsizdir.';
    await sendOtpSms(clean, smsText);
    res.json({ success: true, message: 'Yeni PIN nomrenize SMS ile gonderildi.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
module.exports = router;
