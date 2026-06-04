const MOBILE_RE = /Mobi|Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i;
const TABLET_RE = /iPad|Tablet|Android(?!.*Mobile)/i;

function normalizeDeviceType(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'mobile' || v === 'tablet' || v === 'desktop') return v;
  return null;
}

/** Server: User-Agent və ya client hint */
function deviceTypeFromRequest(req, clientHint) {
  const hinted = normalizeDeviceType(clientHint);
  if (hinted) return hinted;

  const ua = String(req?.headers?.['user-agent'] || '');
  if (TABLET_RE.test(ua)) return 'tablet';
  if (MOBILE_RE.test(ua)) return 'mobile';
  if (ua) return 'desktop';
  return 'unknown';
}

module.exports = { deviceTypeFromRequest, normalizeDeviceType };
