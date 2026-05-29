const crypto = require('crypto');
const db = require('../utils/db');
const { ensureSmsPeriodUpToDate, bumpUsageCountersTx } = require('./billingEntitlements');

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

async function insertSmsLog({ instructorId, phone, message, status, httpStatus, msisdn, provider, deliveredAt }) {
  const safeStatus = String(status || 'unknown').slice(0, 20);
  try {
    await db.query(
      `INSERT INTO sms_logs (instructor_id, phone, message, status, http_status, msisdn, provider, delivered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [instructorId, phone, message, status, httpStatus ?? null, msisdn ?? null, provider ?? null, deliveredAt ?? null]
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
      phone,
      message,
      status: logStatus,
      httpStatus: raw?.httpStatus,
      msisdn: raw?.msisdn,
      provider: raw?.json ?? null,
      deliveredAt,
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

function parseQuicksmsBalanceJson(json) {
  if (!json || typeof json !== 'object') return { balance: null, error: null };
  const code = json.errorCode != null ? Number(json.errorCode) : null;
  if (code != null && Number.isFinite(code) && code < 0) {
    return { balance: null, error: json.errorMessage || `QuickSMS errorCode ${code}` };
  }
  const obj = json.obj ?? json.balance ?? json.data?.balance ?? json.data?.obj;
  const n = Number(obj);
  if (Number.isFinite(n) && n >= 0) return { balance: Math.round(n), error: null };
  return { balance: null, error: json.errorMessage || 'Balans tapılmadı' };
}

function extractSmxmlBalanceFromJson(json) {
  const body = json?.response?.body;
  if (body != null) {
    const direct = Number(body.balance ?? body.credit ?? body.obj);
    if (Number.isFinite(direct) && direct >= 0) return Math.round(direct);
    if (Array.isArray(body) && body[0]) {
      const b = Number(body[0].balance ?? body[0].credit);
      if (Number.isFinite(b) && b >= 0) return Math.round(b);
    }
  }
  const headBal = Number(json?.response?.head?.balance ?? json?.response?.head?.credit);
  if (Number.isFinite(headBal) && headBal >= 0) return Math.round(headBal);
  return null;
}

async function fetchQuicksmsBalance() {
  const login = String(SMS_LOGIN || '').trim();
  const keys = [
    quicksmsAuthKey(login, SMS_PASSWORD, { upper: false }),
    quicksmsAuthKey(login, SMS_PASSWORD, { upper: true }),
  ];
  const bases = [
    process.env.SMS_QUICKSMS_BASE_URL,
    'https://sendsms.az',
    'https://www.sendsms.az',
    'https://lsim.az',
    'https://www.lsim.az',
  ].filter(Boolean);
  const paths = ['/quicksms/v1/balance', '/quicksms/v1/balance/'];
  let lastError = 'QuickSMS balans oxunmadı';

  for (const base of bases) {
    const origin = String(base).replace(/\/+$/, '');
    for (const p of paths) {
      for (const key of keys) {
        const payload = { login, key };
        const attempts = [
          {
            label: 'POST JSON',
            run: () =>
              fetch(`${origin}${p}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(payload),
              }),
          },
          {
            label: 'GET query',
            run: () =>
              fetch(
                `${origin}${p}?login=${encodeURIComponent(login)}&key=${encodeURIComponent(key)}`,
                { method: 'GET', headers: { Accept: 'application/json' } }
              ),
          },
          {
            label: 'POST form',
            run: () =>
              fetch(`${origin}${p}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
                body: new URLSearchParams({ login, key }).toString(),
              }),
          },
        ];
        for (const { label, run } of attempts) {
          try {
            const res = await run();
            const text = await res.text();
            let json = null;
            try {
              json = JSON.parse(text);
            } catch {
              lastError = `${origin}${p} ${label}: JSON deyil`;
              continue;
            }
            const parsed = parseQuicksmsBalanceJson(json);
            if (parsed.balance != null) {
              return {
                ok: true,
                balance: parsed.balance,
                method: 'quicksms',
                endpoint: `${origin}${p}`,
                error: null,
              };
            }
            lastError = parsed.error || `${origin}${p} ${label}: balans yoxdur`;
          } catch (e) {
            lastError = e.message || lastError;
          }
        }
      }
    }
  }
  return { ok: false, balance: null, error: lastError };
}

async function fetchSmxmlBalance() {
  const login = SMS_LOGIN;
  const key = quicksmsAuthKey(login, SMS_PASSWORD);
  const operations = ['balance', 'getbalance', 'credit', 'getcredit'];
  let lastError = 'SMXML balans oxunmadı';

  for (const operation of operations) {
    for (const auth of [
      { login, key, password: null },
      { login, password: SMS_PASSWORD, key: null },
      { login, key, password: SMS_PASSWORD },
    ]) {
      try {
        const head = {
          operation,
          login,
          controlid: `${Date.now()}-${operation}`,
        };
        if (auth.key) head.key = auth.key;
        if (auth.password) head.password = auth.password;

        const res = await fetch(SMS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ request: { head } }),
        });
        const json = await res.json();
        const rc = readSmxmlResponseCode(json);
        if (rc != null && rc !== 0 && rc !== 200) {
          lastError = `SMXML ${operation} kodu: ${rc}`;
          continue;
        }
        const balance = extractSmxmlBalanceFromJson(json);
        if (balance != null) {
          return { ok: true, balance, method: 'smxml', operation, error: null };
        }
      } catch (e) {
        lastError = e.message || lastError;
      }
    }
  }
  return { ok: false, balance: null, error: lastError };
}

let smsBalanceCache = { at: 0, result: null };
const SMS_BALANCE_CACHE_MS = 60_000;

async function fetchSmsProviderBalance({ bypassCache = false } = {}) {
  if (!SMS_LOGIN || !SMS_PASSWORD) {
    return { ok: false, balance: null, error: 'SMS_LOGIN / SMS_PASSWORD təyin olunmayıb' };
  }
  const now = Date.now();
  if (!bypassCache && smsBalanceCache.result && now - smsBalanceCache.at < SMS_BALANCE_CACHE_MS) {
    return smsBalanceCache.result;
  }

  const quick = await fetchQuicksmsBalance();
  if (quick.ok) {
    const out = { ...quick, fetched_at: new Date().toISOString() };
    smsBalanceCache = { at: now, result: out };
    return out;
  }

  const smxml = await fetchSmxmlBalance();
  if (smxml.ok) {
    const out = { ...smxml, fetched_at: new Date().toISOString() };
    smsBalanceCache = { at: now, result: out };
    return out;
  }

  const out = {
    ok: false,
    balance: null,
    error: [quick.error, smxml.error].filter(Boolean).join(' · ') || 'Balans oxunmadı',
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
