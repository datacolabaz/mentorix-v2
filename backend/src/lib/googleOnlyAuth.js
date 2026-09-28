const jwt = require('jsonwebtoken');
const { logAuthEvent } = require('../services/authEventService');

const LINK_TOKEN_TTL = '10m';
const LINK_PURPOSE = 'google_account_link';

/**
 * Parol/OTP/telefon axınları söndürülüb. Admin kilidlənməsin deyə müvəqqəti açar:
 * LEGACY_PASSWORD_LOGIN_ENABLED=true (yalnız keçid dövrü üçün).
 */
function legacyAuthEnabled() {
  return String(process.env.LEGACY_PASSWORD_LOGIN_ENABLED || '').trim().toLowerCase() === 'true';
}

/** allowLegacy=false: identity-ni klient sahələrindən quran endpoint-lər heç vaxt açılmır. */
function googleOnlyGate(name, { allowLegacy = true } = {}) {
  return (req, res, next) => {
    if (allowLegacy && legacyAuthEnabled()) return next();
    logAuthEvent(req, { event: 'legacy_login_blocked', metadata: { endpoint: name } });
    return res.status(410).json({
      success: false,
      code: 'GOOGLE_ONLY',
      message: 'Giriş və qeydiyyat yalnız «Google ilə davam et» ilə mümkündür.',
    });
  };
}

function secret() {
  return String(process.env.JWT_SECRET || '').trim();
}

/** Google girişindən sonra köhnə hesabla birləşdirmə təklifi üçün qısa ömürlü token. */
function signAccountLinkToken({ googleSub, email, name, picture, emailVerified, targetUserId }) {
  return jwt.sign(
    { purpose: LINK_PURPOSE, sub: googleSub, email, name, picture, ev: Boolean(emailVerified), target: targetUserId },
    secret(),
    { expiresIn: LINK_TOKEN_TTL },
  );
}

function verifyAccountLinkToken(token) {
  try {
    const p = jwt.verify(String(token || ''), secret());
    if (p?.purpose !== LINK_PURPOSE || !p.sub || !p.target) return null;
    return p;
  } catch {
    return null;
  }
}

/** «a***@gmail.com» — təsdiq ekranında tam email göstərilmir. */
function maskEmail(email) {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at < 1) return s ? '***' : '';
  return `${s[0]}***${s.slice(at)}`;
}

module.exports = {
  legacyAuthEnabled,
  googleOnlyGate,
  signAccountLinkToken,
  verifyAccountLinkToken,
  maskEmail,
};
