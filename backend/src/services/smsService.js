const crypto = require('crypto');
const db = require('../utils/db');
const { ensureSmsPeriodUpToDate, bumpUsageCountersTx } = require('./billingEntitlements');

const SMS_API = 'https://sendsms.az/smxml/api';
const SMS_LOGIN = process.env.SMS_LOGIN;
const SMS_PASSWORD = process.env.SMS_PASSWORD;
const SMS_TITLE = process.env.SMS_TITLE || 'Mentorix';
/** Medpanel və LSIM Laravel paketi: GET …/quicksms/v1/balance?login=&key= */
const SMS_QUICKSMS_BASES = (
  process.env.SMS_QUICKSMS_BASE_URL || 'https://apps.lsim.az/quicksms'
)
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

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

async function insertSmsLog({
  instructorId,
  studentId,
  phone,
  message,
  status,
  httpStatus,
  msisdn,
  provider,
  deliveredAt,
  logType,
}) {
  const safeStatus = String(status || 'unknown').slice(0, 20);
  const typ = logType ? String(logType).slice(0, 40) : null;
  try {
    await db.query(
      `INSERT INTO sms_logs (instructor_id, student_id, phone, message, status, type, http_status, msisdn, provider, delivered_at, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $5 = 'sent' THEN NOW() ELSE NULL END)`,
      [
        instructorId,
        studentId ?? null,
        phone,
        message,
        status,
        typ,
        httpStatus ?? null,
        msisdn ?? null,
        provider ?? null,
        deliveredAt ?? null,
      ],
    );
  } catch {
    try {
      await db.query(
        `INSERT INTO sms_logs (instructor_id, student_id, phone, message, status, type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [instructorId, studentId ?? null, phone, message, safeStatus, typ],
      );
    } catch {
      await db.query('INSERT INTO sms_logs (instructor_id, phone, message, status) VALUES ($1, $2, $3, $4)', [
        instructorId,
        phone,
        message,
        safeStatus,
      ]);
    }
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

const sendSms = async ({ instructorId, phone, message, logType, studentId }) => {
  try {
    // Enforce monthly reset source-of-truth on every SMS attempt (cron not required).
    if (instructorId) {
      await ensureSmsPeriodUpToDate(db, instructorId).catch(() => {});
    }

    const raw = await sendRaw(phone, message);
    const interpreted = interpretSmxmlSuccess(raw);
    // IMPORTANT: Our UX expects a stable lifecycle status: scheduled|sent|failed.
    // Provider statuses vary (some return "scheduled" even for immediate sends), so we persist only stable values.
    const logStatus = interpreted.success ? 'sent' : `failed:${interpreted.reason || 'unknown'}`;
    const deliveredAt = interpreted.success ? new Date() : null;

    await insertSmsLog({
      instructorId,
      studentId,
      phone,
      message,
      status: logStatus,
      httpStatus: raw?.httpStatus,
      msisdn: raw?.msisdn,
      provider: raw?.json ?? null,
      deliveredAt,
      logType,
    });

    if (interpreted.success && instructorId) {
      await db.transaction(async (client) => {
        await bumpUsageCountersTx(client, instructorId, { sms_used_monthly: 1 });
        // Keep legacy counter in instructor_profiles if present (best-effort).
        await client.query('UPDATE instructor_profiles SET sms_used = sms_used + 1 WHERE user_id = $1', [instructorId]).catch(() => {});
      });
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

/** LSIM / sendsms.az QuickSMS: KEY = md5(md5(password) + login) */
function quicksmsAuthKey(login, password, { upper = false } = {}) {
  const md5pass = crypto.createHash('md5').update(String(password)).digest('hex');
  const raw = crypto.createHash('md5').update(md5pass + String(login)).digest('hex');
  return upper ? raw.toUpperCase() : raw;
}

const SMXML_RC_HINTS = {
  0: null,
  200: null,
  102: 'sendsms.az bu hesabda API balansını qaytarmır (paneldən qalanı əl ilə qeyd edin)',
  104: 'Sorğu rədd edildi — IP icazəsi və ya balans API deaktiv ola bilər',
  221: 'Login və ya parol səhvdir',
  235: 'SMXML sorğu formatı qəbul olunmadı',
};

function smxmlRcHint(code) {
  if (code == null) return null;
  return SMXML_RC_HINTS[code] || `Provayder kodu: ${code}`;
}

const QUICKSMS_ERROR_HINTS = {
  '-107': 'Server IP provayder panelində icazəli deyil (Railway egress IP əlavə edin)',
  '-500': 'QuickSMS xətası — login/key və ya hesab uyğunsuzluğu',
};

function quicksmsErrorHint(json) {
  if (!json || typeof json !== 'object') return null;
  const code = json.errorCode != null ? String(json.errorCode) : null;
  if (code && QUICKSMS_ERROR_HINTS[code]) return QUICKSMS_ERROR_HINTS[code];
  if (json.errorMessage) return String(json.errorMessage);
  return null;
}

function parseBalanceFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return { balance: null, error: 'Boş cavab' };
  if (/file not found|404|not found/i.test(raw)) {
    return { balance: null, error: 'Balans URL mövcud deyil' };
  }
  try {
    const json = JSON.parse(raw);
    return parseBalanceFromJson(json);
  } catch {
    const num = raw.replace(/[^\d.]/g, '');
    const n = Number(num);
    if (Number.isFinite(n) && n >= 0 && n < 1e9) return { balance: Math.round(n), error: null };
    const m = raw.match(/obj["\s:]+(\d+)/i) || raw.match(/balance["\s:]+(\d+)/i);
    if (m) return { balance: Math.round(Number(m[1])), error: null };
    return { balance: null, error: 'Cavab JSON deyil' };
  }
}

function parseBalanceFromJson(json) {
  if (!json || typeof json !== 'object') return { balance: null, error: 'Boş JSON' };
  const code = json.errorCode != null ? Number(json.errorCode) : null;
  if (code != null && Number.isFinite(code) && code < 0) {
    return { balance: null, error: json.errorMessage || `errorCode ${code}` };
  }
  const obj = json.obj ?? json.balance ?? json.data?.balance ?? json.data?.obj;
  const n = Number(obj);
  if (Number.isFinite(n) && n >= 0) return { balance: Math.round(n), error: null };

  const body = json?.response?.body;
  if (typeof body === 'number' && body >= 0) return { balance: Math.round(body), error: null };
  if (body != null && typeof body === 'object') {
    const b = Number(body.balance ?? body.credit ?? body.obj ?? body.amount);
    if (Number.isFinite(b) && b >= 0) return { balance: Math.round(b), error: null };
  }
  if (typeof body === 'string') {
    const bn = Number(body.replace(/[^\d.]/g, ''));
    if (Number.isFinite(bn) && bn >= 0) return { balance: Math.round(bn), error: null };
  }
  const headBal = Number(json?.response?.head?.balance ?? json?.response?.head?.credit);
  if (Number.isFinite(headBal) && headBal >= 0) return { balance: Math.round(headBal), error: null };

  const rc = readSmxmlResponseCode(json);
  if (rc === 0 || rc === 200) {
    return { balance: null, error: smxmlRcHint(rc) || 'Balans sahəsi tapılmadı' };
  }
  return { balance: null, error: smxmlRcHint(rc) || 'Balans tapılmadı' };
}

async function fetchQuicksmsBalance() {
  const login = String(SMS_LOGIN || '').trim();
  const key = quicksmsAuthKey(login, SMS_PASSWORD);
  let lastError = 'QuickSMS balans cavab vermədi';
  let lastRaw = null;

  for (const base of SMS_QUICKSMS_BASES) {
    const url = `${base}/v1/balance?login=${encodeURIComponent(login)}&key=${encodeURIComponent(key)}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const text = await res.text();
      lastRaw = text.slice(0, 500);
      if (/file not found|404 not found/i.test(text)) {
        lastError = `${base}/v1/balance mövcud deyil`;
        continue;
      }
      const parsed = parseBalanceFromText(text);
      if (parsed.balance != null) {
        return {
          ok: true,
          balance: parsed.balance,
          method: 'quicksms',
          base,
          error: null,
          raw: lastRaw,
        };
      }
      try {
        const json = JSON.parse(text);
        lastError = quicksmsErrorHint(json) || parsed.error || lastError;
      } catch {
        lastError = parsed.error || lastError;
      }
    } catch (e) {
      lastError = e.message || lastError;
    }
  }
  return { ok: false, balance: null, error: lastError, raw: lastRaw };
}

async function fetchSmxmlBalance() {
  const login = String(SMS_LOGIN || '').trim();
  const key = quicksmsAuthKey(login, SMS_PASSWORD);
  const operations = ['balance', 'credit', 'getbalance', 'getcredit', 'check_balance'];
  let lastError = 'sendsms.az SMXML balans cavab vermədi';
  let lastRaw = null;

  for (const operation of operations) {
    const variants = [
      {
        head: { operation, login, password: SMS_PASSWORD, title: SMS_TITLE, controlid: `${Date.now()}-${operation}` },
        body: [],
      },
      {
        head: { operation, login, key, title: SMS_TITLE, controlid: `${Date.now()}-${operation}-key` },
        body: [],
      },
      {
        head: { operation, login, password: SMS_PASSWORD, key, title: SMS_TITLE, controlid: `${Date.now()}-${operation}-both` },
        body: [],
      },
    ];
    for (const req of variants) {
      try {
        const res = await fetch(SMS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ request: req }),
        });
        const text = await res.text();
        lastRaw = text.slice(0, 500);
        const parsed = parseBalanceFromText(text);
        const rc = (() => {
          try {
            return readSmxmlResponseCode(JSON.parse(text));
          } catch {
            return null;
          }
        })();
        if (parsed.balance != null && (rc === 0 || rc === 200 || rc == null)) {
          return {
            ok: true,
            balance: parsed.balance,
            method: 'smxml',
            operation,
            error: null,
            raw: lastRaw,
          };
        }
        lastError = parsed.error || smxmlRcHint(rc) || lastError;
      } catch (e) {
        lastError = e.message || lastError;
      }
    }
  }
  return { ok: false, balance: null, error: lastError, raw: lastRaw };
}

