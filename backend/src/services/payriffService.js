const PAYRIFF_BASE_URL = process.env.PAYRIFF_BASE_URL || 'https://api.payriff.com/api/v3';

function httpError(code, status = 500, message = code) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  err.statusCode = status;
  return err;
}

/** Payriff merchant panelindən gələn secret; hər çağırışda oxunur (deploy sonrası env yenilənəndə restart ehtiyacını azaldır) */
function payriffSecretKey() {
  return String(
    process.env.PAYRIFF_SECRET_KEY ||
      process.env.PAYRIFF_API_SECRET ||
      process.env.PAYRIFF_KEY ||
      ''
  ).trim();
}

function authHeaders() {
  const key = payriffSecretKey();
  if (!key) {
    throw httpError(
      'PAYRIFF_CONFIG',
      500,
      'Ödəniş (Payriff) konfiqurasiyası yoxdur. Serverdə PAYRIFF_SECRET_KEY əlavə edin (məs. Railway → Variables). Payriff kabinetindən secret/API açarını kopyalayın.'
    );
  }
  return {
    Authorization: key,
    'Content-Type': 'application/json',
  };
}

function payriffMerchantId() {
  return String(process.env.PAYRIFF_MERCHANT_ID || process.env.PAYRIFF_MERCHANT || '').trim();
}

async function createOrder({ amount, currency = 'AZN', language = 'AZ', description, callbackUrl, metadata }) {
  if (amount == null || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw httpError('PAYRIFF_AMOUNT', 400, 'Invalid amount');
  }
  const base = String(PAYRIFF_BASE_URL || '').toLowerCase();
  const isV2 = base.includes('/api/v2');

  // V3: merchant secret key resolves the application; no merchant field in request body.
  // V2: most examples require `merchant` wrapper, so we support that when PAYRIFF_BASE_URL points to v2.
  const v3Body = {
    amount: Number(amount),
    currency,
    language,
    description: String(description || 'Mentorix subscription').slice(0, 250),
    callbackUrl,
    cardSave: false,
    operation: 'PURCHASE',
    metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
  };

  let body = v3Body;
  if (isV2) {
    const merchant = payriffMerchantId();
    if (!merchant) {
      throw httpError(
        'PAYRIFF_CONFIG',
        500,
        'Payriff merchant ID tapılmadı. Payriff kabinetində Applications bölməsindəki Merchant ID-ni Railway → Variables-də PAYRIFF_MERCHANT_ID kimi əlavə edin (məs: ES1095804).'
      );
    }
    body = { body: v3Body, merchant };
  }

  const res = await fetch(`${PAYRIFF_BASE_URL.replace(/\/+$/, '')}/orders`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || String(json.code || '') !== '00000') {
    const msg = json?.message || 'Payriff create order failed';
    const extra = json?.code || json?.responseId ? ` (code=${json?.code || '—'}, responseId=${json?.responseId || '—'})` : '';
    const endpoint = `${String(PAYRIFF_BASE_URL || '').replace(/\\/+$/, '')}/orders`;
    throw httpError('PAYRIFF_CREATE_FAILED', 502, `${msg}${extra} (endpoint=${endpoint})`);
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

