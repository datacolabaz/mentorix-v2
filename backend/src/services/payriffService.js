const PAYRIFF_BASE_URL = process.env.PAYRIFF_BASE_URL || 'https://api.payriff.com/api/v3';
const PAYRIFF_SECRET_KEY = process.env.PAYRIFF_SECRET_KEY || '';

function httpError(code, status = 500, message = code) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  err.statusCode = status;
  return err;
}

function authHeaders() {
  if (!PAYRIFF_SECRET_KEY) throw httpError('PAYRIFF_CONFIG', 500, 'PAYRIFF_SECRET_KEY is missing');
  return {
    Authorization: PAYRIFF_SECRET_KEY,
    'Content-Type': 'application/json',
  };
}

async function createOrder({ amount, currency = 'AZN', language = 'AZ', description, callbackUrl, metadata }) {
  if (amount == null || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw httpError('PAYRIFF_AMOUNT', 400, 'Invalid amount');
  }
  const body = {
    amount: Number(amount),
    currency,
    language,
    description: String(description || 'Mentorix subscription').slice(0, 250),
    callbackUrl,
    cardSave: false,
    operation: 'PURCHASE',
    metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
  };

  const res = await fetch(`${PAYRIFF_BASE_URL.replace(/\/+$/, '')}/orders`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || String(json.code || '') !== '00000') {
    throw httpError('PAYRIFF_CREATE_FAILED', 502, json?.message || 'Payriff create order failed');
  }
  return json;
}

async function getOrderInfo(orderId) {
  const id = String(orderId || '').trim();
  if (!id) throw httpError('PAYRIFF_ORDER_ID', 400, 'Missing orderId');
  const res = await fetch(`${PAYRIFF_BASE_URL.replace(/\/+$/, '')}/orders/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || String(json.code || '') !== '00000') {
    throw httpError('PAYRIFF_ORDER_FETCH_FAILED', 502, json?.message || 'Payriff order fetch failed');
  }
  return json;
}

module.exports = { createOrder, getOrderInfo };