let smsBalanceCache = { at: 0, result: null };
const SMS_BALANCE_CACHE_MS = 60_000;
let egressIpCache = { at: 0, ip: null };

/** Railway / hosting çıxış IP — LSIM panelində icazə üçün */
async function getServerEgressIp() {
  const now = Date.now();
  if (egressIpCache.ip && now - egressIpCache.at < 300_000) return egressIpCache.ip;
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    const ip = json?.ip ? String(json.ip).trim() : null;
    if (ip) egressIpCache = { at: now, ip };
    return ip;
  } catch {
    return null;
  }
}

async function fetchSmsProviderBalance({ bypassCache = false } = {}) {
  if (!SMS_LOGIN || !SMS_PASSWORD) {
    return { ok: false, balance: null, error: 'SMS_LOGIN / SMS_PASSWORD təyin olunmayıb' };
  }
  const now = Date.now();
  if (!bypassCache && smsBalanceCache.result && now - smsBalanceCache.at < SMS_BALANCE_CACHE_MS) {
    return smsBalanceCache.result;
  }

  const quicksms = await fetchQuicksmsBalance();
  if (quicksms.ok) {
    const out = { ...quicksms, fetched_at: new Date().toISOString() };
    smsBalanceCache = { at: now, result: out };
    return out;
  }

  const smxml = await fetchSmxmlBalance();
  if (smxml.ok) {
    const out = { ...smxml, fetched_at: new Date().toISOString() };
    smsBalanceCache = { at: now, result: out };
    return out;
  }

  const egress_ip = await getServerEgressIp();
  let error = quicksms.error || smxml.error || 'Balans oxunmadı';
  if (egress_ip && /ip|107|icazə/i.test(error) === false) {
    error = `${error}. LSIM/sendsms panelində bu server IP-ni icazəli edin: ${egress_ip}`;
  } else if (egress_ip) {
    error = `${error} (icazəli IP: ${egress_ip})`;
  }
  const out = {
    ok: false,
    balance: null,
    error,
    egress_ip,
    raw: quicksms.raw || smxml.raw || null,
    fetched_at: new Date().toISOString(),
  };
  smsBalanceCache = { at: now, result: out };
  return out;
}

const sendOtpSms = async (phone, code) => {
  const message = `Mentorix: ${code} kodunuz. 5 dəqiqə ərzində daxil edin.`;
  const raw = await sendRaw(phone, message);
  const interpreted = interpretSmxmlSuccess(raw);
  return {
    success: interpreted.success,
    error: interpreted.success ? null : interpreted.reason,
    raw,
  };
};

module.exports = { sendSms, sendOtpSms, sendRawSms: sendRaw, fetchSmsProviderBalance };
