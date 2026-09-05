function originFromRequest(req) {
  const origin = String(req?.headers?.origin || '').trim();
  if (/^https?:\/\//i.test(origin)) return origin.replace(/\/+$/, '');
  const referer = String(req?.headers?.referer || '').trim();
  try {
    if (referer) return new URL(referer).origin.replace(/\/+$/, '');
  } catch {
    /* ignore */
  }
  return '';
}

function httpBase(raw) {
  const env = String(raw || '')
    .trim()
    .replace(/\/+$/, '');
  return /^https?:\/\//i.test(env) ? env : '';
}

function frontendBaseUrl(req) {
  const env = httpBase(
    process.env.FRONTEND_URL ||
      process.env.FRONTEND_BASE_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.APP_URL ||
      '',
  );
  if (env) return env;
  const fromReq = originFromRequest(req);
  if (fromReq) return fromReq;
  return 'https://mentorix.io';
}

function publicJoinUrl(joinPath, req) {
  const raw = String(joinPath || '').trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${frontendBaseUrl(req)}${path}`;
}

module.exports = { frontendBaseUrl, publicJoinUrl };
