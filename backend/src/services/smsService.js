const db = require('../utils/db');

const SMS_API = 'https://sendsms.az/smxml/api';
const SMS_LOGIN = process.env.SMS_LOGIN;
const SMS_PASSWORD = process.env.SMS_PASSWORD;
const SMS_TITLE = process.env.SMS_TITLE || 'Mentorix';

const normalizePhone = (phone) => String(phone ?? '').replace(/\D/g, '');

const sendRaw = async (phone, message) => {
  const clean = normalizePhone(phone);
  if (!clean || clean.length < 9) {
    return { ok: false, httpStatus: 0, json: null, error: 'Invalid phone number' };
  }
  if (!SMS_LOGIN || !SMS_PASSWORD) {
    return { ok: false, httpStatus: 0, json: null, error: 'SMS provider credentials are missing' };
  }

  const res = await fetch(SMS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request: {
        head: {
          operation: 'submit',
          login: SMS_LOGIN,
          password: SMS_PASSWORD,
          controlid: Date.now().toString(),
          title: SMS_TITLE,
          scheduled: 'NOW',
          isbulk: false,
        },
        body: [{ msisdn: clean, message }],
      },
    }),
  });
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    return { ok: false, httpStatus: res.status, json: null, error: 'Invalid JSON response from SMS provider' };
  }
  return { ok: res.ok, httpStatus: res.status, json, error: null };
};

const sendSms = async ({ instructorId, phone, message }) => {
  try {
    const raw = await sendRaw(phone, message);
    const statusRaw = raw?.json?.response?.status ?? raw?.json?.status ?? null;
    const status = statusRaw != null ? String(statusRaw) : raw?.ok ? 'sent' : 'failed';

    const providerOk =
      raw?.ok === true &&
      // Provider response format is inconsistent; consider it success if no obvious error
      !raw?.json?.error &&
      !raw?.json?.response?.error &&
      status.toLowerCase() !== 'failed' &&
      status.toLowerCase() !== 'error';
    const success = providerOk;

    await db.query(
      'INSERT INTO sms_logs (instructor_id, phone, message, status) VALUES ($1, $2, $3, $4)',
      [instructorId, phone, message, status || (raw?.ok ? 'sent' : 'failed')]
    );

    if (instructorId) {
      await db.query(
        'UPDATE instructor_profiles SET sms_used = sms_used + 1 WHERE user_id = $1',
        [instructorId]
      );
    }

    return { success, result: raw?.json, httpStatus: raw?.httpStatus, status };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

const sendOtpSms = async (phone, code) => {
  const message = `Mentorix: ${code} kodunuz. 5 deqiqe erzinde daxil edin.`;
  return sendRaw(phone, message);
};

module.exports = { sendSms, sendOtpSms };
