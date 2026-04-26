const db = require('../utils/db');

const SMS_API = 'https://sendsms.az/smxml/api';
const SMS_LOGIN = process.env.SMS_LOGIN;
const SMS_PASSWORD = process.env.SMS_PASSWORD;
const SMS_TITLE = process.env.SMS_TITLE || 'Mentorix';

const normalizePhone = (phone) => String(phone ?? '').replace(/\D/g, '');

/**
 * sendsms.az expects `msisdn` as digits (no '+').
 * Our DB often stores Azerbaijani numbers as `+994XXXXXXXXX` which normalizes to `994...` (12 digits).
 * Some clients still enter `0XXXXXXXXX` which normalizes to a 10-digit local form — convert to `994...`.
 */
function toSendSmsMsisdn(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d) return null;

  if (d.startsWith('994') && d.length >= 12) return d;
  if (d.startsWith('0') && d.length === 10) return `994${d.slice(1)}`;
  if (!d.startsWith('0') && d.length === 9) return `994${d}`;

  // Fallback: if it's already long enough, pass through
  if (d.length >= 10) return d;
  return null;
}

function readSmxmlResponseCode(json) {
  const j = json;
  const candidates = [
    j?.response?.head?.responsecode,
    j?.response?.head?.responseCode,
    j?.response?.responsecode,
    j?.response?.responseCode,
    j?.responsecode,
    j?.responseCode,
  ];
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    const n = typeof c === 'number' ? c : parseInt(String(c).trim(), 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function interpretSmxmlSuccess(raw) {
  if (!raw || raw.ok !== true) return { success: false, reason: raw?.error || 'HTTP request failed' };

  const j = raw.json;
  if (!j) return { success: false, reason: 'Empty provider JSON' };

  const rc = readSmxmlResponseCode(j);
  if (rc != null) {
    // sendsms.az uses numeric response codes in `response.head.responsecode`.
    // Observed: 235 while HTTP is still 200 — treat non-zero as failure unless explicitly whitelisted.
    if (rc !== 0 && rc !== 200) {
      return { success: false, reason: `SMS provider responsecode: ${rc}` };
    }
  }

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

async function insertSmsLog({ instructorId, phone, message, status, httpStatus, msisdn, provider }) {
  const safeStatus = String(status || 'unknown').slice(0, 20);
  try {
    await db.query(
      `INSERT INTO sms_logs (instructor_id, phone, message, status, http_status, msisdn, provider)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [instructorId, phone, message, status, httpStatus ?? null, msisdn ?? null, provider ?? null]
    );
  } catch {
    // Backward compatible if migration 036 hasn't been applied yet.
    await db.query('INSERT INTO sms_logs (instructor_id, phone, message, status) VALUES ($1, $2, $3, $4)', [
      instructorId,
      phone,
      message,
      safeStatus,
    ]);
  }
}

const sendRaw = async (phone, message) => {
  const clean = normalizePhone(phone);
  const msisdn = toSendSmsMsisdn(clean);
  if (!msisdn || msisdn.length < 11 || msisdn.length > 15) {
    return { ok: false, httpStatus: 0, json: null, error: 'Invalid phone number', msisdn: null };
  }
  if (!SMS_LOGIN || !SMS_PASSWORD) {
    return { ok: false, httpStatus: 0, json: null, error: 'SMS provider credentials are missing', msisdn };
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
        body: [{ msisdn, message }],
      },
    }),
  });
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    return { ok: false, httpStatus: res.status, json: null, error: 'Invalid JSON response from SMS provider', msisdn };
  }
  return { ok: res.ok, httpStatus: res.status, json, error: null, msisdn };
};

const sendSms = async ({ instructorId, phone, message }) => {
  try {
    const raw = await sendRaw(phone, message);
    const interpreted = interpretSmxmlSuccess(raw);
    const statusRaw = raw?.json?.response?.status ?? raw?.json?.status ?? null;
    const logStatus = interpreted.success ? String(statusRaw ?? 'sent') : `failed:${interpreted.reason || 'unknown'}`;

    await insertSmsLog({
      instructorId,
      phone,
      message,
      status: logStatus,
      httpStatus: raw?.httpStatus,
      msisdn: raw?.msisdn,
      provider: raw?.json ?? null,
    });

    if (interpreted.success && instructorId) {
      await db.query('UPDATE instructor_profiles SET sms_used = sms_used + 1 WHERE user_id = $1', [instructorId]);
    }

    return {
      success: interpreted.success,
      error: interpreted.success ? null : interpreted.reason,
      result: raw?.json,
      httpStatus: raw?.httpStatus,
      status: interpreted.success ? 'sent' : 'failed',
      logStatus,
      msisdn: raw?.msisdn,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

const sendOtpSms = async (phone, code) => {
  const message = `Mentorix: ${code} kodunuz. 5 dəqiqə ərzində daxil edin.`;
  const raw = await sendRaw(phone, message);
  const interpreted = interpretSmxmlSuccess(raw);
  const statusRaw = raw?.json?.response?.status ?? raw?.json?.status ?? null;
  const logStatus = interpreted.success ? String(statusRaw ?? 'sent') : `failed:${interpreted.reason || 'unknown'}`;

  // OTP is a system message; we still log it for history/debugging, but it must not consume instructor SMS quota.
  await insertSmsLog({
    instructorId: null,
    phone,
    message,
    status: logStatus,
    httpStatus: raw?.httpStatus,
    msisdn: raw?.msisdn,
    provider: { kind: 'otp', raw: raw?.json ?? null },
  });

  return {
    success: interpreted.success,
    error: interpreted.success ? null : interpreted.reason,
    raw,
  };
};

module.exports = { sendSms, sendOtpSms, sendRawSms: sendRaw };
