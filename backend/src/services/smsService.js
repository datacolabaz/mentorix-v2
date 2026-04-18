const db = require('../utils/db');

const SMS_API = 'https://sendsms.az/smxml/api';
const SMS_LOGIN = process.env.SMS_LOGIN;
const SMS_PASSWORD = process.env.SMS_PASSWORD;
const SMS_TITLE = process.env.SMS_TITLE || 'Edupanel';

const normalizePhone = (phone) => String(phone ?? '').replace(/\D/g, '');

function interpretSmxmlSuccess(raw) {
  if (!raw || raw.ok !== true) return { success: false, reason: raw?.error || 'HTTP request failed' };

  const j = raw.json;
  if (!j) return { success: false, reason: 'Empty provider JSON' };

  // sendsms.az responses are inconsistent; prefer explicit status codes when present,
  // but don't fail-closed if the payload is clearly a success-shaped JSON without `status`.
  if (j.error || j.response?.error) {
    return { success: false, reason: j.error || j.response?.error || 'Provider error' };
  }

  const statusRaw = j.response?.status ?? j.status ?? null;
  if (statusRaw != null) {
    const status = String(statusRaw).trim().toLowerCase();
    const badStatuses = new Set(['failed', 'error', 'rejected', 'invalid', 'denied']);
    if (badStatuses.has(status)) {
      return { success: false, reason: `SMS provider status: ${String(statusRaw)}` };
    }

    const okStatuses = new Set(['sent', 'success', 'ok', 'queued', 'accepted', 'submitted', '0', '200']);
    if (okStatuses.has(status)) return { success: true, reason: null };

    // Unknown status string: still better than silently dropping SMS; treat as success if HTTP OK and no errors.
    return { success: true, reason: null };
  }

  // No explicit status: if JSON exists and no top-level error fields, assume accepted.
  return { success: true, reason: null };
}

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
    const interpreted = interpretSmxmlSuccess(raw);
    const statusRaw = raw?.json?.response?.status ?? raw?.json?.status ?? null;
    const status =
      interpreted.success
        ? String(statusRaw ?? 'sent')
        : `failed:${interpreted.reason || 'unknown'}`;

    if (interpreted.success) {
      await db.query(
        'INSERT INTO sms_logs (instructor_id, phone, message, status) VALUES ($1, $2, $3, $4)',
        [instructorId, phone, message, status || 'sent']
      );

      if (instructorId) {
        await db.query('UPDATE instructor_profiles SET sms_used = sms_used + 1 WHERE user_id = $1', [instructorId]);
      }
    } else {
      await db.query(
        'INSERT INTO sms_logs (instructor_id, phone, message, status) VALUES ($1, $2, $3, $4)',
        [instructorId, phone, message, status]
      );
    }

    return {
      success: interpreted.success,
      error: interpreted.success ? null : interpreted.reason,
      result: raw?.json,
      httpStatus: raw?.httpStatus,
      status,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

const sendOtpSms = async (phone, code) => {
  const message = `Edupanel: ${code} kodunuz. 5 deqiqe erzinde daxil edin.`;
  const raw = await sendRaw(phone, message);
  const interpreted = interpretSmxmlSuccess(raw);
  return {
    success: interpreted.success,
    error: interpreted.success ? null : interpreted.reason,
    raw,
  };
};

module.exports = { sendSms, sendOtpSms, sendRawSms: sendRaw };
