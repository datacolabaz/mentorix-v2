const db = require('../utils/db');

const SMS_API = 'https://sendsms.az/smxml/api';
const SMS_LOGIN = process.env.SMS_LOGIN;
const SMS_PASSWORD = process.env.SMS_PASSWORD;
const SMS_TITLE = process.env.SMS_TITLE || 'Mentorix';

const sendRaw = async (phone, message) => {
  const clean = phone.replace(/\D/g, '');
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
  return res.json();
};

const sendSms = async ({ instructorId, phone, message }) => {
  try {
    const result = await sendRaw(phone, message);

    await db.query(
      'INSERT INTO sms_logs (instructor_id, phone, message, status) VALUES ($1, $2, $3, $4)',
      [instructorId, phone, message, result?.response?.status || 'sent']
    );

    if (instructorId) {
      await db.query(
        'UPDATE instructor_profiles SET sms_used = sms_used + 1 WHERE user_id = $1',
        [instructorId]
      );
    }

    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

const sendOtpSms = async (phone, code) => {
  const message = `Mentorix: ${code} kodunuz. 5 deqiqe erzinde daxil edin.`;
  return sendRaw(phone, message);
};

module.exports = { sendSms, sendOtpSms };
