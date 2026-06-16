const { verify } = require('../utils/jwt');
const {
  fetchUserAuthState,
  respondEmailNotVerified,
  isUserEmailVerified,
} = require('../services/emailVerificationGuard');
const { touchUserActivity } = require('../services/userPresenceService');

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token yoxdur' });
  }
  try {
    const payload = verify(token);
    const row = await fetchUserAuthState(payload.id);
    if (!row || row.is_active === false) {
      return res.status(401).json({ success: false, message: 'Token etibarsızdır' });
    }
    if (!isUserEmailVerified(row)) {
      return respondEmailNotVerified(res);
    }
    const effectiveRole = row?.role_selected === false ? null : (payload.role || row.role);
    req.user = { ...payload, role: effectiveRole };
    touchUserActivity(payload.id).catch(() => {});
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token etibarsızdır' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
  }
  next();
};

/** EventSource cannot send Authorization header — allow ?access_token= for SSE only. */
const authenticateSse = async (req, res, next) => {
  if (!req.headers.authorization?.split(' ')[1] && req.query?.access_token) {
    req.headers.authorization = `Bearer ${String(req.query.access_token).trim()}`;
  }
  return authenticate(req, res, next);
};

module.exports = { authenticate, authenticateSse, authorize };
