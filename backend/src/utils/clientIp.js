/** Client IP (Railway / reverse proxy: X-Forwarded-For). */
function clientIp(req) {
  const xf = String(req?.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  const ip = xf || req?.ip || req?.socket?.remoteAddress || '';
  return String(ip).trim();
}

module.exports = { clientIp };
